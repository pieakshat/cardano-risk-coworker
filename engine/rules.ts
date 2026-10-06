export const RULES = {
  top1HighPct: 30,
  top10MediumPct: 70,
  lowLiquidityAda: 10_000,
  youngTokenDays: 30,
  holderPageSize: 1000,
  holderPageCap: 1,
} as const;

export function verdict(findings: Array<{ severity: string }>): "LOW" | "MEDIUM" | "HIGH" {
  if (findings.some((finding) => finding.severity === "high")) return "HIGH";
  return findings.filter((finding) => finding.severity === "medium").length >= 2 ? "MEDIUM" : "LOW";
}
