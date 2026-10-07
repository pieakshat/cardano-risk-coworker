import { toClientCardanoSigner } from "@x402/cardano";
import { readFileSync, writeFileSync } from "node:fs";
import { guardedPay, RefusedPayment, type GuardWallet } from "./index.ts";

const koios = "https://preprod.koios.rest/api/v1";
const walletFile = "/Users/user/Desktop/canton/recourse/.wallets.json";
const wallets = JSON.parse(readFileSync(walletFile, "utf8")) as Record<string, { seed: string }>;
const wallet = (seed: string): GuardWallet => ({ mnemonic: seed, network: "cardano:preprod", provider: { koios: { baseUrl: koios, token: process.env.KAIOS_KEY } } });
const buyer = wallet(wallets.buyer!.seed);
const relayer = toClientCardanoSigner(wallet(wallets.relayer!.seed)).getAddress();
const riskUrl = "https://cardano-risk-coworker.vercel.app/api/x402/risk-check";

async function status(tx: string): Promise<number> {
  const response = await fetch(`${koios}/tx_status`, { method: "POST", headers: { "content-type": "application/json", ...(process.env.KAIOS_KEY ? { authorization: `Bearer ${process.env.KAIOS_KEY}` } : {}) }, body: JSON.stringify({ _tx_hashes: [tx] }) });
  if (!response.ok) throw new Error(`Koios tx_status failed: ${response.status}`);
  return Number(((await response.json()) as Array<{ num_confirmations?: number }>)[0]?.num_confirmations ?? 0);
}

async function confirmed(tx: string): Promise<number> {
  const deadline = Date.now() + 300_000;
  for (;;) {
    const confirmations = await status(tx);
    if (confirmations >= 1) return confirmations;
    if (Date.now() >= deadline) throw new Error(`Koios confirmation timeout for ${tx}`);
    await Bun.sleep(5_000);
  }
}

async function main() {
  const results: Record<string, unknown>[] = [];
  for (const seller of [{ name: "A", url: "http://127.0.0.1:4403/" }, { name: "B", url: "http://127.0.0.1:4404/" }]) {
    const quote = await fetch(seller.url);
    if (quote.status !== 402) throw new Error(`seller ${seller.name} expected 402, got ${quote.status}`);
    try {
      const result = await guardedPay(await quote.json(), { wallet: buyer, maxAmount: "10000000", riskUrl });
      results.push({ seller: seller.name, paid: true, verdict: result.verdict.decision, riskCheckTx: result.riskCheckTx, sellerTx: result.sellerTx, riskConfirmations: await confirmed(result.riskCheckTx), sellerConfirmations: await confirmed(result.sellerTx) });
    } catch (error) {
      if (!(error instanceof RefusedPayment)) throw error;
      results.push({ seller: seller.name, paid: false, verdict: error.verdict.decision, ruleIds: error.ruleIds, riskCheckTx: error.riskCheckTx, riskConfirmations: error.riskCheckTx ? await confirmed(error.riskCheckTx) : 0, sellerTx: null });
    }
  }
  const proof = { network: "cardano:preprod", endpoint: riskUrl, relayerAddress: relayer, results, verifiedAt: new Date().toISOString() };
  writeFileSync(new URL("./LIVE-PROOF.json", import.meta.url), JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

await main();
