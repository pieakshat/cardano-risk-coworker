import min from "../../engine/reports/MIN.json";
import mint from "../../engine/reports/MINt.json";
import snek from "../../engine/reports/SNEK.json";
import top20 from "../../engine/reports/top20.json";

import type { RiskReport } from "../../engine/types";

export type StoredReport = RiskReport & { generatedAt: string; summaryOnly?: boolean };

const generatedAt = new Map(top20.map((report) => [report.ticker.toUpperCase(), report.generatedAt]));
const fullReports = new Map<string, RiskReport>([
  // keyed by ticker: the full reports carry the unit in .input, the examples look up by ticker
  ["MIN", { ...(min as RiskReport), input: "MIN" }],
  ["MINt", { ...(mint as RiskReport), input: "MINt" }],
  ["SNEK", { ...(snek as RiskReport), input: "SNEK" }],
]);

const summaryReport = (summary: (typeof top20)[number]): RiskReport => ({
  input: summary.ticker,
  unit: summary.unit,
  policyId: summary.unit.slice(0, 56),
  assetNameAscii: summary.ticker,
  fingerprint: "",
  identity: { ticker: summary.ticker, inRegistry: true },
  policy: { scriptType: "unknown", requiredSigners: 0, mintOpen: false },
  supply: { total: "", mintTxCount: 0, burnTxCount: 0 },
  holders: { count: 0, top1Pct: summary.top1Pct, top10Pct: 0, scriptHeldPct: 0, sampled: false },
  liquidity: { pools: [], totalTvlAda: summary.totalTvlAda },
  activity: { firstSeen: "" },
  findings: summary.findings.map((finding) => ({
    id: finding.id,
    severity: finding.severity as RiskReport["findings"][number]["severity"],
    title: finding.id.replaceAll("-", " "),
    evidence: "Stored engine report. Re-run live for current evidence.",
  })),
  verdict: summary.verdict as RiskReport["verdict"],
  sources: [{ call: "engine/reports/top20.json", at: summary.generatedAt }],
});

const unique = new Map<string, StoredReport>();
for (const summary of top20) {
  const report = fullReports.get(summary.ticker) ?? summaryReport(summary);
  unique.set(summary.ticker, { ...report, generatedAt: generatedAt.get(summary.ticker.toUpperCase()) ?? summary.generatedAt, summaryOnly: !fullReports.has(summary.ticker) });
}

export const storedReports = [...unique.values()].slice(0, 6);
