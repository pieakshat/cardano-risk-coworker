import { RULES, verdict, verdictLabel } from "./rules.ts";
import type { Fetcher, Finding, RiskReport } from "./types.ts";

const KOIOS = "https://api.koios.rest/api/v1";
const MINSWAP = "https://api-mainnet-prod.minswap.org";
const REGISTRY = "https://tokens.cardano.org/metadata";
const BLOCKFROST = "https://cardano-mainnet.blockfrost.io/api/v0";
const now = () => new Date().toISOString();
const MAINNET_SYSTEM_START = 1596059091;
const MAINNET_BYRON_SLOTS = 4_492_800;
const registryValue = (value: any) => value && typeof value === "object" && "value" in value ? value.value : value;

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve as pathResolve } from "node:path";
import knownScripts from "./known-scripts.json";

// ponytail: file cache keyed by URL+body, 6h TTL; Koios asset_addresses takes ~55 s for large tokens (measured on MIN), so repeat Tasks must not refetch
const CACHE_DIR = process.env.VERCEL ? "/tmp/risk-engine-cache/" : `${process.cwd().endsWith("/web") ? pathResolve(process.cwd(), "../engine/cache") : pathResolve(process.cwd(), "engine/cache")}/`;
const CACHE_TTL_MS = 6 * 3600_000;
// The repo cache ships with the Vercel bundle (outputFileTracingIncludes); /tmp starts empty on every cold instance.
const BUNDLED_CACHE_DIR = `${process.cwd().endsWith("/web") ? pathResolve(process.cwd(), "../engine/cache") : pathResolve(process.cwd(), "engine/cache")}/`;
const readCache = (file: string): { at: number; body: unknown } | null => { try { return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null; } catch { return null; } };
const json = async (fetcher: Fetcher, url: string, init?: RequestInit) => {
  const key = createHash("sha256").update(url + String(init?.body ?? "")).digest("hex").slice(0, 32);
  const file = `${CACHE_DIR}${key}.json`;
  const hit = fetcher === fetch ? readCache(file) ?? readCache(`${BUNDLED_CACHE_DIR}${key}.json`) : null;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  const slow = url.includes("/asset_addresses");
  try {
    const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(slow ? 120_000 : 30_000) });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    const body = await response.json();
    if (fetcher === fetch) { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(file, JSON.stringify({ at: Date.now(), body })); }
    return body;
  } catch (error) {
    // ponytail: stale-if-error; a slow or failing upstream serves the last observed answer instead of failing the whole analysis.
    if (hit) { console.warn(`stale cache for ${url.split("?")[0]} from ${new Date(hit.at).toISOString()}: ${error instanceof Error ? error.message : error}`); return hit.body; }
    throw error;
  }
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

function paymentScriptHash(address: string): string | undefined {
  const bytes = bech32Data(address);
  if (!bytes || bytes.length < 29 || ![1, 3, 5, 7].includes(bytes[0] >> 4)) return undefined;
  return Buffer.from(bytes.slice(1, 29)).toString("hex");
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

const isScriptInput = (input: string) => /^(addr(?:_test)?1[0-9a-z]+|[0-9a-f]{56})$/i.test(input.trim());

export function unknownScriptFinding(known: boolean, tvlAda: number): Finding | undefined {
  return !known && tvlAda > RULES.unknownScriptTvlAda ? { id: "unknown-script-value", severity: "medium", title: "Unknown contract holds significant value", evidence: `tvlAda=${tvlAda.toFixed(2)}; Blockfrost address totals` } : undefined;
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
    const body = await request(ctx, `minswap_search_${parts.ticker.toUpperCase()}`, `${MINSWAP}/v1/assets/metrics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ term: parts.ticker, limit: 20, only_verified: true }) });
    let match = (body.asset_metrics ?? []).find((row: any) => String(row.asset?.metadata?.ticker ?? "").toUpperCase() === parts.ticker!.toUpperCase());
    if (!match) {
      const fallback = await request(ctx, `minswap_search_unverified_${parts.ticker.toUpperCase()}`, `${MINSWAP}/v1/assets/metrics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ term: parts.ticker, limit: 100, only_verified: false }) });
      match = (fallback.asset_metrics ?? []).find((row: any) => String(row.asset?.metadata?.ticker ?? "").toUpperCase() === parts.ticker!.toUpperCase());
    }
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
  // Blockfrost returns the largest holders first in ~0.2 s (measured on MIN); Koios has no quantity ordering and took ~55 s
  const blockfrost = process.env.BLOCKFROST_API_KEY_MAINNET;
  if (blockfrost && !ctx.fixtureDir && ctx.fetcher === fetch) {
    const top = await request(ctx, `blockfrost_asset_addresses_${policyId}${assetName}`, `${BLOCKFROST}/assets/${policyId}${assetName}/addresses?count=100&page=1&order=desc`, { headers: { project_id: blockfrost } });
    if (Array.isArray(top)) return top.map((row: any) => ({ payment_address: row.address, quantity: row.quantity }));
  }
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
  const scriptType = row?.type === "native" || row?.type === "timelock" || script?.type === "all" || script?.type === "sig" || script?.type === "any" || script?.type === "atLeast" ? "native" : row ? "plutus" : "unknown";
  return { scriptType, ...policyState(script, scriptType) } as const;
}

