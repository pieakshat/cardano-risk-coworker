import { analyze } from "../engine/engine.ts";

export const PREPROD_KOIOS = "https://preprod.koios.rest/api/v1";
export const MINSWAP_V2_POOL = "addr_test1zrtt4xm4p84vse3g3l6swtf2rqs943t0w39ustwdszxt3l5rajt8r8wqtygrfduwgukk73m5gcnplmztc5tl5ngy0upqhns793";
export const TUSDM_UNIT = "11c93226aabf1e9157620857d9ac013ba111680bd837f62a7ca90214" + "0014df10745553444d";
const ADA = "lovelace";

export type QuoteInput = { holdAsset: string; payAsset: string; payAmount: string | bigint; maxPriceImpactPct?: number; highRiskVerdict?: "HIGH" | "MEDIUM" | "LOW" };
export type PoolReserves = { txHash: string; txIndex: number; holdReserve: bigint; payReserve: bigint; feeNumerator: bigint; feeDenominator: bigint };

const unit = (asset: string) => asset === "ADA" || asset === "lovelace" ? ADA : asset.toLowerCase().replace(".", "");
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function amountInForExactOut(payAmount: bigint, holdReserve: bigint, payReserve: bigint, feeNumerator = 30n, feeDenominator = 10_000n): bigint {
  if (payAmount <= 0n || holdReserve <= 0n || payReserve <= payAmount) throw new Error("invalid reserves or requested amount");
  return ceilDiv(payAmount * holdReserve * feeDenominator, (payReserve - payAmount) * (feeDenominator - feeNumerator));
}

export function quotePriceImpact(input: bigint, output: bigint, holdReserve: bigint, payReserve: bigint): number {
  const spot = Number(payReserve) / Number(holdReserve);
  const execution = Number(output) / Number(input);
  return (1 - execution / spot) * 100;
}

async function koios(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (process.env.KAIOS_KEY) headers.set("authorization", `Bearer ${process.env.KAIOS_KEY}`);
  const response = await fetch(`${PREPROD_KOIOS}${path}`, { ...init, headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Koios ${path} returned HTTP ${response.status}`);
  return response.json();
}

function reserve(row: any, wanted: string): bigint {
  if (wanted === ADA) return BigInt(row.value);
  return BigInt(row.asset_list?.find((x: any) => `${x.policy_id}${x.asset_name}`.toLowerCase() === wanted)?.quantity ?? 0);
}

export async function readPoolReserves(holdAsset: string, payAsset: string): Promise<PoolReserves> {
  const rows = await koios("/address_utxos", { method: "POST", body: JSON.stringify({ _addresses: [MINSWAP_V2_POOL] }) }) as any[];
  const hold = unit(holdAsset); const pay = unit(payAsset);
  const row = rows.find((candidate) => reserve(candidate, hold) > 0n && reserve(candidate, pay) > 0n && candidate.inline_datum);
  if (!row) throw new Error(`no live Minswap V2 preprod pool for ${holdAsset}/${payAsset}`);
  const fields = row.inline_datum?.value?.fields ?? [];
  const feeNumerator = BigInt(fields.at(-3)?.int ?? 30);
  const feeDenominator = 10_000n;
  const holdReserve = reserve(row, hold); const payReserve = reserve(row, pay);
  return { txHash: row.tx_hash, txIndex: Number(row.tx_index), holdReserve, payReserve, feeNumerator, feeDenominator };
}

function mainnetTwin(asset: string): string | undefined {
  const map = process.env.MAINNET_TWIN_UNITS?.split(",").map((x) => x.split("=")) ?? [];
  return map.find(([testnet]) => testnet.toLowerCase() === unit(asset))?.[1];
}

export async function quote(input: QuoteInput) {
  const payAmount = BigInt(input.payAmount);
  const reserves = await readPoolReserves(input.holdAsset, input.payAsset);
  const requiredInput = amountInForExactOut(payAmount, reserves.holdReserve, reserves.payReserve, reserves.feeNumerator, reserves.feeDenominator);
  const priceImpactPct = quotePriceImpact(requiredInput, payAmount, reserves.holdReserve, reserves.payReserve);
  const maxPriceImpactPct = input.maxPriceImpactPct ?? 3;
  if (priceImpactPct > maxPriceImpactPct) throw new Error(`unsafe price impact ${priceImpactPct.toFixed(4)}% > ${maxPriceImpactPct}%`);
  const twin = mainnetTwin(input.payAsset);
  const risk = twin ? await analyze(twin) : undefined;
  if (risk && risk.verdict === (input.highRiskVerdict ?? "HIGH")) throw new Error(`unsafe pay asset risk verdict ${risk.verdict}`);
  return { ...input, payAmount: payAmount.toString(), requiredInput: requiredInput.toString(), priceImpactPct, feeNumerator: reserves.feeNumerator.toString(), feeDenominator: reserves.feeDenominator.toString(), pool: reserves, mainnetTwin: twin ?? null, risk: risk ?? "testnet asset, no mainnet risk data" };
}

if (import.meta.main) {
  const [holdAsset = "ADA", payAsset = TUSDM_UNIT, payAmount = "1000000"] = Bun.argv.slice(2);
  console.log(JSON.stringify(await quote({ holdAsset, payAsset, payAmount }), (_, value) => typeof value === "bigint" ? value.toString() : value, 2));
}
