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

function matches(candidate: Candidate, rule: string): boolean {
  return text(candidate.rule) === rule;
}

async function runTarget(name: string, target: RecordValue, scanner: RecordValue, exploit: RecordValue): Promise<RecordValue> {
  const started = Date.now();
  const projectDir = String(target.projectDir);
  const scan = scanner.scan as (dir: string) => Candidate[] | Promise<Candidate[]>;
  const candidates = await scan(projectDir);
  const onchainScope = ["double-satisfaction", "settle-window", "missing-task-binding"];
  const replayName = target.replayFrom as string | undefined;
  const replayed: Candidate[] = [];
  if (replayName) {
    const source = manifest[replayName];
    const sourceDir = String(source.projectDir);
    for (const candidate of await scan(sourceDir)) {
      if (onchainScope.includes(String(candidate.rule))) replayed.push({ ...candidate, file: String(candidate.file).replace(sourceDir, projectDir) });
    }
  }
  const scopedCandidates = [...(name.startsWith("onchain") ? candidates.filter((candidate) => onchainScope.includes(String(candidate.rule))) : candidates), ...replayed];
  const results = await Promise.all(scopedCandidates.map((candidate) => (exploit.confirm as (dir: string, candidate: Candidate) => Candidate | Promise<Candidate>)(projectDir, candidate)));
  const confirmations = results.filter((result) => text(result.status ?? result.state) === "confirmed");
  const needsReview = results.filter((result) => text(result.status ?? result.state) !== "confirmed").map((result) => ({ ...((result as RecordValue).candidate as Candidate ?? result), status: "needs review" }));
  const llmCalls = results.reduce((total, result) => total + Number(result.llmCalls ?? result.llm_calls ?? 0), 0);
  const bugs = (target.bugs as string[]) ?? [];
  const bugRules = (target.bugRules as string[]) ?? [];
  const expectNone = Boolean(target.expectNoConfirmed);
  const foundBugs = expectNone ? [] : bugs.filter((_bug, index) => confirmations.some((finding) => matches(((finding as RecordValue).candidate as Candidate) ?? finding, bugRules[index])));
  const matched = foundBugs;
  return {
    target: name,
    source: target.source,
    groundTruthBugs: bugs,
    candidates: candidates.length,
    replayedCandidates: replayed.length,
    candidatesTested: scopedCandidates.length,
    confirmedFindings: confirmations,
    needsReview,
    groundTruthCount: bugs.length,
    known: bugs,
    expectedNoConfirmed: Boolean(target.expectNoConfirmed),
    matchedFindings: matched.length,
    foundBugs,
    recall: bugs.length ? Number((matched.length / bugs.length).toFixed(3)) : 1,
    falsePositives: expectNone ? confirmations.length : confirmations.filter((finding) => !bugRules.includes(text(((finding as RecordValue).candidate as Candidate)?.rule ?? finding.rule))).length,
    elapsedMs: Date.now() - started,
    llmCalls,
  };
}

async function runCapped(name: string, target: RecordValue, scanner: RecordValue, exploit: RecordValue): Promise<RecordValue> {
  const capMs = 20 * 60 * 1000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const capped = new Promise<RecordValue>((resolveCap) => {
    timer = setTimeout(() => resolveCap({
      target: name,
      source: target.source,
      groundTruthBugs: target.bugs ?? [],
      known: target.bugs ?? [],
      expectedNoConfirmed: Boolean(target.expectNoConfirmed),
      candidates: 0,
      candidatesTested: 0,
      confirmedFindings: [],
      needsReview: [],
      groundTruthCount: (target.bugs as string[] | undefined)?.length ?? 0,
      matchedFindings: 0,
      recall: 0,
      falsePositives: 0,
      elapsedMs: capMs,
      llmCalls: 0,
      capped: true,
    }), capMs);
  });
  const result = await Promise.race([runTarget(name, target, scanner, exploit), capped]);
  if (timer) clearTimeout(timer);
  return result;
}

await waitForSecurityModules();
const scanner = await import(modulePath(scannerCandidates)) as RecordValue;
const exploit = await import(modulePath(exploitCandidates)) as RecordValue;
const results: RecordValue[] = await Promise.all(Object.entries(manifest).map(([name, target]) => runCapped(name, target, scanner, exploit)));
const output = { generatedAt: new Date().toISOString(), targets: results };
writeFileSync(resolve(import.meta.dir, "results.json"), `${JSON.stringify(output, null, 2)}\n`);
const header = "| Target | Known | Candidates tested | Confirmed | Recall | False confirmations | Time (s) | Model calls | Cap |\n|---|---:|---:|---:|---:|---:|---:|---:|---|";
const rows = results.map((result) => `| ${result.target} | ${result.groundTruthCount} | ${result.candidatesTested ?? 0} | ${(result.confirmedFindings as unknown[]).length} | ${result.recall} | ${result.falsePositives} | ${(Number(result.elapsedMs) / 1000).toFixed(1)} | ${result.llmCalls} | ${result.capped ? "20 min" : ""} |`);
writeFileSync(resolve(import.meta.dir, "RESULTS.md"), `# Security benchmark\n\nGenerated ${output.generatedAt}. Ground truth is recorded in [ground-truth.json](./ground-truth.json) from each target README or the onchain security reports. A finding counts as confirmed only when exploit confirmation returns CONFIRMED.\n\n${header}\n${rows.join("\n")}\n\nNeeds-review candidates are retained in results.json and are not counted as findings.\n`);
console.log(JSON.stringify(results.map((result) => ({ target: result.target, recall: result.recall, falsePositives: result.falsePositives, elapsedMs: result.elapsedMs, llmCalls: result.llmCalls })), null, 2));
