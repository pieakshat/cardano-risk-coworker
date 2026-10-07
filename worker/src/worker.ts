import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { env, loadEnv } from "./config.ts";
import { createPayment, submitResult, waitForPayment } from "./payment.ts";
import { analyze } from "../../engine/engine.ts";
import { writeMemo } from "../../memo/index.ts";

loadEnv();

type RecordValue = Record<string, unknown>;

const settlement = (input: string) => {
  const match = input.match(/^pay\s+(\d+)\s+(\S+)\s+to\s+(\S+)\s+from\s+(\S+)$/i);
  if (!match) throw new Error('Settlement Task must match: pay <N> <asset> to <x402 url> from <asset>');
  const [, amount, asset, sellerUrl, holdAsset] = match;
  return new Promise<string>((resolve, reject) => {
    const child = spawn("bun", [new URL("../../settle/run.ts", import.meta.url).pathname], {
      cwd: new URL("../../", import.meta.url).pathname,
      env: { ...process.env, SETTLE_PAY_AMOUNT: amount, SETTLE_PAY_ASSET: asset, SETTLE_SELLER_URL: sellerUrl, SETTLE_HOLD_ASSET: holdAsset },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(err || out || `settlement exited ${code}`)));
  });
};

export const SETTLEMENT_DISABLED_ERROR = "Settlement tasks are disabled: escrow payment, seller risk checks, host validation, and spend caps are not enabled on this worker.";

export function rejectSettlementTask(input: string): void {
  if (/^pay\s+/i.test(input)) throw new Error(SETTLEMENT_DISABLED_ERROR);
}

const core = (path: string, init: RequestInit = {}) => fetch(`${env("SOKOSUMI_API_URL", "https://api.preprod.sokosumi.com/v1")}${path}`, {
  ...init,
  headers: { authorization: `Bearer ${env("SOKOSUMI_COWORKER_API_KEY")}`, "content-type": "application/json", ...(init.headers ?? {}) },
  signal: AbortSignal.timeout(20_000),
});

function tasks(payload: unknown): RecordValue[] {
  if (Array.isArray(payload)) return payload as RecordValue[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as RecordValue;
  return (record.tasks ?? record.data ?? []) as RecordValue[];
}

async function readyTasks(coworker: string): Promise<RecordValue[]> {
  const response = await core(`/tasks?coworkerId=${encodeURIComponent(coworker)}&status=READY`);
  if (!response.ok) throw new Error(`Sokosumi tasks HTTP ${response.status}`);
  return tasks(await response.json());
}

async function taskEvent(taskId: string, body: RecordValue): Promise<RecordValue> {
  const response = await core(`/tasks/${encodeURIComponent(taskId)}/events`, { method: "POST", body: JSON.stringify(body) });
  const payload = await response.json() as { data?: RecordValue; message?: string };
  if (!response.ok || !payload.data) throw new Error(`Sokosumi event HTTP ${response.status}: ${payload.message ?? "invalid response"}`);
  return payload.data;
}

function taskInput(task: RecordValue): string {
  const value = typeof task.description === "string" ? task.description : String(task.input ?? "");
  try {
    const parsed = JSON.parse(value) as RecordValue;
    return typeof parsed.input === "string" ? parsed.input : value;
  } catch { return value.trim(); }
}

function tokenInput(value: string): string | null {
  return value.match(/[0-9a-f]{56,128}/i)?.[0] ?? value.match(/\b[A-Z][A-Z0-9]{1,15}\b/)?.[0] ?? null;
}

async function failTask(id: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try { await taskEvent(id, { status: "FAILED", comment: message }); }
  catch (failure) { console.error(`Task ${id} failure event failed: ${failure instanceof Error ? failure.message : failure}`); }
  console.error(`Task ${id} failed: ${message}`);
}

async function processTask(task: RecordValue): Promise<void> {
  const id = String(task.id);
  try {
    const input = taskInput(task);
    const isSettlement = /^pay\s+/i.test(input);
    rejectSettlementTask(input);
    const token = isSettlement ? input : tokenInput(input);
    if (!token) {
      const result = "Usage: submit a Cardano token ticker (for example, SNEK) or a 56+ character asset unit.";
      await mkdir("results", { recursive: true });
      await writeFile(`results/${id}.txt`, result, "utf8");
      await taskEvent(id, { status: "COMPLETED", comment: result });
      return;
    }
    const payment = !isSettlement && env("ENABLE_MPS_PAYMENTS") === "true" ? await createPayment(input) : null;
    await taskEvent(id, { status: "RUNNING", ...(payment ? { masumiPayment: payment.data ?? payment } : {}) });
    if (payment) await waitForPayment(payment);
    const result = isSettlement ? await settlement(input) : await (async () => {
      const report = await analyze(token);
      const memo = await writeMemo(report);
      return `${memo.markdown}\n\n--- risk-report.json ---\n${JSON.stringify(memo.json, null, 2)}\n`;
    })();
    await mkdir("results", { recursive: true });
    await writeFile(`results/${id}.txt`, result, "utf8");
    if (payment) await submitResult(payment, result);
    await taskEvent(id, { status: "COMPLETED", comment: result });
  } catch (error) { await failTask(id, error); }
}

async function once(): Promise<void> {
  const coworker = env("SOKOSUMI_COWORKER_ID");
  if (!coworker) throw new Error("SOKOSUMI_COWORKER_ID is required");
  for (const task of (await readyTasks(coworker)).filter((item) => item.status === "READY" && item.coworkerId === coworker)) await processTask(task);
}

async function main(): Promise<void> {
  await once();
  setInterval(() => once().catch((error) => console.error(error instanceof Error ? error.message : error)), Number(env("POLL_SECONDS", "15")) * 1000);
}

if (import.meta.main) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
