export type Finding = { id: string; severity: string; title: string; evidence: string };
export type Report = {
  input: string;
  unit: string;
  policyId: string;
  assetNameAscii: string;
  fingerprint: string;
  identity: { registryName?: string; ticker?: string; decimals?: number; url?: string; inRegistry: boolean };
  policy: { scriptType: string; timelockedBefore?: string; requiredSigners: number; mintOpen: boolean };
  supply: { total: string; mintTxCount: number; burnTxCount: number; lastMintAt?: string };
  holders: { count: number; top1Pct: number; top10Pct: number; scriptHeldPct: number; sampled: boolean };
  liquidity: { pools: Array<{ dex: string; tvlAda: number; pair: string }>; totalTvlAda: number };
  activity: { tx24h?: number; firstSeen: string };
  findings: Finding[];
  verdict: "LOW" | "MEDIUM" | "HIGH";
  verdictLabel?: "INTERACT" | "INTERACT WITH CONDITIONS" | "DO NOT INTERACT";
  target?: "token" | "script";
  contract?: { address?: string; scriptHash: string; scriptType: string; scriptSizeBytes?: number; firstSeen: string; tvlAda: number; topAssets: Array<{ unit: string; quantity: string }>; utxoCount: number; recentTxCount: number; knownProtocol?: string; adminKeyCount?: number };
  sources: Array<{ call: string; at: string }>;
  generatedAt?: string;
  summaryOnly?: boolean;
};
export type ApiResult = { markdown: string; json: Report } | { error: string };

export const LABEL = { LOW: "INTERACT", MEDIUM: "INTERACT WITH CONDITIONS", HIGH: "DO NOT INTERACT" } as const;

const WHY: Record<string, (r: Report) => string> = {
  "mint-open": () => "whoever holds the policy key can mint more at any time.",
  "mint-policy-plutus": () => "a program decides who can mint more, so its code has to be read before you trust it.",
  "holders-unknown": () => "we could not see how the supply is split between wallets.",
  top1: (r) => `one wallet holds ${r.holders.top1Pct.toFixed(0)}% of the supply and can sell it all at once.`,
  top10: () => "ten wallets hold most of the supply.",
  registry: () => "the token is missing from the official Cardano token registry, so it may be an imitation.",
  liquidity: () => "there is little liquidity on Minswap, so a trade of any size moves the price hard.",
  young: () => "the token is less than 30 days old.",
  "unknown-script-value": () => "an unrecognised contract is holding a lot of value.",
  "young-script": () => "the contract is less than 30 days old.",
  "single-admin-key": () => "one key can change or control this contract.",
};

export function why(finding: Finding, report: Report) {
  if (finding.id === "known-protocol") return `this is a recognised protocol script${report.contract?.knownProtocol ? `: ${report.contract.knownProtocol}` : ""}.`;
  return WHY[finding.id]?.(report) ?? finding.title.charAt(0).toLowerCase() + finding.title.slice(1) + ".";
}

export function subject(r: Report) {
  if (r.target === "script") return "this contract";
  return r.identity.ticker || r.assetNameAscii || r.input;
}

// The plain-words verdict: one sentence a newcomer can act on, built only from rules that fired.
export function plainVerdict(r: Report) {
  const name = subject(r);
  const script = r.target === "script";
  const risky = r.findings.filter((f) => f.severity === "high" || f.severity === "medium").sort((a, b) => (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1));
  if (r.verdict === "HIGH") {
    const lead = risky.find((f) => f.severity === "high") ?? risky[0];
    return `Do not let your agent ${script ? "sign for" : "pay in"} ${name}: ${lead ? why(lead, r) : "a blocking rule fired."}`;
  }
  if (r.verdict === "MEDIUM") {
    return `Let your agent ${script ? "use" : "pay in"} ${name} only with a spending limit: ${risky.slice(0, 2).map((f) => why(f, r).replace(/\.$/, "")).join(", and ")}.`;
  }
  const known = r.findings.find((f) => f.id === "known-protocol");
  const base = script
    ? known ? `Your agent can use this contract: it is a recognised ${r.contract?.knownProtocol ?? "protocol"} script.` : "Your agent can use this contract: no rule marked it as dangerous."
    : `Your agent can pay in ${name}: no rule found a red flag in its minting, holders, registry or liquidity.`;
  const watch = risky[0];
  return watch ? `${base} One thing to watch: ${why(watch, r)}` : base;
}

