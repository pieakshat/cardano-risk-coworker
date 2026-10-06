import { RULES, verdict } from "./rules.ts";
import type { Fetcher, Finding, RiskReport } from "./types.ts";

const KOIOS = "https://api.koios.rest/api/v1";
const MINSWAP = "https://api-mainnet-prod.minswap.org";
const REGISTRY = "https://tokens.cardano.org/metadata";
const now = () => new Date().toISOString();
const MAINNET_SYSTEM_START = Date.parse("2020-07-29T21:44:51Z");
const registryValue = (value: any) => value && typeof value === "object" && "value" in value ? value.value : value;

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// ponytail: file cache keyed by URL+body, 6h TTL; Koios asset_addresses takes ~55 s for large tokens (measured on MIN), so repeat Tasks must not refetch
const CACHE_DIR = new URL("./cache/", import.meta.url).pathname;
const CACHE_TTL_MS = 6 * 3600_000;
const json = async (fetcher: Fetcher, url: string, init?: RequestInit) => {
  const key = createHash("sha256").update(url + String(init?.body ?? "")).digest("hex").slice(0, 32);
  const file = `${CACHE_DIR}${key}.json`;
  if (fetcher === fetch && existsSync(file)) {
    const hit = JSON.parse(readFileSync(file, "utf8"));
    if (Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  }
  const slow = url.includes("/asset_addresses");
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(slow ? 120_000 : 30_000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const body = await response.json();
  if (fetcher === fetch) { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(file, JSON.stringify({ at: Date.now(), body })); }
  return body;
};

function hexAscii(value: string): string {
  try { return decodeURIComponent(value.replace(/(..)/g, "%$1")); } catch { return ""; }
}

function bech32Data(address: string): Uint8Array | null {
  const separator = address.lastIndexOf("1");
  if (separator < 1) return null;
  const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const values = [...address.slice(separator + 1, -6)].map((char) => alphabet.indexOf(char));
  if (values.some((value) => value < 0)) return null;
  let acc = 0; let bits = 0; const bytes: number[] = [];
  for (const value of values) {
    acc = (acc << 5) | value; bits += 5;
    while (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 255); }
  }
  return Uint8Array.from(bytes);
}

function isScriptAddress(address: string): boolean {
  const bytes = bech32Data(address);
  return bytes ? [1, 3, 5, 7].includes(bytes[0] >> 4) : false;
}

export function holderConcentration(rows: Array<{ address: string; quantity: bigint }>, supply: bigint) {
  const ranked = rows.filter((row) => row.quantity > 0n).sort((a, b) => a.quantity > b.quantity ? -1 : 1);
  const nonScripts = ranked.filter((row) => !isScriptAddress(row.address));
  const denominator = Number(supply || 1n);
  const sum = (items: typeof ranked) => items.reduce((total, row) => total + Number(row.quantity), 0);
  return { count: new Set(nonScripts.map((row) => row.address)).size, top1Pct: sum(nonScripts.slice(0, 1)) / denominator * 100, top10Pct: sum(nonScripts.slice(0, 10)) / denominator * 100, scriptHeldPct: sum(ranked.filter((row) => isScriptAddress(row.address))) / denominator * 100 };
}

export const top1IsHigh = (top1Pct: number) => top1Pct > RULES.top1HighPct;

function inputParts(input: string): { unit?: string; fingerprint?: string; ticker?: string } {
  const value = input.trim();
  if (/^[0-9a-f]{56,}$/i.test(value)) return { unit: value.toLowerCase() };
  if (/^asset1[0-9a-z]+$/i.test(value)) return { fingerprint: value };
  const [policy, name] = value.split(".");
  if (/^[0-9a-f]{56}$/i.test(policy) && /^[0-9a-f]*$/i.test(name ?? "")) return { unit: value.toLowerCase().replace(".", "") };
  return { ticker: value };
}

type Context = { fetcher: Fetcher; fixtureDir?: string; sources: Array<{ call: string; at: string }> };

async function request(ctx: Context, call: string, url: string, init?: RequestInit): Promise<any> {
  ctx.sources.push({ call, at: now() });
  if (ctx.fixtureDir) {
    const path = `${ctx.fixtureDir}/${call.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`;
    const file = Bun.file(path);
    if (await file.exists()) return file.json();
  }
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  if (url.startsWith(KOIOS) && process.env.KAIOS_KEY) headers.set("authorization", `Bearer ${process.env.KAIOS_KEY}`);
  return json(ctx.fetcher, url, { ...init, headers });
}

async function resolve(ctx: Context, input: string) {
  const parts = inputParts(input);
  if (parts.ticker) {
    const body = await request(ctx, `minswap_search_${parts.ticker.toUpperCase()}`, `${MINSWAP}/v1/assets/metrics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ term: parts.ticker, limit: 20, only_verified: false }) });
    const assets = body.asset_metrics ?? [];
    const match = assets.find((row: any) => String(row.asset?.metadata?.ticker ?? "").toUpperCase() === parts.ticker!.toUpperCase()) ?? assets[0];
    if (!match) throw new Error(`Unable to resolve ticker ${input}`);
    parts.unit = `${match.asset.currency_symbol}${match.asset.token_name}`.toLowerCase();
  }
  let info: any[];
  if (parts.fingerprint) info = await request(ctx, `asset_info_fingerprint_${parts.fingerprint}`, `${KOIOS}/asset_info?_asset_fingerprint=${encodeURIComponent(parts.fingerprint)}`);
  else info = await request(ctx, `asset_info_${parts.unit}`, `${KOIOS}/asset_info`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ _asset_policy: parts.unit!.slice(0, 56), _asset_name: parts.unit!.slice(56) }) });
  const asset = info[0];
  if (!asset) throw new Error(`Asset not found: ${input}`);
  return { unit: `${asset.policy_id}${asset.asset_name}`, asset, policyId: asset.policy_id };
}

async function holders(ctx: Context, policyId: string, assetName: string) {
  const rows: any[] = [];
  for (let page = 0; page < RULES.holderPageCap; page++) {
    const start = page * RULES.holderPageSize;
    const end = start + RULES.holderPageSize - 1;
    const batch = await request(ctx, `asset_addresses_${policyId}_${assetName}_${page}`, `${KOIOS}/asset_addresses?_asset_policy=${policyId}&_asset_name=${assetName}`, { headers: { Range: `${start}-${end}` } });
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < RULES.holderPageSize) break;
  }
  return rows;
}

async function pools(ctx: Context, unit: string) {
  const body = await request(ctx, `minswap_pools_${unit}`, `${MINSWAP}/v1/pools/metrics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ term: unit, limit: 100, only_verified: false, sort_field: "liquidity", sort_direction: "desc" }) });
  return (body.pool_metrics ?? []).filter((pool: any) => [pool.asset_a, pool.asset_b].some((asset: any) => `${asset.currency_symbol}${asset.token_name}`.toLowerCase() === unit)).map((pool: any) => {
    const other = [pool.asset_a, pool.asset_b].find((asset: any) => `${asset.currency_symbol}${asset.token_name}`.toLowerCase() !== unit);
    return { dex: "Minswap", tvlAda: Number(pool.liquidity_currency ?? 0), pair: `${other?.metadata?.ticker ?? other?.metadata?.name ?? "ADA"}/${pool.asset_a === other ? pool.asset_b?.metadata?.ticker ?? "TOKEN" : pool.asset_a?.metadata?.ticker ?? "ADA"}` };
  });
}

