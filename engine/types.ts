export type Severity = "info" | "low" | "medium" | "high";

export type Finding = { id: string; severity: Severity; title: string; evidence: string };

export type RiskReport = {
  input: string;
  unit: string;
  policyId: string;
  assetNameAscii: string;
  fingerprint: string;
  identity: { registryName?: string; ticker?: string; decimals?: number; url?: string; inRegistry: boolean };
  policy: { scriptType: "native" | "plutus" | "unknown"; timelockedBefore?: string; requiredSigners: number; mintOpen: boolean };
  supply: { total: string; mintTxCount: number; burnTxCount: number; lastMintAt?: string };
  holders: { count: number; top1Pct: number; top10Pct: number; scriptHeldPct: number; sampled: boolean };
  liquidity: { pools: Array<{ dex: string; tvlAda: number; pair: string }>; totalTvlAda: number };
  activity: { tx24h?: number; firstSeen: string };
  findings: Finding[];
  verdict: "LOW" | "MEDIUM" | "HIGH";
  sources: Array<{ call: string; at: string }>;
};

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
