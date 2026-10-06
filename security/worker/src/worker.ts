import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { env, loadEnv } from "./config.ts";
import { createPayment, submitResult, waitForPayment } from "./payment.ts";
import { review } from "./review.ts";

loadEnv();
type RecordValue = Record<string, unknown>;
const forbiddenCoworker = "01a10fef-17cf-77b9-88f5-fe9e28243885";

const core = (path: string, init: RequestInit = {}) => fetch(`${env("SOKOSUMI_API_URL", "https://api.preprod.sokosumi.com/v1")}${path}`, {
  ...init,
  headers: { authorization: `Bearer ${env("SOKOSUMI_COWORKER_API_KEY")}`, "content-type": "application/json", ...(init.headers ?? {}) },
  signal: AbortSignal.timeout(20_000),
});

async function taskEvent(taskId: string, event: RecordValue): Promise<void> {
  const response = await core(`/tasks/${encodeURIComponent(taskId)}/events`, { method: "POST", body: JSON.stringify(event) });
  if (!response.ok) throw new Error(`Sokosumi event HTTP ${response.status}`);
}

function tasks(payload: unknown): RecordValue[] {
  if (Array.isArray(payload)) return payload as RecordValue[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as RecordValue;
  return (record.tasks ?? record.data ?? []) as RecordValue[];
}

async function readyTasks(): Promise<RecordValue[]> {
  const response = await core(`/tasks?coworkerId=${encodeURIComponent(env("SOKOSUMI_COWORKER_ID"))}&status=READY`);
  if (!response.ok) throw new Error(`Sokosumi tasks HTTP ${response.status}`);
  return tasks(await response.json());
}

function taskInput(task: RecordValue): string {
  const raw = typeof task.description === "string" ? task.description : String(task.input ?? "");
  try {
    const parsed = JSON.parse(raw) as RecordValue;
    return typeof parsed.repoUrl === "string" || typeof parsed.repo === "string" ? JSON.stringify(parsed) : raw.trim();
  } catch { return raw.trim(); }
}

async function once(): Promise<void> {
  const coworker = env("SOKOSUMI_COWORKER_ID");
  if (!coworker || !env("SOKOSUMI_COWORKER_API_KEY")) throw new Error("SOKOSUMI_COWORKER_ID and SOKOSUMI_COWORKER_API_KEY are required");
  for (const task of (await readyTasks()).filter((item) => String(item.coworkerId) === coworker)) {
    const id = String(task.id);
    const input = taskInput(task);
    if (!input) throw new Error(`Task ${id} has no repository input`);
    const payment = env("ENABLE_MPS_PAYMENTS") === "true" ? await createPayment(input) : null;
    await taskEvent(id, { status: "RUNNING", ...(payment ? { masumiPayment: payment.data ?? payment } : {}) });
    if (payment) await waitForPayment(payment);
    const output = await review(input);
    await mkdir("results", { recursive: true });
    await writeFile(`results/${output.jobId}.md`, output.report, "utf8");
    await writeFile(`results/${output.jobId}.aiken.test.ak`, output.tests, "utf8");
    const result = `${output.report}\n\n## Exploit tests\n\n\`\`\`aiken\n${output.tests}\n\`\`\`\n`;
    await writeFile(`results/${id}.txt`, result, "utf8");
    if (payment) await submitResult(payment, result);
    await taskEvent(id, { status: "COMPLETED", comment: result });
  }
}

async function main(): Promise<void> {
  if (env("SOKOSUMI_COWORKER_ID") === forbiddenCoworker) throw new Error("submission-1 Coworker is forbidden");
  await once();
  setInterval(() => once().catch((error) => console.error(error instanceof Error ? error.message : error)), Number(env("POLL_SECONDS", "15")) * 1000);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
