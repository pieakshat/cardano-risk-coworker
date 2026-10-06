import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { env, loadEnv } from "./config.ts";
import { createPayment, submitResult, waitForPayment } from "./payment.ts";
import { analyze } from "../../engine/engine.ts";
import { writeMemo } from "../../memo/index.ts";

loadEnv();

type RecordValue = Record<string, unknown>;

const run = (args: string[]) => new Promise<string>((resolve, reject) => {
  const child = spawn("sokosumi", ["--preprod", ...args, "--json"], { env: process.env });
  let out = "";
  let err = "";
  child.stdout.on("data", (chunk) => { out += chunk; });
  child.stderr.on("data", (chunk) => { err += chunk; });
  child.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(err || `sokosumi exited ${code}`)));
});

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

const core = (path: string, init: RequestInit = {}) => fetch(`${env("SOKOSUMI_API_URL", "https://api.preprod.sokosumi.com/v1")}${path}`, {
  ...init,
  headers: { authorization: `Bearer ${env("SOKOSUMI_COWORKER_API_KEY")}`, "content-type": "application/json", ...(init.headers ?? {}) },
  signal: AbortSignal.timeout(20_000),
});

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

async function once(): Promise<void> {
  const coworker = env("SOKOSUMI_COWORKER_ID");
  if (!coworker) throw new Error("SOKOSUMI_COWORKER_ID is required");
  const raw = await run(["tasks", "list", "--personal"]);
  const parsed = JSON.parse(raw) as RecordValue[] | { tasks?: RecordValue[]; data?: RecordValue[] };
  const tasks = Array.isArray(parsed) ? parsed : parsed.tasks ?? parsed.data ?? [];
  for (const task of tasks.filter((item) => item.status === "READY" && item.coworkerId === coworker)) {
    const id = String(task.id);
    const input = taskInput(task);
    if (!input) throw new Error(`Task ${id} has no token input`);
    const isSettlement = /^pay\s+/i.test(input);
    const payment = !isSettlement && env("ENABLE_MPS_PAYMENTS") === "true" ? await createPayment(input) : null;
    await taskEvent(id, { status: "RUNNING", ...(payment ? { masumiPayment: payment.data ?? payment } : {}) });
    if (payment) await waitForPayment(payment);
    const result = isSettlement ? await settlement(input) : await (async () => {
      const report = await analyze(input);
      const memo = await writeMemo(report);
      return `${memo.markdown}\n\n--- risk-report.json ---\n${JSON.stringify(memo.json, null, 2)}\n`;
    })();
    await mkdir("results", { recursive: true });
    await writeFile(`results/${id}.txt`, result, "utf8");
    if (payment) await submitResult(payment, result);
    await taskEvent(id, { status: "COMPLETED", comment: result });
  }
}

async function main(): Promise<void> {
  await once();
  setInterval(() => once().catch((error) => console.error(error instanceof Error ? error.message : error)), Number(env("POLL_SECONDS", "15")) * 1000);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
