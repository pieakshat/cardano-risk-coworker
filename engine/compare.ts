import { mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { RiskReport } from "./types.ts";

const reportsDir = join(import.meta.dir, "reports");
const outPath = join(import.meta.dir, "../docs/TOKEN-TABLE.md");

const verdictRank: Record<RiskReport["verdict"], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function isRiskReport(value: unknown): value is RiskReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<RiskReport>;
  return (
    (row.verdict === "LOW" || row.verdict === "MEDIUM" || row.verdict === "HIGH") &&
    !!row.policy &&
    typeof row.policy.mintOpen === "boolean" &&
    !!row.holders &&
    typeof row.holders.top1Pct === "number" &&
    typeof row.holders.top10Pct === "number" &&
    typeof row.holders.scriptHeldPct === "number" &&
    !!row.liquidity &&
    typeof row.liquidity.totalTvlAda === "number" &&
    Array.isArray(row.findings)
  );
}

function collect(value: unknown): RiskReport[] {
  if (isRiskReport(value)) return [value];
  if (Array.isArray(value)) return value.filter(isRiskReport);
  return [];
}

function tokenName(report: RiskReport): string {
  return report.identity?.ticker || report.assetNameAscii || report.input;
}

function generatedAt(report: RiskReport): string {
  const stamped = (report as RiskReport & { generatedAt?: string }).generatedAt;
  if (stamped) return stamped;
  const times = (report.sources ?? []).map((source) => source.at).filter(Boolean).sort();
  return times.at(-1) ?? "";
}

function mintPolicy(report: RiskReport): string {
  if (report.policy.mintOpen) return "open";
  const lock = report.policy.timelockedBefore;
  return lock ? `time-locked ${lock.slice(0, 10)}` : "time-locked";
}

function formatPct(value: number): string {
  return value.toFixed(2);
}

function formatAda(value: number): string {
  const [whole, frac] = value.toFixed(2).split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = whole.replace("-", "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}.${frac}`;
}

function redFlags(report: RiskReport): string {
  const titles = report.findings.map((finding) => finding.title || finding.id).filter(Boolean);
  return titles.length ? titles.join("; ") : "none";
}

function cell(value: string): string {
  return value.replaceAll("|", "/").replaceAll("\n", " ");
}

const files = (await readdir(reportsDir)).filter((name) => name.endsWith(".json")).sort();
const loaded: RiskReport[] = [];
for (const name of files) {
  const parsed: unknown = await Bun.file(join(reportsDir, name)).json();
  loaded.push(...collect(parsed));
}

const byUnit = new Map<string, RiskReport>();
for (const report of loaded) {
  const key = report.unit || tokenName(report);
  const previous = byUnit.get(key);
  if (!previous || generatedAt(report) >= generatedAt(previous)) byUnit.set(key, report);
}

const rows = [...byUnit.values()]
  .map((report) => ({
    token: tokenName(report),
    verdict: report.verdict,
    mint: mintPolicy(report),
    top1: formatPct(report.holders.top1Pct),
    top10: formatPct(report.holders.top10Pct),
    contracts: formatPct(report.holders.scriptHeldPct),
    liquidity: formatAda(report.liquidity.totalTvlAda),
    flags: redFlags(report),
    generatedAt: generatedAt(report),
  }))
  .sort((a, b) => verdictRank[a.verdict] - verdictRank[b.verdict] || a.token.localeCompare(b.token));

const legend =
  "Token is the ticker on the report. Verdict is HIGH, MEDIUM, or LOW. Mint policy is open, or time-locked with the date minting closed. Largest holder % is the biggest non-contract wallet share of supply. Top10 % is the share held by the ten largest non-contract wallets. Contracts % is the share held in script addresses. DEX liquidity ADA is total pool liquidity, rounded to 2 decimals with thousands separators. Red flags are the finding titles, or none. generatedAt is the report timestamp, or the latest source time when the report has no generatedAt field.";

const header = "| token | verdict | mint policy | largest holder % | top10 % | contracts % | DEX liquidity ADA | red flags | generatedAt |";
const divider = "| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
const body = rows.map((row) =>
  `| ${cell(row.token)} | ${row.verdict} | ${cell(row.mint)} | ${row.top1} | ${row.top10} | ${row.contracts} | ${row.liquidity} | ${cell(row.flags)} | ${cell(row.generatedAt)} |`,
);

const markdown = `# Token risk table\n\n${legend}\n\n${header}\n${divider}\n${body.join("\n")}\n`;

await mkdir(dirname(outPath), { recursive: true });
await Bun.write(outPath, markdown);
console.log(`wrote ${rows.length} tokens to docs/TOKEN-TABLE.md`);
