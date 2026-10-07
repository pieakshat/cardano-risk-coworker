import { ExactCardanoScheme, toClientCardanoSigner, type ClientCardanoSigner, type ClientCardanoSignerConfig } from "@x402/cardano";
import { x402Client } from "@x402/core/client";
import { decodePaymentResponseHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";

export type Verdict = "INTERACT" | "INTERACT WITH CONDITIONS" | "DO_NOT_INTERACT";
export type GuardPolicy = {
  interactWithConditions?: "allow" | "refuse" | ((verdict: RiskVerdict) => boolean);
};
export type RiskVerdict = {
  decision?: Verdict;
  verdictLabel?: Verdict;
  blockingReasons?: string[];
  conditions?: string[];
  [key: string]: unknown;
};
export type GuardWallet = ClientCardanoSignerConfig;
export type GuardOptions = {
  wallet?: GuardWallet;
  signer?: ClientCardanoSigner;
  maxAmount?: string | bigint;
  policy?: GuardPolicy;
  riskUrl?: string;
};
export type GuardResult = {
  paid: true;
  verdict: RiskVerdict;
  riskCheckTx: string;
  sellerTx: string;
};

export class RefusedPayment extends Error {
  readonly name = "RefusedPayment";
  readonly ruleIds: string[];
  readonly verdict: RiskVerdict;
  readonly riskCheckTx?: string;

  constructor(verdict: RiskVerdict, ruleIds: string[], riskCheckTx?: string) {
    super(`payment refused: ${ruleIds.join(", ") || verdict.decision || "policy"}`);
    this.ruleIds = ruleIds;
    this.verdict = verdict;
    this.riskCheckTx = riskCheckTx;
  }
}

export function decideVerdict(verdict: RiskVerdict, policy: GuardPolicy = {}): boolean {
  const decision = verdict.decision ?? verdict.verdictLabel;
  if (decision === "DO_NOT_INTERACT") return false;
  if (decision === "INTERACT") return true;
  if (decision !== "INTERACT WITH CONDITIONS") return false;
  const choice = policy.interactWithConditions ?? "refuse";
  return typeof choice === "function" ? choice(verdict) : choice === "allow";
}

function refusalRules(verdict: RiskVerdict): string[] {
  return [...new Set([...(verdict.blockingReasons ?? []), ...(verdict.conditions ?? [])])];
}

function txFromResponse(response: Response): string {
  const header = response.headers.get("payment-response");
  if (header) {
    const settlement = decodePaymentResponseHeader(header) as { transaction?: string };
    if (settlement.transaction) return settlement.transaction;
  }
  return "";
}

function clientFor(options: GuardOptions): x402Client {
  const signer = options.signer ?? (options.wallet ? toClientCardanoSigner(options.wallet) : undefined);
  if (!signer) throw new TypeError("guardedPay requires options.signer or options.wallet");
  return new x402Client()
    .setSpendControls(false)
    .register("cardano:preprod", new ExactCardanoScheme(signer));
}

export async function guardedPay(paymentRequired: PaymentRequired, options: GuardOptions): Promise<GuardResult> {
  const requirement = paymentRequired.accepts[0] as PaymentRequirements | undefined;
  if (!requirement) throw new TypeError("paymentRequired.accepts must contain a payment requirement");
  const riskUrl = options.riskUrl ?? "https://cardano-risk-coworker.vercel.app/api/x402/risk-check";
  const riskInput = {
    target: requirement.payTo,
    x402: requirement,
    paymentRequired,
    maxAmount: options.maxAmount === undefined ? requirement.amount : String(options.maxAmount),
    resource: paymentRequired.resource,
  };
  const client = clientFor(options);
  const riskQuoteResponse = await fetch(riskUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(riskInput),
  });
  if (riskQuoteResponse.status !== 402) throw new Error(`Risk Desk expected 402, got ${riskQuoteResponse.status}`);
  const riskRequired = await riskQuoteResponse.json() as PaymentRequired;
  const riskPayload = await client.createPaymentPayload(riskRequired);
  const riskResponse = await fetch(riskUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...clientHeaders(client, riskPayload) },
    body: JSON.stringify(riskInput),
  });
  if (!riskResponse.ok) throw new Error(`Risk Desk payment failed: ${riskResponse.status} ${await riskResponse.text()}`);
  const verdict = await riskResponse.json() as RiskVerdict;
  const riskCheckTx = txFromResponse(riskResponse);
  if (!decideVerdict(verdict, options.policy)) throw new RefusedPayment(verdict, refusalRules(verdict), riskCheckTx);
  const sellerPayload = await client.createPaymentPayload(paymentRequired);
  const sellerResponse = await fetch(paymentRequired.resource.url, { headers: clientHeaders(client, sellerPayload) });
  if (!sellerResponse.ok) throw new Error(`seller payment failed: ${sellerResponse.status} ${await sellerResponse.text()}`);
  const body = await sellerResponse.json().catch(() => ({})) as { transaction?: string };
  const sellerTx = txFromResponse(sellerResponse) || body.transaction || "";
  if (!sellerTx) throw new Error("seller payment response did not include a transaction");
  return { paid: true, verdict, riskCheckTx, sellerTx };
}

function clientHeaders(client: x402Client, payload: Awaited<ReturnType<x402Client["createPaymentPayload"]>>): Record<string, string> {
  return { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) };
}