export function agentView(r: Report | null) {
  if (!r) return { decision: null, note: "Run a check above. This is the object your agent receives." };
  return {
    contract: r.target === "script" ? r.contract?.address || r.input : r.unit,
    decision: r.verdictLabel || LABEL[r.verdict],
    reasons: r.findings.map((f) => ({ id: f.id, severity: f.severity })),
    sources: r.sources.length,
  };
}

export function ada(v: number) { return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : Math.round(v).toLocaleString("en-US"); }
export function pct(v: number) { return `${v.toFixed(2)}%`; }
export function formatDay(v: string) { return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(v)); }
export function formatWhen(v: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(v)); }

export type Gate = { name: string; question: string; state: "pass" | "hold" | "stop" | "idle"; line: string };

export function buildGates(report: Report): Gate[] {
  const base = [
    { name: "Who controls it", question: "Can someone mint, upgrade or drain it on their own?" },
    { name: "Is the code safe", question: "Does the contract hold when someone attacks it?" },
    { name: "Can you get in and out", question: "Is there liquidity for your size, at a fair price?" },
  ];
  const sev = (ids: string[]): Gate["state"] => {
    const hits = report.findings.filter((f) => ids.some((id) => f.id.includes(id)));
    return hits.some((f) => f.severity === "high") ? "stop" : hits.some((f) => f.severity === "medium") ? "hold" : "pass";
  };
  const script = report.target === "script";
  if (report.summaryOnly) {
    const say = (ids: string[]) => report.findings.filter((f) => ids.some((id) => f.id.includes(id))).map((f) => f.title).join("; ") || "No rule fired in the saved read. Re-run live for full detail.";
    return [
      { ...base[0], state: sev(["mint", "top1", "top10", "admin", "unknown", "young", "registry"]), line: say(["mint", "top1", "top10", "registry", "young"]) },
      { ...base[1], state: "idle", line: "Re-run live to read the policy script." },
      { ...base[2], state: sev(["liquidity"]), line: say(["liquidity"]) },
    ];
  }
  const control = script
    ? `${report.contract?.knownProtocol || "Not a recognised protocol script"}${report.contract?.firstSeen ? `, live since ${formatDay(report.contract.firstSeen)}` : ""}.`
    : report.policy.mintOpen
      ? `The mint policy is a ${report.policy.scriptType} script with ${report.policy.requiredSigners} signer${report.policy.requiredSigners === 1 ? "" : "s"} and no time lock: more can be minted.`
      : `Minting closed${report.policy.timelockedBefore ? ` since ${formatDay(report.policy.timelockedBefore)}` : ""}. The largest wallet holds ${pct(report.holders.top1Pct)} of supply.`;
  const code = script
    ? `${report.contract?.scriptType || "Script"}${report.contract?.scriptSizeBytes ? `, ${report.contract.scriptSizeBytes} bytes` : ""}. Send its Aiken source to the Security Reviewer for exploit-tested findings.`
    : report.policy.scriptType === "native" ? "Native policy: there is no program to attack." : "Plutus policy: send its source to the Security Reviewer.";
  const exit = script
    ? `${ada(report.contract?.tvlAda || 0)} ADA locked here.`
    : `${ada(report.liquidity.totalTvlAda)} ADA of DEX liquidity across ${report.liquidity.pools.length} pool${report.liquidity.pools.length === 1 ? "" : "s"}.`;
  return [
    { ...base[0], state: sev(["mint", "top1", "top10", "admin", "unknown", "young", "registry"]), line: control },
    { ...base[1], state: script ? "hold" : "pass", line: code },
    { ...base[2], state: sev(["liquidity"]), line: exit },
  ];
}
