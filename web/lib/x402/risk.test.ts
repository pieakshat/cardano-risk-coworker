import { expect, test } from "bun:test";
import { paymentInput } from "./risk";

test("forwards native asset payment requirements to token rules", () => {
  const input = paymentInput("http://127.0.0.1:4404/", {
    scheme: "exact",
    network: "cardano:preprod",
    amount: "5",
    asset: "e675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c9.0014df10745553444d",
    payTo: "addr_test1seller",
    maxTimeoutSeconds: 600,
  });
  expect(input).toMatchObject({
    type: "x402_payment",
    network: "cardano:preprod",
    amount: "5",
    asset: "e675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c9.0014df10745553444d",
    payTo: "addr_test1seller",
    resource: "http://127.0.0.1:4404/",
    maxTimeoutSeconds: 600,
  });
});