export async function analyzeWith(fetcher: Fetcher, input: string, fixtureDir?: string): Promise<RiskReport> {
  if (isScriptInput(input)) return analyzeScriptWith(fetcher, input, fixtureDir);
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
  const hasReliableHolders = Boolean(process.env.BLOCKFROST_API_KEY_MAINNET && !fixtureDir && fetcher === fetch);
  const concentration = hasReliableHolders
    ? { ...holderConcentration(addressRows.map((row: any) => ({ address: String(row.payment_address ?? row.address ?? ""), quantity: BigInt(row.quantity ?? 0) })), supply), sampled: true }
    : { count: 0, top1Pct: 0, top10Pct: 0, scriptHeldPct: 0, sampled: false };
  const liquidity = poolRows as RiskReport["liquidity"]["pools"];
  const identity = registry && typeof registry === "object" && registry.name ? { registryName: registryValue(registry.name), ticker: registryValue(registry.ticker), decimals: registryValue(registry.decimals), url: registryValue(registry.url), inRegistry: true } : { inRegistry: false };
  const findings: Finding[] = [];
  if (policyData.mintOpen) findings.push({ id: "mint-open", severity: "high", title: "Mint policy remains open", evidence: `scriptType=${policyData.scriptType}, requiredSigners=${policyData.requiredSigners}; Koios script_info` });
  if (policyData.scriptType === "plutus") findings.push({ id: "mint-policy-plutus", severity: "medium", title: "Mint policy is programmable", evidence: "scriptType=plutus; Koios script_info" });
  if (!hasReliableHolders) findings.push({ id: "holders-unknown", severity: "medium", title: "Holder concentration is unavailable", evidence: "Blockfrost largest-holder data was not available; Koios asset_addresses is not quantity ordered" });
  else if (top1IsHigh(concentration.top1Pct)) findings.push({ id: "top1", severity: "high", title: "One non-script holder controls over 30%", evidence: `top1Pct=${concentration.top1Pct.toFixed(2)}%; Blockfrost asset addresses` });
  if (hasReliableHolders && concentration.top10Pct > RULES.top10MediumPct) findings.push({ id: "top10", severity: "medium", title: "Top ten non-script holders control over 70%", evidence: `top10Pct=${concentration.top10Pct.toFixed(2)}%; Blockfrost asset addresses` });
  if (!identity.inRegistry) findings.push({ id: "registry", severity: "medium", title: "Token is absent from the Cardano token registry", evidence: `unit=${resolved.unit}; tokens.cardano.org/metadata` });
  const totalTvlAda = liquidity.reduce((total, pool) => total + pool.tvlAda, 0);
  if (totalTvlAda < RULES.lowLiquidityAda) findings.push({ id: "liquidity", severity: "medium", title: "Minswap liquidity is below 10,000 ADA", evidence: `totalTvlAda=${totalTvlAda.toFixed(2)}; Minswap pools/metrics` });
  const firstSeen = new Date(Number(asset.creation_time) * 1000).toISOString();
  if (Date.now() - Date.parse(firstSeen) < RULES.youngTokenDays * 86_400_000) findings.push({ id: "young", severity: "medium", title: "Token is younger than 30 days", evidence: `firstSeen=${firstSeen}; Koios asset_info` });
  const score = verdict(findings);
  return { input, target: "token", unit: resolved.unit, policyId: resolved.policyId, assetNameAscii: asset.asset_name_ascii ?? hexAscii(asset.asset_name), fingerprint: asset.fingerprint, identity, policy: { scriptType: policyData.scriptType, ...(policyData.timelock ? { timelockedBefore: slotToTime(policyData.timelock) } : {}), requiredSigners: policyData.requiredSigners, mintOpen: policyData.mintOpen }, supply: { total: String(asset.total_supply), mintTxCount: Number(asset.mint_cnt ?? 0), burnTxCount: Number(asset.burn_cnt ?? 0) }, holders: concentration, liquidity: { pools: liquidity, totalTvlAda }, activity: { firstSeen }, findings, verdict: score, verdictLabel: verdictLabel(score), sources: ctx.sources };
}

