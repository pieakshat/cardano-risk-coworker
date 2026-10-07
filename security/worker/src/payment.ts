import { createHash, randomBytes } from "node:crypto";
import { env } from "./config.ts";

export type Payment = Record<string, unknown>;

const mps = (path: string, init: RequestInit = {}) => {
  const base = env("MPS_URL", "http://127.0.0.1:3012/api/v1");
  return fetch(`${base}${path}`, {
  ...init,
  headers: { "content-type": "application/json", token: env("MPS_API_TOKEN"), ...(init.headers ?? {}) },
  signal: AbortSignal.timeout(20_000),
  });
};

async function json(path: string, init: RequestInit = {}): Promise<Payment> {
  const response = await mps(path, init);
  const body = await response.json() as Payment;
  if (!response.ok) throw new Error(`MPS HTTP ${response.status}`);
  return body;
}

export function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }

function blockchainIdentifier(payment: Payment): string {
  const data = payment.data && typeof payment.data === "object" ? payment.data as Payment : payment;
  const value = data.blockchainIdentifier;
  if (typeof value !== "string" || !value) throw new Error("MPS payment did not return blockchainIdentifier");
  return value;
}

export async function createPayment(input: string): Promise<Payment> {
  const now = Date.now();
  const minutes = (name: string, fallback: number) => Number(env(name, String(fallback))) * 60_000;
  const identifierFromPurchaser = randomBytes(10).toString("hex");
  const payment = await json("/payment", { method: "POST", body: JSON.stringify({
    network: "Preprod",
    paymentSourceType: env("MPS_PAYMENT_SOURCE_TYPE", "Web3CardanoV2"),
    supportedPaymentSourceIndex: Number(env("MPS_PAYMENT_SOURCE_INDEX", "0")),
    agentIdentifier: env("MPS_AGENT_IDENTIFIER"),
    inputHash: sha256(input),
    identifierFromPurchaser,
    payByTime: new Date(now + minutes("MPS_PAY_BY_MINUTES", 20)).toISOString(),
    submitResultTime: new Date(now + minutes("MPS_SUBMIT_RESULT_MINUTES", 45)).toISOString(),
    unlockTime: new Date(now + minutes("MPS_UNLOCK_MINUTES", 60)).toISOString(),
    externalDisputeUnlockTime: new Date(now + minutes("MPS_EXTERNAL_DISPUTE_MINUTES", 75)).toISOString(),
  }) });
  const data = payment.data && typeof payment.data === "object" ? payment.data as Payment : payment;
  const funds = Array.isArray(data.RequestedFunds) ? data.RequestedFunds : [];
  const sellerVkey = (data.SmartContractWallet as Payment | undefined)?.walletVkey;
  return { ...payment, data: { ...data, network: "Preprod", identifierFromPurchaser, sellerVkey, Amounts: funds, supportedPaymentSourceIndex: Number(env("MPS_PAYMENT_SOURCE_INDEX", "0")) } };
}

export async function submitResult(payment: Payment, result: string): Promise<Payment> {
  return json("/payment/submit-result", { method: "POST", body: JSON.stringify({
    network: "Preprod", blockchainIdentifier: blockchainIdentifier(payment), submitResultHash: sha256(result),
  }) });
}

export async function waitForPayment(payment: Payment, timeoutMs = 10 * 60_000): Promise<Payment> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await json("/payment/resolve-blockchain-identifier", { method: "POST", body: JSON.stringify({
      network: "Preprod", blockchainIdentifier: blockchainIdentifier(payment), includeHistory: "true",
    }) });
    const state = String(((current.data ?? current) as Payment).onChainState ?? "");
    if (["FundsLocked", "ResultSubmitted", "WithdrawAuthorized", "Withdrawn", "DisputedWithdrawn"].includes(state)) return current;
    if (["RefundWithdrawn", "FundsOrDatumInvalid"].includes(state)) throw new Error(`MPS payment terminal state ${state}`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("MPS payment polling timed out");
}
