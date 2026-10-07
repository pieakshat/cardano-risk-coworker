import { preflight } from "../../../preflight";

export function paymentInput(resource: unknown, requirements: Record<string, unknown>) {
  const resourceUrl = typeof resource === "string" ? resource : resource && typeof resource === "object" && "url" in resource ? String((resource as { url: unknown }).url) : "";
  return {
    type: "x402_payment",
    payTo: String(requirements.payTo),
    network: String(requirements.network) as "cardano:preprod" | "cardano:mainnet",
    asset: String(requirements.asset ?? "lovelace"),
    amount: String(requirements.amount),
    maxAmount: String(requirements.maxAmount ?? process.env.X402_MAX_AMOUNT_LOVELACE ?? "10000000"),
    maxAmountAsset: String(requirements.maxAmountAsset ?? requirements.asset ?? "lovelace"),
    maxTimeoutSeconds: Number(requirements.maxTimeoutSeconds ?? 600),
    resource: resourceUrl,
    terms: requirements,
  } as const;
}

export function assessRisk(resource: unknown, requirements: Record<string, unknown>) {
  return preflight(paymentInput(resource, requirements));
}
