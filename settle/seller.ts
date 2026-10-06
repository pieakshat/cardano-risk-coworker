import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorCardanoSigner, type CardanoProviderConfig } from "@x402/cardano";
import { ExactCardanoScheme } from "@x402/cardano/exact/facilitator";

export const SELLER_PORT = Number(process.env.SETTLE_SELLER_PORT ?? 4927);
export const SELLER_ADDRESS = process.env.SETTLE_SELLER_ADDRESS ?? "";
export const SELLER_REQUIREMENTS = {
  scheme: "exact",
  network: "cardano:preprod",
  amount: process.env.SETTLE_PAY_AMOUNT ?? "1000000",
  asset: process.env.SETTLE_PAY_ASSET ?? "11c93226aabf1e9157620857d9ac013ba111680bd837f62a7ca90214" + "0014df10745553444d",
  payTo: SELLER_ADDRESS,
  maxTimeoutSeconds: 900,
  extra: { assetTransferMethod: "default", confirmationPolicy: { type: "none" } },
};

export function startSeller(port = SELLER_PORT) {
  if (!SELLER_ADDRESS) throw new Error("SETTLE_SELLER_ADDRESS is required");
  const provider: CardanoProviderConfig = { koios: { baseUrl: process.env.KOIOS_URL ?? "https://preprod.koios.rest/api/v1", token: process.env.KAIOS_KEY }, requestTimeoutMs: 120_000 };
  const signer = toFacilitatorCardanoSigner({ network: "cardano:preprod", provider, awaitConfirmation: true });
  const facilitator = new x402Facilitator();
  facilitator.register("cardano:preprod", new ExactCardanoScheme(signer));
  const server = Bun.serve({ port, async fetch(request) {
    const payment = request.headers.get("payment-signature");
    if (!payment) return Response.json({ x402Version: 2, accepts: [SELLER_REQUIREMENTS] }, { status: 402 });
    const payload = JSON.parse(Buffer.from(payment, "base64").toString("utf8"));
    const verified = await facilitator.verify(payload, SELLER_REQUIREMENTS as never);
    if (!verified.isValid) return Response.json({ error: verified.invalidReason ?? "payment refused" }, { status: 402 });
    const settled = await facilitator.settle(payload, SELLER_REQUIREMENTS as never);
    if (!settled.success) return Response.json({ error: settled.errorReason ?? "settlement failed" }, { status: 402 });
    return Response.json({ ok: true, settlement: settled.transaction });
  } });
  return server;
}

if (import.meta.main) { startSeller(); console.log(`settlement seller listening on ${SELLER_PORT}`); }
