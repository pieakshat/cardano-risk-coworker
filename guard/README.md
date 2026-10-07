# Cardano Risk Desk guard

One call inserts a paid Cardano Risk Desk decision before an x402 Cardano seller payment. `DO_NOT_INTERACT` never pays the seller. Conditional verdicts are refused by default and can be enabled with `interactWithConditions: "allow"`.

## Integrate in one line

```ts
import { guardedPay, RefusedPayment } from "@cardano-risk-coworker/guard";

// before
const paid = await client.createPaymentPayload(paymentRequired);
// after
const result = await guardedPay(paymentRequired, { wallet, maxAmount: "2000000" });
// result.paid is true only after the Risk Desk allows the seller
// refused payments throw RefusedPayment with ruleIds
```

`guardedPay` pays the production Risk Desk endpoint 1 ADA over x402, reads the verdict, and signs the seller payment only when the verdict allows it. `RefusedPayment` carries `ruleIds`, the verdict, and the Risk Desk payment transaction.

## Live proof

[`guard/LIVE-PROOF.json`](LIVE-PROOF.json) records one agent running `guardedPay` against two preprod sellers, with every Risk Desk check paid to `https://cardano-risk-coworker.vercel.app/api/x402/risk-check`.

| Seller | Verdict | Rule ids | Risk Desk payment | Seller payment |
| --- | --- | --- | --- | --- |
| A | `INTERACT` | none | [312e724c18...c6e4b3](https://preprod.cardanoscan.io/transaction/312e724c18a137da44f59b9b3b1af47fad7f70492a731d624f7883c174c6e4b3) | [96bbd1de79...65688c](https://preprod.cardanoscan.io/transaction/96bbd1de790311b26eca30d5a693695c122a87f18e8c75eb7924b8a24965688c) |
| B | `DO_NOT_INTERACT` | `asset-mint-open`, `counterparty-first-seen`, `counterparty-tx-count` | [ccc263f968...71cb5f6](https://preprod.cardanoscan.io/transaction/ccc263f968b7c88e3d3406ed8f87dca6d0f135f6856b2cef41456792e71cb5f6) | none sent |

Both Risk Desk payments and Seller A's payment are confirmed in Koios preprod `tx_status`. Seller B receives no transaction.
