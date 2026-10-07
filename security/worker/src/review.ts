import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

type RecordValue = Record<string, unknown>;
export type Candidate = RecordValue;
export type Confirmation = RecordValue;

function command(file: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${file} timed out`));
    }, 120_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(stdout) : reject(new Error(stderr || `${file} exited ${code}`));
    });
  });
}

export function parseInput(input: string): { repoUrl: string; path?: string } {
  let value: RecordValue;
  try {
    const parsed = JSON.parse(input) as unknown;
    value = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as RecordValue : { repoUrl: input.trim() };
  } catch { value = { repoUrl: input.trim() }; }
  const rawRepoUrl = String(value.repoUrl ?? value.repo ?? "").trim();
  const repoUrl = rawRepoUrl.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?/)?.[0] ?? rawRepoUrl;
  const path = typeof value.path === "string" ? value.path.replace(/^\/+/, "") : undefined;
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(repoUrl)) throw new Error("repoUrl must be a public https GitHub repository URL");
  if (path && (path.includes("..") || path.startsWith("/"))) throw new Error("path must stay inside the repository");
  return { repoUrl: repoUrl.replace(/\/$/, ""), ...(path ? { path } : {}) };
}

async function moduleAfter(paths: string[], timeoutMs = 60_000): Promise<RecordValue> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const path of paths) {
      try { return await import(path) as RecordValue; } catch (error) {
        // Bun throws a ResolveMessage (not an Error) for a missing module; read its message either way.
        const message = String((error as { message?: unknown } | null)?.message ?? error);
        if (!/Cannot find module|ERR_MODULE_NOT_FOUND/.test(message)) throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`timed out waiting for ${paths.join(" or ")}`);
}

export async function review(input: string): Promise<{ report: string; tests: string; jobId: string }> {
  const target = parseInput(input);
  const jobId = randomUUID();
  const workRoot = `${process.cwd()}/work`;
  const projectDir = `${workRoot}/${jobId}`;
  await mkdir(workRoot, { recursive: true });
  try {
    await command("git", ["clone", "--depth", "1", target.repoUrl, projectDir]);
    const scanModule = await moduleAfter(["../../scanner/index.ts", "../../scanner/scanner.ts"]);
    const exploitModule = await moduleAfter(["../../exploit/index.ts", "../../exploit/exploit.ts"]);
    const scan = scanModule.scan as (dir: string) => Candidate[] | Promise<Candidate[]>;
    const confirm = exploitModule.confirm as (dir: string, candidate: Candidate) => Confirmation | Promise<Confirmation>;
    const candidates = await scan(target.path ? `${projectDir}/${target.path}` : projectDir);
    const confirmed: Confirmation[] = [];
    const needsReview: Candidate[] = [];
    for (const candidate of candidates) {
      const result = await confirm(projectDir, candidate);
      if (String(result.status ?? result.state ?? "").toUpperCase() === "CONFIRMED") confirmed.push(result);
      else needsReview.push({ ...candidate, status: "needs review" });
    }
    const tests = confirmed.map((item) => String(item.testSource ?? item.test ?? "")).filter(Boolean).join("\n\n");
    const report = [
      `# Aiken Security Review\n\nRepository: ${target.repoUrl}${target.path ? `\nPath: ${target.path}` : ""}`,
      `\n## Confirmed findings\n`,
      confirmed.length ? confirmed.map((item, index) => `### ${index + 1}. ${item.severity ?? "unknown"}: ${item.title ?? item.rule ?? "Confirmed exploit"}\n\n- Location: ${item.file ?? "unknown"}:${item.line ?? "?"}\n- Attack transaction: ${item.attackShape ?? item.attackSketch ?? "See exploit test."}\n- Suggested fix: ${item.suggestedFix ?? item.recommendation ?? "See exploit test."}`).join("\n\n") : "No exploitable findings confirmed.",
      `\n## Needs review\n`,
      needsReview.length ? needsReview.map((item) => `- ${item.rule ?? "candidate"} at ${item.file ?? "unknown"}:${item.line ?? "?"}: ${item.why ?? "candidate was not confirmed"}`).join("\n") : "None.",
      `\nEvery reported finding has a passing attack test against the submitted source.`,
    ].join("\n");
    return { report, tests: tests || "No confirmed exploit tests.\n", jobId };
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}