async function policy(ctx: Context, policyId: string) {
  const scriptRows = await request(ctx, `script_info_${policyId}`, `${KOIOS}/script_info`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ _script_hashes: [policyId] }) });
  const row = scriptRows?.[0];
  const script = row?.script ?? row?.script_json ?? row?.value;
  const requiredSigners = script?.scripts?.filter((item: any) => item.type === "sig").length ?? (script?.type === "sig" ? 1 : 0);
  const timelock = script?.scripts?.find((item: any) => item.type === "before")?.slot;
  return { scriptType: row?.type === "native" || row?.type === "timelock" || script?.type === "all" || script?.type === "sig" ? "native" : row ? "plutus" : "unknown", requiredSigners, timelock } as const;
}

export async function analyzeWith(fetcher: Fetcher, input: string, fixtureDir?: string): Promise<RiskReport> {
  const ctx: Context = { fetcher, fixtureDir, sources: [] };
  const resolved = await resolve(ctx, input);
  const asset = resolved.asset;
  const [registry, addressRows, policyData, poolRows] = await Promise.all([
    request(ctx, `registry_${resolved.unit}`, `${REGISTRY}/${resolved.unit}`),
    holders(ctx, resolved.policyId, asset.asset_name),
    policy(ctx, resolved.policyId),
    pools(ctx, resolved.unit),
  ]);
  const supply = BigInt(asset.total_supply ?? 0);
  const concentration = { ...holderConcentration(addressRows.map((row: any) => ({ address: String(row.payment_address ?? row.address ?? ""), quantity: BigInt(row.quantity ?? 0) })), supply), sampled: addressRows.length >= RULES.holderPageSize * RULES.holderPageCap };
  const liquidity = poolRows as RiskReport["liquidity"]["pools"];
  const identity = registry && typeof registry === "object" && registry.name ? { registryName: registryValue(registry.name), ticker: registryValue(registry.ticker), decimals: registryValue(registry.decimals), url: registryValue(registry.url), inRegistry: true } : { inRegistry: false };
  const findings: Finding[] = [];
  if (!policyData.timelock && policyData.requiredSigners < 2) findings.push({ id: "mint-open", severity: "high", title: "Mint policy remains open", evidence: `scriptType=${policyData.scriptType}, requiredSigners=${policyData.requiredSigners}; Koios script_info` });
  if (top1IsHigh(concentration.top1Pct)) findings.push({ id: "top1", severity: "high", title: "One non-script holder controls over 30%", evidence: `top1Pct=${concentration.top1Pct.toFixed(2)}%; Koios asset_addresses` });
  if (concentration.top10Pct > RULES.top10MediumPct) findings.push({ id: "top10", severity: "medium", title: "Top ten non-script holders control over 70%", evidence: `top10Pct=${concentration.top10Pct.toFixed(2)}%; Koios asset_addresses` });
  if (!identity.inRegistry) findings.push({ id: "registry", severity: "medium", title: "Token is absent from the Cardano token registry", evidence: `unit=${resolved.unit}; tokens.cardano.org/metadata` });
  const totalTvlAda = liquidity.reduce((total, pool) => total + pool.tvlAda, 0);
  if (totalTvlAda < RULES.lowLiquidityAda) findings.push({ id: "liquidity", severity: "medium", title: "Minswap liquidity is below 10,000 ADA", evidence: `totalTvlAda=${totalTvlAda.toFixed(2)}; Minswap pools/metrics` });
  const firstSeen = new Date(Number(asset.creation_time) * 1000).toISOString();
  if (Date.now() - Date.parse(firstSeen) < RULES.youngTokenDays * 86_400_000) findings.push({ id: "young", severity: "medium", title: "Token is younger than 30 days", evidence: `firstSeen=${firstSeen}; Koios asset_info` });
  return { input, unit: resolved.unit, policyId: resolved.policyId, assetNameAscii: asset.asset_name_ascii ?? hexAscii(asset.asset_name), fingerprint: asset.fingerprint, identity, policy: { scriptType: policyData.scriptType, ...(policyData.timelock ? { timelockedBefore: new Date(MAINNET_SYSTEM_START + Number(policyData.timelock) * 1000).toISOString() } : {}), requiredSigners: policyData.requiredSigners, mintOpen: !policyData.timelock }, supply: { total: String(asset.total_supply), mintTxCount: Number(asset.mint_cnt ?? 0), burnTxCount: Number(asset.burn_cnt ?? 0) }, holders: concentration, liquidity: { pools: liquidity, totalTvlAda }, activity: { firstSeen }, findings, verdict: verdict(findings), sources: ctx.sources };
}

export function analyze(input: string): Promise<RiskReport> {
  return analyzeWith(fetch, input, process.env.RISK_FIXTURES ? `${import.meta.dir}/fixtures` : undefined);
}
