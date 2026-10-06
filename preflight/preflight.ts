import { analyze } from "../engine/engine.ts";
import { decision, evidenceScore } from "./score.ts";
import { termsHash } from "./hash.ts";
import type { Assessment, Evidence, PaymentFacts, PaymentInput, PreflightDeps, PreflightInput } from "./types.ts";

const KOIOS: Record<"mainnet" | "preprod", string> = {
  mainnet: "https://api.koios.rest/api/v1",
  preprod: "https://preprod.koios.rest/api/v1",
};
const source = (network: "mainnet" | "preprod", path: string) => `${KOIOS[network]}${path}`;

async function request(network: "mainnet" | "preprod", path: string, init: RequestInit, deps: Required<PreflightDeps>): Promise<any> {
  const file = deps.fixtureDir && `${deps.fixtureDir}/${path.replace(/[^a-zA-Z0-9]+/g, "_")}.json`;
  if (file && await Bun.file(file).exists()) return Bun.file(file).json();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (process.env.KAIOS_KEY) headers.set("authorization", `Bearer ${process.env.KAIOS_KEY}`);
  const response = await deps.fetcher(source(network, path), { ...init, headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Koios ${path} returned HTTP ${response.status}`);
  return response.json();
}

function defaults(deps: PreflightDeps): Required<PreflightDeps> {
  return { fetcher: deps.fetcher ?? fetch, fixtureDir: deps.fixtureDir ?? "", now: deps.now ?? (() => new Date().toISOString()) };
}

function firstSeen(facts: PaymentFacts): string | undefined {
  const explicit = facts.addressInfo?.[0]?.first_seen ?? facts.addressInfo?.[0]?.first_seen_time;
  const times = facts.txs.map((row) => row.block_time ?? row.block_time_epoch).filter(Boolean).map(Number);
  return explicit ? new Date(Number(explicit) * 1000).toISOString() : times.length ? new Date(Math.min(...times) * 1000).toISOString() : undefined;
}

function scriptAddress(address: string): boolean {
  const separator = address.lastIndexOf("1");
  if (separator < 1) return false;
  const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const values = [...address.slice(separator + 1, -6)].map((char) => alphabet.indexOf(char));
  if (values.some((value) => value < 0)) return false;
  let acc = 0; let bits = 0; const bytes: number[] = [];
  for (const value of values) { acc = (acc << 5) | value; bits += 5; while (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 255); } }
  return bytes.length > 0 && [1, 3, 5, 7].includes(bytes[0] >> 4);
}

function scriptHash(address: string): string | undefined {
  if (!scriptAddress(address)) return undefined;
  const separator = address.lastIndexOf("1");
  const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const values = [...address.slice(separator + 1, -6)].map((char) => alphabet.indexOf(char));
  let acc = 0; let bits = 0; const bytes: number[] = [];
  for (const value of values) { acc = (acc << 5) | value; bits += 5; while (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 255); } }
  return Buffer.from(bytes.slice(1, 29)).toString("hex");
}

async function paymentFacts(input: PaymentInput, deps: Required<PreflightDeps>): Promise<PaymentFacts> {
  const network = input.network.slice("cardano:".length) as "mainnet" | "preprod";
  const body = JSON.stringify({ _addresses: [input.payTo] });
  const [addressInfo, txs, utxos] = await Promise.all([
    request(network, "/address_info", { method: "POST", body }, deps),
    request(network, "/address_txs", { method: "POST", body }, deps),
    request(network, "/address_utxos", { method: "POST", body }, deps),
  ]);
  const hash = scriptHash(input.payTo);
  const script = hash ? (await request(network, "/script_info", { method: "POST", body: JSON.stringify({ _script_hashes: [hash] }) }, deps))[0] : undefined;
  const assetUnit = input.asset && input.asset !== "lovelace" ? input.asset.replace(".", "").toLowerCase() : undefined;
  const asset = assetUnit ? (await request(network, "/asset_info", { method: "POST", body: JSON.stringify({ _asset_policy: assetUnit.slice(0, 56), _asset_name: assetUnit.slice(56) }) }, deps))[0] : undefined;
  const assetPolicy = assetUnit ? (await request(network, "/script_info", { method: "POST", body: JSON.stringify({ _script_hashes: [assetUnit.slice(0, 56)] }) }, deps))[0] : undefined;
  return { addressInfo, txs: Array.isArray(txs) ? txs : [], utxos: Array.isArray(utxos) ? utxos : [], script, asset, assetPolicy };
}

function assessPayment(input: PaymentInput, facts: PaymentFacts, now: string): Assessment {
  const network = input.network.slice("cardano:".length) as "mainnet" | "preprod";
  const evidence: Evidence[] = [];
  const blockingReasons: string[] = [];
  const conditions: string[] = [];
  const ruleIds: string[] = [];
  const seen = firstSeen(facts);
  const txCount = facts.txs.length;
  const isScript = Boolean(facts.script);
  evidence.push({ rule: "counterparty-credential", value: isScript ? "script" : "key", source: source(network, isScript ? "/script_info" : "/address_info") });
  evidence.push({ rule: "counterparty-tx-count", value: String(txCount), source: source(network, "/address_txs") });
  if (seen) evidence.push({ rule: "counterparty-first-seen", value: seen, source: source(network, "/address_txs") });
  if (!seen || Date.now() - Date.parse(seen) < 24 * 60 * 60 * 1000) { conditions.push("counterparty-first-seen"); ruleIds.push("counterparty-first-seen"); }
  if (txCount < 3) { conditions.push("counterparty-tx-count"); ruleIds.push("counterparty-tx-count"); }
  if (isScript && !facts.script?.protocol && !facts.script?.known_protocol) { conditions.push("script-unknown-protocol"); ruleIds.push("script-unknown-protocol"); }
  const amount = BigInt(input.amount);
  const maxAmount = BigInt(input.maxAmount);
  evidence.push({ rule: "amount-within-cap", value: `${input.amount}/${input.maxAmount}`, source: "caller-supplied maxAmount" });
  if (amount > maxAmount) { blockingReasons.push("amount-over-cap"); ruleIds.push("amount-over-cap"); }
  if (input.resource && !input.resource.startsWith("https://")) { blockingReasons.push("resource-not-https"); ruleIds.push("resource-not-https"); }
  if (input.maxTimeoutSeconds !== undefined && (input.maxTimeoutSeconds <= 0 || input.maxTimeoutSeconds > 3600)) { conditions.push("timeout-insane"); ruleIds.push("timeout-insane"); }
  if (input.asset && input.asset !== "lovelace") {
    const policy = facts.asset?.policy_id;
    const script = facts.assetPolicy;
    const open = facts.asset?.mint_cnt > 0 && !script?.value?.slot && !(script?.value?.scripts ?? []).some((item: any) => item.type === "sig");
    evidence.push({ rule: "asset-mint-policy", value: `${policy ?? "unknown"}:${open ? "open" : "controlled"}`, source: source(network, "/asset_info") });
    if (open) { blockingReasons.push("asset-mint-open"); ruleIds.push("asset-mint-open"); }
  } else evidence.push({ rule: "asset-mint-policy", value: "lovelace", source: "Cardano native asset" });
  return { decision: decision(blockingReasons, conditions), evidenceScore: evidenceScore(ruleIds), blockingReasons, conditions, evidence, subject: { kind: "x402_payment", network, payTo: input.payTo, asset: input.asset ?? "lovelace", amount: input.amount, resource: input.resource }, checkedAt: now, termsHash: termsHash(input.terms ?? { scheme: "exact", network: input.network, amount: input.amount, asset: input.asset ?? "lovelace", payTo: input.payTo, maxTimeoutSeconds: input.maxTimeoutSeconds, extra: {} }) };
}

export async function preflight(input: PreflightInput, deps: PreflightDeps = {}): Promise<Assessment> {
  const resolved = defaults(deps);
  if (input.type === "x402_payment") return assessPayment(input, await paymentFacts(input, resolved), resolved.now());
  const report = await analyze(input.input);
  return { decision: report.verdictLabel === "INTERACT" ? "INTERACT" : report.verdictLabel === "DO NOT INTERACT" ? "DO_NOT_INTERACT" : "INTERACT_WITH_CONDITIONS", evidenceScore: report.verdict === "LOW" ? 100 : report.verdict === "MEDIUM" ? 70 : 30, blockingReasons: report.verdict === "HIGH" ? report.findings.filter((finding) => finding.severity === "high").map((finding) => finding.id) : [], conditions: report.verdict === "MEDIUM" ? report.findings.filter((finding) => finding.severity === "medium").map((finding) => finding.id) : [], evidence: report.findings.map((finding) => ({ rule: finding.id, value: finding.evidence, source: finding.evidence.split(";").at(-1)?.trim() ?? "engine" })), subject: { kind: input.type, network: input.network }, checkedAt: resolved.now() };
}

export { canonicalJson, termsHash } from "./hash.ts";
