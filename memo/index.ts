import type { RiskReport } from "./types";
import { numbersAreGrounded } from "./number-validator";

const model = process.env.MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";
const fallbackModel = "nvidia/nemotron-3-ultra-550b-a55b:free";

const round = (n: number, digits = 2) => Number(n.toFixed(digits));
const ada = (n: number) => Math.round(n).toLocaleString("en-US");

// Plain-language meaning of each rule id, so a buyer understands why a finding matters.
const MEANING: Record<string, string> = {
  "mint-open": "Whoever holds the policy key can mint more of this token at any time, diluting every holder.",
  "recent-mint": "New supply was minted after launch.",
  top1: "One wallet holds enough supply to move the price on its own.",
  top10: "A handful of wallets control most of the supply.",
  registry: "The token is not in the Cardano token registry, so its name and ticker are unverified.",
  liquidity: "There is little liquidity, so selling a meaningful amount moves the price sharply.",
  age: "The token is new and has little track record.",
};

// The only numbers the memo may use: rounded once here, so the LLM and the validator see the same values.
export function memoFacts(r: RiskReport) {
  const pools = [...r.liquidity.pools].sort((a, b) => b.tvlAda - a.tvlAda);
  return {
    verdict: r.verdictLabel ?? ({ LOW: "INTERACT", MEDIUM: "INTERACT WITH CONDITIONS", HIGH: "DO NOT INTERACT" } as const)[r.verdict],
    token: { name: r.identity.registryName ?? r.assetNameAscii, ticker: r.identity.ticker ?? r.assetNameAscii, unit: r.unit, inRegistry: r.identity.inRegistry },
    minting: { scriptType: r.policy.scriptType, mintOpen: r.policy.mintOpen, requiredSigners: r.policy.requiredSigners, timelockedBefore: r.policy.timelockedBefore ?? null },
    holders: { addressesSampled: r.holders.count, sampled: r.holders.sampled, source: "Blockfrost mainnet, largest holders first", top1Pct: round(r.holders.top1Pct), top10Pct: round(r.holders.top10Pct), heldByContractsPct: round(r.holders.scriptHeldPct) },
    liquidity: { totalTvlAda: ada(r.liquidity.totalTvlAda), poolCount: pools.length, largestPools: pools.slice(0, 3).map((p) => ({ dex: p.dex, pair: p.pair, tvlAda: ada(p.tvlAda) })) },
    redFlags: r.findings.map((f) => ({ severity: f.severity, title: f.title, meaning: MEANING[f.id] ?? "", evidence: f.evidence })),
  };
}

function prompt(facts: ReturnType<typeof memoFacts>, retry = false): string {
  return `${retry ? "Your previous answer used a number that is not in the facts. " : ""}You are a Cardano risk analyst writing for a buyer deciding whether to interact with this contract. Write ONE paragraph of 2 to 4 sentences, no headings, no lists: state INTERACT, INTERACT WITH CONDITIONS, or DO NOT INTERACT, explain the strongest reason, then what would change the verdict. Use ONLY these facts and copy any number exactly as written. Plain words, no hype, no field names.\n\nFACTS:\n${JSON.stringify(facts, null, 1)}`;
}

function deterministicMemo(r: RiskReport, facts = memoFacts(r)): string {
  const flags = facts.redFlags.length
    ? facts.redFlags.map((f) => `- **${f.title}** (${f.severity}). ${f.meaning} Evidence: ${f.evidence}`).join("\n")
    : "- None of the checks fired.";
  const pools = facts.liquidity.largestPools.map((p) => `${p.pair} on ${p.dex} (${p.tvlAda} ADA)`).join(", ");
  const minting = facts.minting.mintOpen
    ? `The minting policy is a ${facts.minting.scriptType} script with ${facts.minting.requiredSigners} required signer${facts.minting.requiredSigners === 1 ? "" : "s"} and no time lock, so more can be minted.`
    : `Minting is closed${facts.minting.timelockedBefore ? ` (time lock passed ${facts.minting.timelockedBefore})` : ""}; supply cannot grow.`;
  const holders = `${facts.holders.sampled ? `Among the ${facts.holders.addressesSampled} largest holder addresses (${facts.holders.source}), ` : ""}the largest wallet holds ${facts.holders.top1Pct}% of supply, the top 10 hold ${facts.holders.top10Pct}%, and contracts such as DEX pools hold ${facts.holders.heldByContractsPct}%.`;
  return `## Verdict\n**${facts.verdict}**. ${facts.redFlags[0] ? facts.redFlags[0].meaning : "No red flag fired on mint control, holder concentration, registry status, liquidity or age."}\n\n## What this token is\n${facts.token.name} (${facts.token.ticker})${facts.token.inRegistry ? ", listed in the Cardano token registry" : ", not in the Cardano token registry"}. Unit \`${facts.token.unit}\`.\n\n## Who controls minting\n${minting}\n\n## Who holds it\n${holders}\n\n## Can you exit\n${facts.liquidity.totalTvlAda} ADA of liquidity across ${facts.liquidity.poolCount} pools. Largest: ${pools || "none"}.\n\n## Red flags\n${flags}\n\n## Sources\n${r.sources.map((s) => `- ${s.call} (${s.at})`).join("\n")}`;
}

async function askOpenRouter(facts: ReturnType<typeof memoFacts>, retry: boolean): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://cardano-risk-coworker.vercel.app", "X-Title": "Cardano Risk Analyst" },
    body: JSON.stringify({ model, models: [model, fallbackModel], max_tokens: 1200, temperature: 0, messages: [{ role: "user", content: prompt(facts, retry) }] }),
    // reasoning models spend most of their budget thinking; 30 s cut them off and forced the template every time
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no memo");
  return content.trim();
}

export async function writeMemo(r: RiskReport): Promise<{ markdown: string; json: RiskReport; author: "model" | "template" }> {
  const facts = memoFacts(r);
  try {
    let view = await askOpenRouter(facts, false);
    if (!numbersAreGrounded(view, facts)) view = await askOpenRouter(facts, true);
    if (!numbersAreGrounded(view, facts) || view.includes("#")) throw new Error("analyst view rejected");
    return { markdown: `## Analyst view\n${view}\n\n${deterministicMemo(r, facts)}`, json: r, author: "model" };
  } catch {
    return { markdown: deterministicMemo(r, facts), json: r, author: "template" };
  }
}
