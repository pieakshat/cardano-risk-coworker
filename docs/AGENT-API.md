# Agent API contract (shape from research/gpt-verdict.md)

The product is a Coworker that other agents hire, over x402, before they pay or interact with a Cardano counterparty. The human UI stays; it renders the same engine.

```
Risk Engine (engine/, preflight/)
   ├── Human UI (web/ page)
   ├── x402 API (web/app/api/x402/risk-check)      <- agents pay per check
   └── Masumi Coworker on Sokosumi (worker/)        <- paid Tasks through escrow
```

## 1. x402 endpoint (lane X402)
`POST /api/x402/risk-check` with JSON body `{ target }` or `{ x402: PaymentRequirements, resource }`.
- Without payment: HTTP 402, x402 v2 body `{ x402Version: 2, accepts: [{ scheme: "exact", network: "cardano:preprod", amount: "1000000", asset: "lovelace", payTo: <Risk Desk selling address>, maxTimeoutSeconds: 600, extra: {} }] }` (spec: x402-foundation/x402 specs/schemes/exact/scheme_exact_cardano.md; package @x402/cardano 2.28.0, facilitator in-process as in /Users/user/Desktop/canton/cost-of-trust/agents/keeper.ts).
- With header `PAYMENT-SIGNATURE`: verify + settle (pending allowed, then poll Koios to confirmed, timeout branch), dedupe by tx id (no double delivery), then return the assessment with header `PAYMENT-RESPONSE`.

## 2. Assessment object (lane PREFLIGHT, `preflight/` package)
```ts
type Assessment = {
  decision: "INTERACT" | "INTERACT_WITH_CONDITIONS" | "DO_NOT_INTERACT";
  evidenceScore: number;            // 0..100 from explicit rules in preflight/score.ts, documented; never called "AI confidence"
  blockingReasons: string[];        // rule ids that force DO_NOT_INTERACT
  conditions: string[];             // rule ids that force WITH_CONDITIONS
  evidence: Array<{ rule: string; value: string; source: string }>;
  subject: { kind: "token" | "script" | "x402_payment"; network: "mainnet" | "preprod"; payTo?: string; asset?: string; amount?: string; resource?: string };
  checkedAt: string;
  termsHash?: string;               // blake2b-256 of canonical JSON of the PaymentRequirements when kind = x402_payment
};
```
`preflight(input)`: token/script inputs delegate to `engine/analyze`. `x402_payment` inputs check:
- **Counterparty** (`payTo`): key vs script credential, first-seen age, tx count, current balance, whether it is a known protocol script; on the network named in the requirements (preprod via Koios preprod, mainnet via Koios/Blockfrost mainnet).
- **Asset**: lovelace passes; a native asset runs the token rules (mint policy open, holders, registry) on its network.
- **Request**: HTTPS resource, amount within a caller-supplied cap (`maxAmount`), maxTimeoutSeconds sane.
Rules (initial): payTo first seen < 24 h = condition; payTo has < 3 txs = condition; asset mint policy open = blocking; amount > cap = blocking; non-HTTPS resource = blocking; script payTo not a known protocol = condition.

## 3. Execution agent demo (lane AGENT-DEMO, `agent-demo/`)
Two real x402 sellers on preprod run locally: a data API that asks 2 ADA to an established wallet, and one that asks payment in a token whose policy is open (minted for the demo by our issuer key on preprod, so the rule fires on real chain state) to a fresh address. The execution agent (OpenRouter free model for the narration only; the decision is the Assessment) for each seller: receives the 402, pays the Risk Desk over x402 to assess it, then pays the seller only if decision != DO_NOT_INTERACT. Every step and tx hash goes to agent-demo/runs/<ts>.json, confirmed on Koios.
