import { decodePaymentSignatureHeader, encodePaymentRequiredHeader } from "@x402/core/http";
import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorCardanoSigner } from "@x402/cardano";
import { ExactCardanoScheme } from "@x402/cardano/exact/facilitator";
import { readFileSync } from "node:fs";

const port = Number(process.env.PORT ?? (process.argv[2] === "b" ? 4404 : 4403));
const token = JSON.parse(readFileSync(new URL("./token.json", import.meta.url), "utf8")) as { unit: string; sellerAddress: string; mintTx: string };
const kind = process.argv[2] === "b" ? "B" : "A";
const payTo = kind === "A" ? process.env.RECOURSE_RELAYER_ADDRESS : token.sellerAddress;
if (!payTo) throw new Error("RECOURSE_RELAYER_ADDRESS is required for seller A");
const requirement = {
  scheme: "exact",
  network: "cardano:preprod",
  amount: kind === "A" ? "2000000" : "5",
  asset: kind === "A" ? "lovelace" : token.unit,
  payTo,
  maxTimeoutSeconds: 600,
  extra: {},
};
const resource = { url: `http://127.0.0.1:${port}/`, description: `Risk Desk demo seller ${kind}`, mimeType: "application/json" };
const facilitator = new x402Facilitator();
facilitator.register("cardano:preprod", new ExactCardanoScheme(toFacilitatorCardanoSigner({ network: "cardano:preprod", provider: { koios: { baseUrl: "https://preprod.koios.rest/api/v1" }, requestTimeoutMs: 120_000 } })));

async function settle(header: string): Promise<string> {
  const payment = decodePaymentSignatureHeader(header);
  const verified = await facilitator.verify(payment as never, requirement as never);
  if (!verified.isValid) throw new Error(`payment rejected: ${verified.invalidReason ?? "invalid"}`);
  const deadline = Date.now() + 240_000;
  for (;;) {
    const settled = await facilitator.settle(payment as never, requirement as never);
    if (settled.success) return settled.transaction;
    if (Date.now() >= deadline || !["settlement_pending", "exact_cardano_settlement_not_confirmed"].includes(settled.errorReason ?? "")) throw new Error(`settlement failed: ${settled.errorReason ?? "unknown"}`);
    await Bun.sleep(5_000);
  }
}

function challenge(): Response {
  const body = { x402Version: 2, resource, accepts: [requirement] };
  return new Response(JSON.stringify(body), { status: 402, headers: { "content-type": "application/json", "PAYMENT-REQUIRED": encodePaymentRequiredHeader(body as never) } });
}

Bun.serve({ port, async fetch(request) {
  if (request.method !== "GET" || new URL(request.url).pathname !== "/") return new Response("not found", { status: 404 });
  const header = request.headers.get("payment-signature");
  if (!header) return challenge();
  try {
    const transaction = await settle(header);
    return new Response(JSON.stringify({ seller: kind, paid: true, transaction, requested: requirement }), { headers: { "content-type": "application/json", "PAYMENT-RESPONSE": Buffer.from(JSON.stringify({ transaction })).toString("base64") } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { "content-type": "application/json" } });
  }
}});
console.log(`seller-${kind} listening on ${port}`);
