# Risk Desk guard

One call inserts a paid Risk Desk decision before an x402 Cardano seller payment. `DO_NOT_INTERACT` never pays the seller. Conditional verdicts are refused by default and can be enabled with `interactWithConditions: "allow"`.

```ts
// before
const paid = await client.createPaymentPayload(paymentRequired);
// after
const result = await guardedPay(paymentRequired, { wallet, maxAmount: "2000000" });
// result.paid is true only after the Risk Desk allows the seller
// refused payments throw RefusedPayment with ruleIds
```
