import { preflight } from "../../../preflight";

export function assessRisk(target: string, resource: unknown, requirements: Record<string, unknown>) {
  return preflight({
    type: "x402_payment",
    payTo: target,
    network: "cardano:preprod",
    asset: "lovelace",
    amount: String(requirements.amount),
    maxAmount: process.env.X402_MAX_AMOUNT_LOVELACE ?? "10000000",
    maxTimeoutSeconds: Number(requirements.maxTimeoutSeconds ?? 600),
    resource: String(resource),
    terms: requirements,
  });
}
