# Paid risk check

The endpoint charges 1 ADA on Cardano preprod and returns a machine-readable assessment.

```sh
curl -i -X POST http://localhost:4402/api/x402/risk-check \
  -H 'content-type: application/json' \
  -d '{"target":"addr_test1..."}'
```

For a real request, send the 402 `PAYMENT-REQUIRED` value to an x402 v2 client. The Cardano client signer creates the payment with the buyer wallet, then retry the same request with `PAYMENT-SIGNATURE`:

```ts
import { toClientCardanoSigner } from "@x402/cardano";
import { ExactCardanoScheme } from "@x402/cardano/exact/client";
import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";

const client = x402Client.fromConfig({ schemes: [], spendControls: false });
client.register("cardano:preprod", new ExactCardanoScheme(toClientCardanoSigner({
  mnemonic: process.env.BUYER_MNEMONIC!,
  network: "cardano:preprod",
  provider: { koios: { baseUrl: "https://preprod.koios.rest/api/v1", token: process.env.KAIOS_KEY } },
})));
const first = await fetch("http://localhost:4402/api/x402/risk-check", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ target: "addr_test1..." }),
});
const required = decodePaymentRequiredHeader(first.headers.get("PAYMENT-REQUIRED")!);
const payload = await client.createPaymentPayload({ x402Version: 2, accepts: required.accepts });
const result = await fetch("http://localhost:4402/api/x402/risk-check", {
  method: "POST", headers: { "content-type": "application/json", "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) },
  body: JSON.stringify({ target: "addr_test1..." }),
});
console.log(await result.json());
```