async function analyzeScriptWith(fetcher: Fetcher, input: string, fixtureDir?: string): Promise<RiskReport> {
  const ctx: Context = { fetcher, fixtureDir, sources: [] };
  const address = input.startsWith("addr") ? input : undefined;
  const hash = address ? paymentScriptHash(address) : input.toLowerCase();
  if (!hash) throw new Error(`Unable to derive payment script hash from ${input}`);
  const info = (await request(ctx, `script_info_${hash}`, `${KOIOS}/script_info`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ _script_hashes: [hash] }) }))[0] ?? {};
  const scriptHash = hash;
  const blockfrostKey = process.env.BLOCKFROST_API_KEY_MAINNET;
  const [utxos, txs, script] = await Promise.all([
    address ? request(ctx, `address_utxos_${address}`, `${KOIOS}/address_utxos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ _addresses: [address] }) }) : Promise.resolve([]),
    address ? request(ctx, `address_txs_${address}`, `${KOIOS}/address_txs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ _addresses: [address] }) }) : Promise.resolve([]),
    Promise.resolve(info),
  ]);
  const totals = address && blockfrostKey
    ? await request(ctx, `blockfrost_address_${address}`, `${BLOCKFROST}/addresses/${address}` , { headers: { project_id: blockfrostKey } })
    : undefined;
  const rows = Array.isArray(utxos) ? utxos : [];
  const assets = new Map<string, bigint>();
  let lovelace = 0n;
  for (const row of rows) {
    const value = row.value ?? row.asset_list ?? {};
    if (Array.isArray(value)) for (const asset of value) asset.asset === "lovelace" ? lovelace += BigInt(asset.quantity ?? 0) : assets.set(asset.asset ?? asset.unit, (assets.get(asset.asset ?? asset.unit) ?? 0n) + BigInt(asset.quantity ?? 0));
    else lovelace += BigInt(value.lovelace ?? row.value?.lovelace ?? 0);
  }
  if (totals?.amount) {
    lovelace = 0n;
    assets.clear();
    for (const asset of totals.amount) asset.unit === "lovelace" ? lovelace = BigInt(asset.quantity) : assets.set(asset.unit, BigInt(asset.quantity));
  }
  const txTimes = (Array.isArray(txs) ? txs : []).map((row: any) => row.block_time ?? row.block_time_epoch).filter(Boolean).map(Number);
  const firstSeen = txTimes.length ? new Date(Math.min(...txTimes) * 1000).toISOString() : "unknown";
  const scriptType = info.type ?? script.type ?? (info.script ? "plutus" : "unknown");
  const known = knownScript(scriptHash);
  const tvlAda = Number(lovelace) / 1_000_000;
  const findings: Finding[] = [];
  const unknownValueFinding = unknownScriptFinding(Boolean(known), tvlAda);
  if (unknownValueFinding) findings.push(unknownValueFinding);
  if (firstSeen !== "unknown" && Date.now() - Date.parse(firstSeen) < RULES.youngScriptDays * 86_400_000) findings.push({ id: "young-script", severity: "medium", title: "Script is younger than 30 days", evidence: `firstSeen=${firstSeen}; Koios address_txs` });
  if (known) findings.push({ id: "known-protocol", severity: "info", title: `Known protocol: ${known.protocol}`, evidence: known.source });
  const adminKeyCount = Number(script.admin_key_count ?? script.required_signers ?? 0);
  if (adminKeyCount === 1) findings.push({ id: "single-admin-key", severity: "high", title: "Datum exposes a single admin key", evidence: "admin_key_count=1; Koios script_info datum fields" });
  const score = verdict(findings);
  return { input, target: "script", unit: scriptHash, policyId: scriptHash, assetNameAscii: known?.protocol ?? "Plutus script", fingerprint: "", identity: { inRegistry: false }, policy: { scriptType: scriptType.startsWith("native") || scriptType === "timelock" ? "native" : scriptType.startsWith("plutus") ? "plutus" : "unknown", requiredSigners: adminKeyCount, mintOpen: false }, supply: { total: "0", mintTxCount: 0, burnTxCount: 0 }, holders: { count: 0, top1Pct: 0, top10Pct: 0, scriptHeldPct: 0, sampled: false }, liquidity: { pools: [], totalTvlAda: tvlAda }, activity: { firstSeen, tx24h: Array.isArray(txs) ? txs.length : 0 }, contract: { address, scriptHash, scriptType, scriptSizeBytes: script.script_size ?? script.size ?? (script.bytes ? script.bytes.length / 2 : undefined), firstSeen, tvlAda, topAssets: [...assets.entries()].sort((a, b) => a[1] > b[1] ? -1 : 1).slice(0, 5).map(([unit, quantity]) => ({ unit, quantity: String(quantity) })), utxoCount: rows.length >= RULES.holderPageSize ? `at least ${rows.length}` : rows.length, recentTxCount: Array.isArray(txs) ? txs.length : 0, ...(known ? { knownProtocol: known.protocol } : {}), ...(adminKeyCount ? { adminKeyCount } : {}) }, findings, verdict: score, verdictLabel: verdictLabel(score), sources: ctx.sources };
}

