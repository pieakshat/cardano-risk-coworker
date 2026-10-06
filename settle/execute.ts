import type { Asset } from "@minswap/sdk";
import { ExactCardanoScheme, toClientCardanoSigner } from "@x402/cardano";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { quote, TUSDC_UNIT } from "./quote.ts";
import wallets from "/Users/user/Desktop/canton/recourse/.wallets.json" with { type: "json" };

const KOIOS = process.env.KOIOS_URL ?? "https://preprod.koios.rest/api/v1";
const fail = (message: string): never => { throw new Error(message); };

async function txStatus(txHash: string) {
  const response = await fetch(`${KOIOS}/tx_status`, { method: "POST", headers: { "content-type": "application/json", ...(process.env.KAIOS_KEY ? { authorization: `Bearer ${process.env.KAIOS_KEY}` } : {}) }, body: JSON.stringify({ _tx_hashes: [txHash] }) });
  if (!response.ok) return false;
  return Number((await response.json() as any[])[0]?.num_confirmations ?? 0) >= 1;
}
async function waitTx(txHash: string, deadline: number) { while (Date.now() < deadline) { if (await txStatus(txHash)) return; await Bun.sleep(5000); } fail(`timed out waiting for ${txHash}`); }

export async function execute() {
  const blockfrost = process.env.BLOCKFROST_API_KEY_PREPROD ?? fail("BLOCKFROST_API_KEY_PREPROD is required by @minswap/sdk 0.5.0 to build the preprod order");
  const { DexV2, ADA, OrderV2 } = await import("@minswap/sdk");
  const { Lucid, Blockfrost } = await import("@spacebudz/lucid");
  const buyerSeed = (wallets as any).buyer.seed as string;
  const lucid = new Lucid({ provider: new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", blockfrost), network: "Preprod" });
  lucid.selectWalletFromSeed(buyerSeed);
  const sender = await lucid.wallet.address();
  const started = Date.now();
  const payAsset = process.env.SETTLE_PAY_ASSET ?? TUSDC_UNIT;
  const q = await quote({ holdAsset: "ADA", payAsset, payAmount: process.env.SETTLE_PAY_AMOUNT ?? "10000" });
  const adapter = { currentSlot: async () => 0 } as any;
  const dex = new DexV2(lucid, adapter);
  const order = await dex.createBulkOrdersTx({ sender, orderOptions: [{ type: OrderV2.StepType.SWAP_EXACT_IN, lpAsset: q.pool.lpAsset, assetIn: ADA, amountIn: BigInt(q.requiredInput), minimumAmountOut: BigInt(q.payAmount), direction: OrderV2.Direction.A_TO_B, killOnFailed: true, isLimitOrder: true }] });
  const orderTx = await (await order.sign().commit()).submit();
  await waitTx(orderTx, Date.now() + 120_000);
  const fillStarted = Date.now();
  let fillTx = "";
  while (Date.now() < started + 900_000) {
    const utxos = await lucid.utxosAt(sender);
    const received = utxos.some((u: any) => (u.assets[payAsset.replace(".", "")] ?? 0n) >= BigInt(q.payAmount));
    if (received) { fillTx = (await fetch(`${KOIOS}/address_txs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ _addresses: [sender] }) }).then((r) => r.json()) as any[])[0]?.tx_hash ?? "unknown"; break; }
    await Bun.sleep(10_000);
  }
  if (!fillTx) fail("Minswap order was not filled within 15 minutes");
  await waitTx(fillTx, Date.now() + 120_000);
  const seller = process.env.SETTLE_SELLER_ADDRESS ?? fail("SETTLE_SELLER_ADDRESS is required");
  const client = new x402HTTPClient(new x402Client().setSpendControls(false).register("cardano:preprod", new ExactCardanoScheme(toClientCardanoSigner({ mnemonic: buyerSeed, network: "cardano:preprod", provider: { koios: { baseUrl: KOIOS, token: process.env.KAIOS_KEY } } }))));
  const sellerUrl = process.env.SETTLE_SELLER_URL ?? `http://127.0.0.1:${process.env.SETTLE_SELLER_PORT ?? 4927}/`;
  const response = await fetch(sellerUrl, { headers: { "x-settle-seller": seller } });
  if (response.status === 402) {
    const payment = client.getPaymentRequiredResponse((name) => response.headers.get(name), await response.clone().json());
    const payload = await client.createPaymentPayload(payment);
    const headers = client.encodePaymentSignatureHeader(payload);
    const paidResponse = await fetch(response.url, { headers });
    if (paidResponse.status !== 200) fail(`x402 seller returned HTTP ${paidResponse.status}: ${await paidResponse.text()}`);
    return { orderTx, fillTx, paymentTx: (await paidResponse.json() as any).settlement, quotedInput: q.requiredInput, rate: `${q.payAmount}/${q.requiredInput}`, timingsMs: { orderToSubmitted: Date.now() - started, fill: Date.now() - fillStarted } };
  }
  if (response.status !== 200) fail(`x402 seller returned HTTP ${response.status}`);
  return { orderTx, fillTx, paymentTx: (await response.json() as any).settlement, quotedInput: q.requiredInput, rate: `${q.payAmount}/${q.requiredInput}`, timingsMs: { orderToSubmitted: Date.now() - started, fill: Date.now() - fillStarted } };
}
