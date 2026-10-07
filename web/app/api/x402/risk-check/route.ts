import { NextResponse } from "next/server";
import { encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { assessRisk } from "../../../../lib/x402/risk";
import { paymentAddressValid, preflight } from "../../../../../preflight";
import { PaymentAlreadyUsedError, recordDelivery, recordPending, RISK_DESK_PAY_TO, settleOnce, txIdFromPayment, withDeliveryLock } from "../../../../lib/x402/settlement";

export const runtime = "nodejs";
export const maxDuration = 60;

const requirements = {
  scheme: "exact",
  network: "cardano:preprod",
  amount: "1000000",
  asset: "lovelace",
  payTo: RISK_DESK_PAY_TO,
  maxTimeoutSeconds: 600,
  extra: { confirmationPolicy: { l1Confirmations: 0 } },
};

function paymentRequired(request: Request): Response {
  const body = {
    x402Version: 2,
    resource: { url: new URL(request.url).toString(), description: "Cardano Risk Coworker assessment", mimeType: "application/json" },
    accepts: [requirements],
  };
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: { "content-type": "application/json", "PAYMENT-REQUIRED": encodePaymentRequiredHeader(body as never) },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { target?: unknown; x402?: Record<string, unknown>; paymentRequired?: Record<string, unknown>; maxAmount?: unknown; maxAmountAsset?: unknown } | null;
  const sellerRequirements = body?.x402;
  const target = typeof body?.target === "string" ? body.target.trim() : typeof sellerRequirements?.payTo === "string" ? sellerRequirements.payTo : "";
  if (!target) return NextResponse.json({ error: "target is required" }, { status: 400 });
  const paymentHeader = request.headers.get("payment-signature");
  if (!paymentHeader) return paymentRequired(request);
  const sellerResource = sellerRequirements && body?.paymentRequired?.resource && typeof body.paymentRequired.resource === "object" ? (body.paymentRequired.resource as { url?: unknown }).url : undefined;

  try {
    const sellerTerms: Record<string, unknown> | undefined = sellerRequirements ? { ...sellerRequirements, maxAmount: String(body?.maxAmount ?? process.env.X402_MAX_AMOUNT_LOVELACE ?? "10000000"), maxAmountAsset: String(body?.maxAmountAsset ?? sellerRequirements.asset ?? "lovelace") } : undefined;
    if (sellerTerms && (!/^cardano:(preprod|mainnet)$/.test(String(sellerTerms.network)) || !/^[0-9]+$/.test(String(sellerTerms.amount)) || !/^[0-9]+$/.test(String(sellerTerms.maxAmount)))) return NextResponse.json({ error: "invalid x402 terms" }, { status: 400 });
    if (sellerTerms && (typeof sellerTerms.payTo !== "string" || !paymentAddressValid(sellerTerms.payTo, String(sellerTerms.network).slice("cardano:".length) as "mainnet" | "preprod"))) return NextResponse.json({ error: "invalid x402 payTo" }, { status: 400 });
    const riskRequirements = { ...requirements, resource: new URL(request.url).toString() };
    if (sellerTerms && typeof sellerResource !== "string") return NextResponse.json({ error: "seller resource is required" }, { status: 400 });
    const settled = await settleOnce(paymentHeader, riskRequirements);
    if (settled.cached) {
      return NextResponse.json(settled.cached.assessment, { headers: { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settled.cached.paymentResponse as never) } });
    }
    return withDeliveryLock(settled.txId, async () => {
      const assessment = sellerTerms ? await assessRisk(sellerResource, sellerTerms) : await preflight({ type: "token", input: target, network: "mainnet" });
      await recordDelivery(settled.txId, assessment, settled.paymentResponse);
      return NextResponse.json(assessment, { headers: { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settled.paymentResponse as never) } });
    });
  } catch (error) {
    if (error instanceof PaymentAlreadyUsedError) {
      return NextResponse.json({ error: "payment_already_used", txId: error.txId }, { status: 409 });
    }
    try {
      const txId = txIdFromPayment(paymentHeader);
      await recordPending(txId, { ...(sellerRequirements ?? requirements), maxAmount: body?.maxAmount, maxAmountAsset: body?.maxAmountAsset, target }, sellerResource);
    } catch (pendingError) { console.error("x402 pending record failed", pendingError); }
    console.error("x402 risk check failed", error);
    const txId = txIdFromPayment(paymentHeader);
    return NextResponse.json({ status: "pending", txId, poll: new URL(`./${txId}`, request.url).toString() }, { status: 202 });
  }
}
