import { NextResponse } from "next/server";
import { encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { assessRisk } from "../../../../lib/x402/risk";
import { recordDelivery, RISK_DESK_PAY_TO, settleOnce } from "../../../../lib/x402/settlement";

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
  return new Response(JSON.stringify({ x402Version: 2, accepts: body.accepts }), {
    status: 402,
    headers: { "content-type": "application/json", "PAYMENT-REQUIRED": encodePaymentRequiredHeader(body as never) },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { target?: unknown; x402?: Record<string, unknown>; resource?: unknown } | null;
  const sellerRequirements = body?.x402;
  const target = typeof body?.target === "string" ? body.target.trim() : typeof sellerRequirements?.payTo === "string" ? sellerRequirements.payTo : "";
  if (!target) return NextResponse.json({ error: "target is required" }, { status: 400 });
  const paymentHeader = request.headers.get("payment-signature");
  if (!paymentHeader) return paymentRequired(request);

  try {
    const riskRequirements = { ...requirements, resource: new URL(request.url).toString() };
    const sellerTerms = sellerRequirements ?? { ...requirements, payTo: target };
    const resource = body?.resource ?? new URL(request.url).toString();
    const settled = await settleOnce(paymentHeader, riskRequirements);
    if (settled.cached) {
      return NextResponse.json(settled.cached.assessment, { headers: { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settled.cached.paymentResponse as never) } });
    }
    const assessment = await assessRisk(resource, sellerTerms);
    await recordDelivery(settled.txId, assessment, settled.paymentResponse);
    return NextResponse.json(assessment, { headers: { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settled.paymentResponse as never) } });
  } catch (error) {
    console.error("x402 risk check failed", error);
    return NextResponse.json({ error: "payment or risk check failed" }, { status: 502 });
  }
}
