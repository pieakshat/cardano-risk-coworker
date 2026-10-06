import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decodeCardanoTransaction } from "@x402/cardano";
import { decodePaymentSignatureHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactCardanoScheme } from "@x402/cardano/exact/facilitator";
import { toFacilitatorCardanoSigner } from "@x402/cardano";
import { RISK_DESK_PAY_TO } from "./payto";

type StoredDelivery = { assessment: unknown; paymentResponse: unknown };
const deliveryPath = "/tmp/cardano-risk-x402-deliveries.json";
const deliveries = new Map<string, StoredDelivery>();
let loaded = false;

async function loadDeliveries(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const stored = JSON.parse(await readFile(deliveryPath, "utf8")) as Record<string, StoredDelivery>;
    for (const [txId, delivery] of Object.entries(stored)) deliveries.set(txId, delivery);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function saveDelivery(txId: string, delivery: StoredDelivery): Promise<void> {
  deliveries.set(txId, delivery);
  await writeFile(deliveryPath, JSON.stringify(Object.fromEntries(deliveries)), { mode: 0o600 });
}

function facilitator(): x402Facilitator {
  const signer = toFacilitatorCardanoSigner({
    network: "cardano:preprod",
    provider: {
      koios: { baseUrl: process.env.KOIOS_URL ?? "https://preprod.koios.rest/api/v1", token: process.env.KAIOS_KEY },
      requestTimeoutMs: 120_000,
    },
    awaitConfirmation: true,
  });
  return new x402Facilitator().register("cardano:preprod", new ExactCardanoScheme(signer));
}

function txIdFromPayment(header: string): string {
  const payment = decodePaymentSignatureHeader(header) as { payload?: { transaction?: string } };
  const transaction = payment.payload?.transaction;
  if (!transaction) throw new Error("payment payload has no transaction");
  return decodeCardanoTransaction(transaction).txHash;
}

export function termsHash(requirements: unknown): string {
  const canonical = JSON.stringify(requirements, (_, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
  });
  return createHash("blake2b512").update(canonical).digest("hex").slice(0, 64);
}

export async function settleOnce(header: string, requirements: Record<string, unknown>): Promise<{ txId: string; cached?: StoredDelivery; paymentResponse?: unknown }> {
  await loadDeliveries();
  const txId = txIdFromPayment(header);
  const cached = deliveries.get(txId);
  if (cached) return { txId, cached, paymentResponse: cached.paymentResponse };

  const payment = decodePaymentSignatureHeader(header);
  const instance = facilitator();
  const verified = await instance.verify(payment as never, requirements as never);
  if (!verified.isValid) throw new Error(`payment rejected: ${verified.invalidReason ?? "invalid"}`);
  const deadline = Date.now() + 240_000;
  for (;;) {
    const settled = await instance.settle(payment as never, requirements as never);
    if (settled.success) return { txId, paymentResponse: settled };
    if (!(["settlement_pending", "exact_cardano_settlement_not_confirmed"] as string[]).includes(settled.errorReason ?? "") || Date.now() >= deadline) {
      throw new Error(`payment settlement failed: ${settled.errorReason ?? "failed"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

export async function recordDelivery(txId: string, assessment: unknown, paymentResponse: unknown): Promise<void> {
  await saveDelivery(txId, { assessment, paymentResponse });
}

export { encodePaymentResponseHeader, RISK_DESK_PAY_TO };
