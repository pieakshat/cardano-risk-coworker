import { NextResponse } from "next/server";
import { assessRisk } from "../../../../../lib/x402/risk";
import { preflight } from "../../../../../../preflight";
import { confirmedOnChain, getDelivery, recordDelivery, withDeliveryLock } from "../../../../../lib/x402/settlement";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ txId: string }> }) {
  const { txId } = await context.params;
  const delivery = await getDelivery(txId);
  if (!delivery) return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  if (delivery.status === "complete") return NextResponse.json(delivery.assessment);
  if (!(await confirmedOnChain(txId))) return NextResponse.json({ status: "pending", txId }, { status: 202 });
  return withDeliveryLock(txId, async () => {
    const current = await getDelivery(txId);
    if (!current) return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
    if (current.status === "complete") return NextResponse.json(current.assessment);
    const target = typeof current.requirements?.target === "string" ? current.requirements.target : undefined;
    const assessment = target ? await preflight({ type: "token", input: target, network: "mainnet" }) : await assessRisk(current.resource, current.requirements ?? {});
    await recordDelivery(txId, assessment, current.paymentResponse);
    return NextResponse.json(assessment);
  });
}