function knownScript(hash: string): { protocol: string; source: string } | undefined {
  return knownScripts.find((entry) => entry.scriptHashes?.includes(hash));
}

type NativeScript = { type?: string; slot?: number; required?: number; scripts?: NativeScript[] };

function minimumSigners(script: NativeScript | undefined): number {
  if (!script) return 0;
  if (script.type === "sig") return 1;
  const children = script.scripts ?? [];
  if (script.type === "all") return children.reduce((sum, child) => sum + minimumSigners(child), 0);
  if (script.type === "any") return children.length ? Math.min(...children.map(minimumSigners)) : 0;
  if (script.type === "atLeast") return children.map(minimumSigners).sort((a, b) => a - b).slice(0, script.required ?? 0).reduce((sum, value) => sum + value, 0);
  return children.length ? minimumSigners(children[0]) : 0;
}

function beforeSlot(script: NativeScript | undefined): number | undefined {
  if (!script) return undefined;
  const slots = [script.type === "before" ? script.slot : undefined, ...(script.scripts ?? []).map(beforeSlot)].filter((slot): slot is number => slot !== undefined);
  return slots.length ? Math.min(...slots) : undefined;
}

export function slotToTime(slot: number): string {
  return new Date((MAINNET_SYSTEM_START + (Number(slot) - MAINNET_BYRON_SLOTS)) * 1000).toISOString();
}

export function policyState(script: NativeScript | undefined, scriptType: "native" | "plutus" | "unknown") {
  if (scriptType !== "native") return { requiredSigners: 0, timelock: undefined, mintOpen: false };
  const requiredSigners = minimumSigners(script);
  const timelock = beforeSlot(script);
  const lockOpen = timelock !== undefined && Date.parse(slotToTime(timelock)) > Date.now();
  return { requiredSigners, timelock, mintOpen: lockOpen || (timelock === undefined && requiredSigners < 2) };
}

export function analyze(input: string): Promise<RiskReport> {
  return analyzeWith(fetch, input, process.env.RISK_FIXTURES ? `${import.meta.dir}/fixtures` : undefined);
}
