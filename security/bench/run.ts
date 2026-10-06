import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type RecordValue = Record<string, unknown>;
type Candidate = RecordValue;

const root = resolve(import.meta.dir, "../..");
const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, "ground-truth.json"), "utf8")) as Record<string, RecordValue>;
const scannerCandidates = [resolve(root, "security/scanner/index.ts"), resolve(root, "security/scanner/scanner.ts")];
const exploitCandidates = [resolve(root, "security/exploit/index.ts"), resolve(root, "security/exploit/exploit.ts")];

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForSecurityModules(): Promise<void> {
  while (!scannerCandidates.some(existsSync) || !exploitCandidates.some(existsSync)) {
    console.error(`waiting for scanner and exploit: scanner=${scannerCandidates.some(existsSync)} exploit=${exploitCandidates.some(existsSync)}`);
    await sleep(300_000);
  }
}

function modulePath(paths: string[]): string {
  const path = paths.find(existsSync);
  if (!path) throw new Error("security module disappeared after polling");
  return path;
}

function text(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function matches(candidate: Candidate, bug: string): boolean {
  const haystack = text([candidate.rule, candidate.title, candidate.why, candidate.attackSketch, candidate.file].join(" "));
  const words = bug.split(/[^a-z0-9]+/).filter((word) => word.length > 4);
  return words.filter((word) => haystack.includes(word)).length >= Math.max(1, Math.ceil(words.length / 4));
}

async function runTarget(name: string, target: RecordValue, scanner: RecordValue, exploit: RecordValue): Promise<RecordValue> {
  const started = Date.now();
  const projectDir = String(target.projectDir);
  const candidates = await (scanner.scan as (dir: string) => Candidate[] | Promise<Candidate[]>)(projectDir);
  const confirmations: Candidate[] = [];
  const needsReview: Candidate[] = [];
  let llmCalls = 0;
  for (const candidate of candidates) {
    const result = await (exploit.confirm as (dir: string, candidate: Candidate) => Candidate | Promise<Candidate>)(projectDir, candidate);
    llmCalls += Number(result.llmCalls ?? result.llm_calls ?? 0);
    if (text(result.status ?? result.state) === "confirmed") confirmations.push(result);
    else needsReview.push({ ...candidate, status: "needs review" });
  }
  const bugs = (target.bugs as string[]) ?? [];
  const matched = confirmations.filter((finding) => bugs.some((bug) => matches(finding, bug)));
  return {
    target: name,
    source: target.source,
    groundTruthBugs: bugs,
    candidates: candidates.length,
    confirmedFindings: confirmations,
    needsReview,
    groundTruthCount: bugs.length,
    matchedFindings: matched.length,
    recall: bugs.length ? Number((matched.length / bugs.length).toFixed(3)) : 1,
    falsePositives: confirmations.length - matched.length,
    elapsedMs: Date.now() - started,
    llmCalls,
  };
}

await waitForSecurityModules();
const scanner = await import(modulePath(scannerCandidates)) as RecordValue;
const exploit = await import(modulePath(exploitCandidates)) as RecordValue;
const results: RecordValue[] = [];
for (const [name, target] of Object.entries(manifest)) {
  results.push(await runTarget(name, target, scanner, exploit));
}
const output = { generatedAt: new Date().toISOString(), targets: results };
writeFileSync(resolve(import.meta.dir, "results.json"), `${JSON.stringify(output, null, 2)}\n`);
const header = "| Target | Ground truth | Confirmed | Recall | False positives | Time (s) | LLM calls |\n|---|---:|---:|---:|---:|---:|---:|";
const rows = results.map((result) => `| ${result.target} | ${result.groundTruthCount} | ${(result.confirmedFindings as unknown[]).length} | ${result.recall} | ${result.falsePositives} | ${(Number(result.elapsedMs) / 1000).toFixed(1)} | ${result.llmCalls} |`);
writeFileSync(resolve(import.meta.dir, "RESULTS.md"), `# Security benchmark\n\nGenerated ${output.generatedAt}. Ground truth is recorded in [ground-truth.json](./ground-truth.json) from each target README or the onchain security reports. A finding counts as confirmed only when exploit confirmation returns CONFIRMED.\n\n${header}\n${rows.join("\n")}\n\nNeeds-review candidates are retained in results.json and are not counted as findings.\n`);
console.log(JSON.stringify(results.map((result) => ({ target: result.target, recall: result.recall, falsePositives: result.falsePositives, elapsedMs: result.elapsedMs, llmCalls: result.llmCalls })), null, 2));
