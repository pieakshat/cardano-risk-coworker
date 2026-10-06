import type { RiskReport } from "./types";
import { numbersAreGrounded } from "./number-validator";

const model = process.env.MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";
const fallbackModel = "nvidia/nemotron-3-ultra-550b-a55b:free";

function prompt(report: RiskReport, retry = false): string {
  return `${retry ? "Previous output was rejected because it contained an ungrounded number. " : ""}Write a factual risk memo from only this RiskReport JSON. Quote every number exactly as it appears in the JSON and add no facts. Use exactly these headings: Verdict, What this token is, Who controls minting, Who holds it, Can you exit (liquidity), Red flags, Sources. Keep it concise.\n\n${JSON.stringify(report)}`;
}

function deterministicMemo(report: RiskReport): string {
  const findings = report.findings.length
    ? report.findings.map((finding) => `- ${finding.title}: ${finding.evidence}`).join("\n")
    : "- No findings were recorded.";
  const pools = report.liquidity.pools.length
    ? report.liquidity.pools.map((pool) => `${pool.dex} (${pool.pair}, ${pool.tvlAda} ADA)`).join(", ")
    : "No pools were recorded.";
  const sources = report.sources.map((source) => `- ${source.call} (${source.at})`).join("\n");
  return `## Verdict\n${report.verdict}\n\n## What this token is\n${report.assetNameAscii} (${report.unit})${report.identity.registryName ? ` is identified as ${report.identity.registryName}.` : "."}\n\n## Who controls minting\nThe policy is ${report.policy.scriptType}; minting is ${report.policy.mintOpen ? "open" : "closed"}.\n\n## Who holds it\n${report.holders.sampled ? `In a sample of the first ${report.holders.count} holder addresses Koios returned, the top` : `The report records ${report.holders.count} holders. The top`} 1 holds ${report.holders.top1Pct}% and the top 10 hold ${report.holders.top10Pct}%.\n\n## Can you exit (liquidity)\nRecorded liquidity is ${report.liquidity.totalTvlAda} ADA across ${pools}.\n\n## Red flags\n${findings}\n\n## Sources\n${sources}`;
}

async function askOpenRouter(report: RiskReport, retry: boolean): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const signal = AbortSignal.timeout(30_000);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cardano-risk-coworker.local",
      "X-Title": "Cardano Risk Analyst",
    },
    body: JSON.stringify({
      model,
      models: [model, fallbackModel],
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: "user", content: prompt(report, retry) }],
    }),
    signal,
  });
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no memo");
  return content.trim();
}

export async function writeMemo(r: RiskReport): Promise<{ markdown: string; json: RiskReport }> {
  let markdown: string;
  try {
    markdown = await askOpenRouter(r, false);
    if (!numbersAreGrounded(markdown, r)) {
      markdown = await askOpenRouter(r, true);
    }
    if (!numbersAreGrounded(markdown, r)) throw new Error("OpenRouter memo contains an ungrounded number");
  } catch {
    markdown = deterministicMemo(r);
  }
  return { markdown, json: r };
}
