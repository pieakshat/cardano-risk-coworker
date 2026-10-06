import { mkdir } from "node:fs/promises";
import { execute } from "./execute.ts";
import { startSeller } from "./seller.ts";

const started = Date.now();
const run = { startedAt: new Date(started).toISOString(), status: "failed" } as Record<string, unknown>;
try {
  await mkdir(new URL("./runs/", import.meta.url), { recursive: true });
  const server = startSeller();
  try { run.result = await execute(); run.status = "succeeded"; } finally { server.stop(true); }
} catch (error) { run.error = error instanceof Error ? error.message : String(error); }
run.finishedAt = new Date().toISOString(); run.elapsedMs = Date.now() - started;
const path = new URL(`./runs/${started}.json`, import.meta.url);
await Bun.write(path, JSON.stringify(run, null, 2));
console.log(JSON.stringify(run, null, 2));
if (run.status !== "succeeded") process.exitCode = 1;
