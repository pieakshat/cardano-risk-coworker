import { ExactCardanoScheme } from "@x402/cardano/exact/client";
import { toClientCardanoSigner } from "@x402/cardano";
import { x402Client } from "@x402/core/client";
import { Constr, Data, Lucid, Koios, generateSeedPhrase, getAddressDetails, mintingPolicyToId, type LucidEvolution } from "@lucid-evolution/lucid";
import { scriptFromNative } from "@lucid-evolution/utils";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL(".", import.meta.url);
const walletPath = process.env.RECOURSE_WALLETS ?? "/Users/user/Desktop/canton/recourse/.wallets.json";
const wallets = JSON.parse(readFileSync(walletPath, "utf8")) as Record<string, { seed: string }>;
const koiosUrl = "https://preprod.koios.rest/api/v1";
const koiosKey = process.env.KAIOS_KEY;
const originalFetch = globalThis.fetch;
if (koiosKey) globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => { const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url; if (!url.startsWith(koiosUrl)) return originalFetch(input, init); const headers = new Headers(init?.headers); headers.set("Authorization", `Bearer ${koiosKey}`); return originalFetch(input, { ...init, headers }); }) as typeof fetch;

async function lucidFor(actor: string): Promise<LucidEvolution> { const lucid = await Lucid(new Koios(koiosUrl), "Preprod"); lucid.selectWallet.fromSeed(wallets[actor]!.seed); return lucid; }
async function confirmed(txHash: string): Promise<void> {
  const deadline = Date.now() + 300_000;
  for (;;) { const response = await fetch(`${koiosUrl}/tx_status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ _tx_hashes: [txHash] }) }); const rows = await response.json() as Array<{ num_confirmations: number | null }>; if ((rows[0]?.num_confirmations ?? 0) >= 1) return; if (Date.now() >= deadline) throw new Error(`confirmation timeout for ${txHash}`); await Bun.sleep(5_000); }
}

type TokenRecord = { unit: string; policyId: string; assetNameHex: string; sellerAddress: string; mintTx: string };
async function ensureToken(): Promise<TokenRecord> {
  const path = new URL("./token.json", root);
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")) as TokenRecord;
  const admin = await lucidFor("admin1");
  const sellerSeed = generateSeedPhrase();
  const seller = await Lucid(new Koios(koiosUrl), "Preprod"); seller.selectWallet.fromSeed(sellerSeed); const sellerAddress = await seller.wallet().address();
  const keyHash = getAddressDetails(await admin.wallet().address()).paymentCredential?.hash; if (!keyHash) throw new Error("admin1 payment key missing");
  const policy = scriptFromNative({ type: "sig", keyHash });
  const policyId = mintingPolicyToId(policy);
  const assetNameHex = Buffer.from("RISK").toString("hex");
  const unit = policyId + assetNameHex;
  const tx = await admin.newTx().mintAssets({ [unit]: 5n }, Data.to(new Constr(0, []))).attach.MintingPolicy(policy).pay.ToAddress(sellerAddress, { [unit]: 5n }).complete();
  const mintTx = await (await tx.sign.withWallet().complete()).submit(); await confirmed(mintTx);
  const record = { unit, policyId, assetNameHex, sellerAddress, mintTx };
  writeFileSync(path, JSON.stringify(record, null, 2), { mode: 0o600 });
  return record;
}

type Step = Record<string, unknown>;
async function main(): Promise<void> {
  const token = await ensureToken();
  const client = new x402Client();
  client.setSpendControls(false);
  client.register("cardano:preprod", new ExactCardanoScheme(toClientCardanoSigner({ mnemonic: wallets.buyer!.seed, network: "cardano:preprod", provider: { koios: { baseUrl: koiosUrl } } })));
  const sellers = [{ name: "A", url: process.env.SELLER_A_URL ?? "http://127.0.0.1:4403/" }, { name: "B", url: process.env.SELLER_B_URL ?? "http://127.0.0.1:4404/" }];
  const steps: Step[] = [{ step: "mint", mintTx: token.mintTx, unit: token.unit, sellerAddress: token.sellerAddress }];
  const riskUrl = process.env.RISK_DESK_URL ?? "http://127.0.0.1:4402/api/x402/risk-check";
  const riskDeadline = Date.now() + 300_000;
  while (true) { try { const probe = await fetch(riskUrl); if ([200, 402, 405].includes(probe.status)) break; } catch {} if (Date.now() >= riskDeadline) throw new Error("Risk Desk x402 route did not appear before timeout"); await Bun.sleep(2_000); }
  for (const seller of sellers) {
    const quote = await fetch(seller.url); if (quote.status !== 402) throw new Error(`seller ${seller.name} expected 402, got ${quote.status}`); const quoteBody = await quote.json();
    steps.push({ step: "seller_quote", seller: seller.name, status: quote.status, accepts: quoteBody.accepts });
    const sellerRequirement = quoteBody.accepts?.[0];
    const riskInput = { target: sellerRequirement?.payTo, x402: sellerRequirement, paymentRequired: quoteBody, maxAmount: sellerRequirement?.amount, resource: quoteBody.resource };
    const riskQuote = await fetch(riskUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(riskInput) });
    if (riskQuote.status !== 402) throw new Error(`risk desk expected 402 for seller ${seller.name}, got ${riskQuote.status}`);
    const riskPayment = await client.createPaymentPayload(await riskQuote.json() as never);
    const paidRisk = await fetch(riskUrl, { method: "POST", headers: { "content-type": "application/json", "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(riskPayment)).toString("base64") }, body: JSON.stringify(riskInput) });
    if (!paidRisk.ok) throw new Error(`risk desk payment failed for seller ${seller.name}: ${paidRisk.status} ${await paidRisk.text()}`);
    const assessment = await paidRisk.json() as { decision?: string; verdictLabel?: string; blockingReasons?: string[]; [key: string]: unknown }; const riskTx = paidRisk.headers.get("payment-response");
    const assessmentTx = riskTx ? JSON.parse(Buffer.from(riskTx, "base64").toString()).transaction : undefined;
    if (assessmentTx) await confirmed(assessmentTx);
    steps.push({ step: "risk_check", seller: seller.name, paymentTx: assessmentTx, assessment });
    const decision = assessment.decision ?? assessment.verdictLabel;
    assessment.decision = decision;
    if (seller.name === "A" && decision === "DO_NOT_INTERACT") throw new Error("Risk Desk rejected Seller A; demo requires the established ADA seller to be payable");
    if (seller.name === "B" && decision !== "DO_NOT_INTERACT") throw new Error("Risk Desk did not reject Seller B's open-policy token");
    if (decision === "DO_NOT_INTERACT") { steps.push({ step: "seller_refused", seller: seller.name, reason: assessment.blockingReasons }); continue; }
    const sellerPayment = await client.createPaymentPayload(quoteBody as never);
    const paidSeller = await fetch(seller.url, { headers: { "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(sellerPayment)).toString("base64") }});
    if (!paidSeller.ok) throw new Error(`seller ${seller.name} payment failed: ${paidSeller.status} ${await paidSeller.text()}`);
    const sellerResponse = await paidSeller.json(); steps.push({ step: "seller_payment", seller: seller.name, paymentTx: sellerResponse.transaction }); await confirmed(sellerResponse.transaction);
  }
  for (const step of steps) for (const key of ["mintTx", "paymentTx", "assessmentTx"]) if (typeof step[key] === "string") await confirmed(step[key] as string);
  let narration: string | undefined;
  if (process.env.OPENROUTER_API_KEY) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model: "nvidia/nemotron-3-super-120b-a12b:free", max_tokens: 800, messages: [{ role: "user", content: `Narrate this Cardano risk demo in three concise sentences. The assessment is authoritative, and seller B must not be paid.\n${JSON.stringify(steps)}` }] }) });
    if (response.ok) narration = ((await response.json()) as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
  }
  const output = join(new URL("./runs/", root).pathname, `${Date.now()}.json`); mkdirSync(join(new URL("./runs/", root).pathname), { recursive: true }); writeFileSync(output, JSON.stringify({ network: "preprod", riskDesk: riskUrl, token, steps, narration }, null, 2)); console.log(output);
}

if (import.meta.main) {
  if (process.argv[2] === "--mint-only") {
    const record = await ensureToken();
    console.log(JSON.stringify({ mintTx: record.mintTx, unit: record.unit, sellerAddress: record.sellerAddress }));
  } else await main();
}
