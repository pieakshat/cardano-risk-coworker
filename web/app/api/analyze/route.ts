import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { analyze, analyzeWith } from "../../../../engine/engine";
import { writeMemo } from "../../../../memo";

export const runtime = "nodejs";
export const maxDuration = 55;

const units = {
  MIN: "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e",
  SNEK: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
} as const;

async function recorded(url: string, init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}"));
  const query = new URL(url).searchParams;
  const unit = query.get("_asset_fingerprint") ?? (body._asset_policy && body._asset_name ? body._asset_policy + body._asset_name : undefined) ?? body._script_hashes?.[0];
  const key = Object.entries(units).find(([, value]) => url.includes(value) || unit === value)?.[0]?.toLowerCase() ?? "min";
  const kind = url.includes("/asset_info") ? "asset_info" : url.includes("/asset_addresses") ? "asset_addresses-0" : url.includes("/script_info") ? "script_info" : url.includes("/pools/metrics") ? "pools" : url.includes("tokens.cardano.org") ? "registry" : "";
  if (!kind) throw new Error(`No recorded response for ${url}`);
  const file = await readFile(join(process.cwd(), "../engine/fixtures", `${key}-${kind}.json`));
  return new Response(file, { status: 200, headers: { "content-type": "application/json" } });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { input?: unknown };
  const input = typeof body.input === "string" ? body.input.trim() : "";

  if (!input) {
    return NextResponse.json({ error: "Enter a policy id, unit, ticker, or fingerprint." }, { status: 400 });
  }

  try {
    const work = process.env.RISK_FIXTURES ? analyzeWith(recorded, input) : analyze(input);
    const report = await Promise.race([
      work,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("ANALYSIS_TIMEOUT")), 50_000)),
    ]);
    const memo = await writeMemo(report);
    return NextResponse.json(memo);
  } catch (error) {
    if (error instanceof Error && error.message === "ANALYSIS_TIMEOUT") {
      return NextResponse.json({ error: "Live analysis timed out. The stored report is still available." }, { status: 504 });
    }
    console.error("risk analysis failed", error);
    return NextResponse.json({ error: "The token could not be analysed. Check the identifier and try again." }, { status: 502 });
  }
}
