import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bunPath, CACHE_ROOT } from "./security-repo";

export type ScanCandidate = { rule: string; file: string; line: number; why: string; attackSketch: string };
export type JobStatus = "queued" | "generating" | "compiling" | "confirmed" | "not_confirmed";
export type JobCandidate = {
  index: number;
  candidate: ScanCandidate;
  status: JobStatus;
  startedAt?: number;
  elapsedMs?: number;
  reason?: string;
  model?: string;
  attempts?: number;
  llmCalls?: number;
  testSource?: string;
  checkOutput?: string;
  passLines?: string[];
};
export type Job = {
  id: string;
  repoUrl: string;
  sha: string;
  project: string;
  createdAt: number;
  status: "running" | "done" | "interrupted";
  candidates: JobCandidate[];
};

const JOBS_DIR = join(CACHE_ROOT, "jobs");
const CONFIRM_LIMIT = 3;
const CANDIDATE_TIMEOUT_MS = 15 * 60_000;
const GENERATED_FILE = "security_exploit_generated_test.ak";
const running: Set<string> = ((globalThis as Record<string, unknown>).__aikenRunning ??= new Set()) as Set<string>;

const HIGH = /double|satisf|signer|mint|unique|binding|substitut|settle|window|plutus/i;
const LOW = /dust|else/i;
const weight = (rule: string) => (HIGH.test(rule) ? 0 : LOW.test(rule) ? 2 : 1);

/** Top candidates to attempt: highest-impact rules first, one per (rule, file) so three slots cover three different issues. */
export function selectTop(candidates: ScanCandidate[], limit = CONFIRM_LIMIT): number[] {
  const order = candidates.map((_, i) => i).sort((a, b) => weight(candidates[a].rule) - weight(candidates[b].rule) || a - b);
  const seen = new Set<string>();
  const picked: number[] = [];
  for (const i of order) {
    const key = `${candidates[i].rule}|${candidates[i].file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(i);
    if (picked.length === limit) break;
  }
  return picked;
}

export const MAX_RUNNING_JOBS = 3;
export const runningJobs = () => running.size;

const jobPath = (id: string) => join(JOBS_DIR, `${id}.json`);

async function save(job: Job): Promise<void> {
  await mkdir(JOBS_DIR, { recursive: true });
  const tmp = `${jobPath(job.id)}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(job));
  await rename(tmp, jobPath(job.id));
}

export async function loadJob(id: string): Promise<Job | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  let job: Job;
  try { job = JSON.parse(await readFile(jobPath(id), "utf8")) as Job; } catch { return null; }
  if (job.status === "running" && !running.has(id)) job.status = "interrupted";
  return job;
}

function generatedStarted(projectDir: string, since: number): boolean {
  const work = join(projectDir, "work");
  if (!existsSync(work)) return false;
  return readdirSync(work).some((name) => {
    const file = join(work, name, "validators", GENERATED_FILE);
    return existsSync(file) && statSync(file).mtimeMs >= since - 1000;
  });
}

type WorkerResult = {
  status: "CONFIRMED" | "UNCONFIRMED";
  reason?: string;
  model?: string;
  attempts?: number;
  llmCalls: number;
  testSource?: string;
  modelAttempts: Array<{ model: string; attack: string; control: string; compile: string; output: string }>;
};

function runWorker(projectDir: string, candidate: ScanCandidate, onStage: () => void): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const bin = existsSync(bunPath()) ? bunPath() : "bun";
    const child = spawn(bin, [join(process.cwd(), "lib", "security-confirm-worker.mjs"), projectDir, JSON.stringify(candidate)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { if (err.length < 4000) err += chunk; });
    const poll = setInterval(onStage, 1500);
    const timer = setTimeout(() => child.kill("SIGKILL"), CANDIDATE_TIMEOUT_MS);
    const done = () => { clearInterval(poll); clearTimeout(timer); };
    child.on("error", (error) => { done(); reject(error); });
    child.on("close", (code) => {
      done();
      const line = out.split("\n").reverse().find((l) => l.startsWith("@@RESULT@@"));
      if (!line) return reject(new Error(code === null ? "exploit run exceeded 15 minutes" : `exploit worker exited ${code}: ${err.trim().split("\n").slice(-1)[0] ?? ""}`));
      try { resolve(JSON.parse(line.slice(10)) as WorkerResult); } catch (error) { reject(error); }
    });
  });
}

function digest(output: string): string {
  return output.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").split("\n").filter((l) => l.trim()).join("\n").slice(0, 2500);
}

async function runJob(job: Job, projectDir: string, absolute: ScanCandidate[]): Promise<void> {
  running.add(job.id);
  try {
    for (const item of job.candidates) {
      item.status = "generating";
      item.startedAt = Date.now();
      await save(job);
      let staged = false;
      try {
        const result = await runWorker(projectDir, absolute[item.index], () => {
          if (staged || !generatedStarted(projectDir, item.startedAt ?? 0)) return;
          staged = true;
          item.status = "compiling";
          void save(job);
        });
        const attempt = result.modelAttempts.find((a) => a.attack === "pass") ?? result.modelAttempts.at(-1);
        item.llmCalls = result.llmCalls;
        item.testSource = result.testSource;
        item.checkOutput = attempt ? digest(attempt.output) : undefined;
        if (result.status === "CONFIRMED") {
          item.status = "confirmed";
          item.model = result.model;
          item.attempts = result.attempts;
          const pass = (attempt?.output ?? "").split("\n").filter((l) => /\bPASS\b/.test(l)).map((l) => l.replace(/^[\s│]+/, "").trim());
          const named = pass.filter((l) => /exploit_attack|honest_control/.test(l));
          item.passLines = named.length ? named : pass.slice(-2);
        } else {
          item.status = "not_confirmed";
          item.reason = result.reason;
        }
      } catch (error) {
        item.status = "not_confirmed";
        item.reason = error instanceof Error ? error.message : "exploit run failed";
      }
      item.elapsedMs = Date.now() - (item.startedAt ?? Date.now());
      await save(job);
    }
    job.status = "done";
    await save(job);
  } finally {
    running.delete(job.id);
  }
}

/** Creates the job record and starts it in the background; returns before any exploit run finishes. */
export async function startJob(meta: { repoUrl: string; sha: string; project: string }, projectDir: string, candidates: ScanCandidate[], absolute: ScanCandidate[]): Promise<Job> {
  const job: Job = {
    id: crypto.randomUUID(),
    ...meta,
    createdAt: Date.now(),
    status: "running",
    candidates: selectTop(candidates).map((index) => ({ index, candidate: candidates[index], status: "queued" as const })),
  };
  await save(job);
  running.add(job.id);
  void runJob(job, projectDir, absolute).catch(async () => {
    job.status = "done";
    for (const c of job.candidates) if (c.status === "queued" || c.status === "generating" || c.status === "compiling") { c.status = "not_confirmed"; c.reason = "job runner failed"; }
    await save(job);
  });
  return job;
}
