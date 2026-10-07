import { expect, test, afterEach } from "bun:test";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { POST } from "./route";
import { resetSettlementStateForTests, setKoiosFetchForTests } from "../../../../lib/x402/settlement";

const txId = "fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31";
const transactionHex = "84a400d90102818258204da34655df9b648f6e73f42b01496e3fd8b95928dfaf99262d3abe34665d23a9050182825839001e2475585deddab7fee3f3d1ad66b73801fa3dc398061502c12d3d5e950eba73a0ff9b9876108a67cb61f416510cd9deceea8d97fc926dea1a000f42408258390062da708164cc7e486adc9a10f14ebb063e8607ee3d7cc532d444993232c2c1505a1b134f43f68a0f64d593ef4a3564950ee981f2e76c9f911a003a772b021a000291d5031a08155511a100d901028182582038d9037168fbd4eea7f96a39f22e30f3c502bc93ffd07b8c7d962363b40477425840a2c39b64b61eae451f98b9af34b4b70c05ab7dacefb3212ce3bf264e44d56a83aa967e110875983682dc521bcfbd739d93b28a3ec65f56d28704453580097e03f5f6";
const transaction = Buffer.from(transactionHex, "hex").toString("base64");

afterEach(() => setKoiosFetchForTests(undefined));

test("confirmed payment replay returns 409 and never assesses again", async () => {
  resetSettlementStateForTests();
  const calls: string[] = [];
  setKoiosFetchForTests(async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify([{ tx_hash: txId, num_confirmations: 1, block_hash: "block" }]), { status: 200 });
  });
  const header = encodePaymentSignatureHeader({ x402Version: 2, payload: { transaction, nonce: "4da34655df9b648f6e73f42b01496e3fd8b95928dfaf99262d3abe34665d23a9#0" } } as never);
  const response = await POST(new Request("https://example.test/api/x402/risk-check", {
    method: "POST",
    headers: { "content-type": "application/json", "payment-signature": header },
    body: JSON.stringify({ target: "addr_test1seller" }),
  }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "payment_already_used", txId });
  expect(calls).toEqual(["https://preprod.koios.rest/api/v1/tx_status"]);
});

test("invalid seller terms are rejected before settlement", async () => {
  resetSettlementStateForTests();
  const calls: string[] = [];
  setKoiosFetchForTests(async (input) => { calls.push(String(input)); return new Response("[]", { status: 200 }); });
  const header = encodePaymentSignatureHeader({ x402Version: 2, payload: { transaction, nonce: "4da34655df9b648f6e73f42b01496e3fd8b95928dfaf99262d3abe34665d23a9#0" } } as never);
  const response = await POST(new Request("https://example.test/api/x402/risk-check", {
    method: "POST",
    headers: { "content-type": "application/json", "payment-signature": header },
    body: JSON.stringify({ x402: { network: "cardano:preprod", amount: "1.5", payTo: "addr_test1seller" }, paymentRequired: { resource: { url: "http://seller.test/" } } }),
  }));
  expect(response.status).toBe(400);
  expect(calls).toEqual([]);
});
