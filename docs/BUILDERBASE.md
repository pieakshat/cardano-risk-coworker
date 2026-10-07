# BuilderBase

## Name

Cardano Risk Analyst

## Tracks

- Cardano Agentic Commerce: A paid Risk Desk places a cited Cardano counterparty decision before an agent's seller payment.
- Main: One agent pays the approved seller and refuses the seller whose asset and address evidence trigger blocking rules.

## 150-word write-up

Cardano Risk Analyst is a pre-flight payment decision for autonomous agents. Before an agent pays a Cardano seller, it pays the Risk Desk 1 ADA over x402 and receives `INTERACT`, `INTERACT WITH CONDITIONS`, or `DO_NOT_INTERACT` with rule ids and evidence calls. The live proof runs one agent against two sellers. Seller A asks 2 ADA, its receiving wallet has 27 transactions since 5 October, and the agent receives `INTERACT` before paying it. Seller B requests a token whose mint policy is open and uses a receiving address with one transaction first seen that day. The agent receives `DO_NOT_INTERACT` with `asset-mint-open`, `counterparty-first-seen`, and `counterparty-tx-count`, then follows the refusal branch. The production x402 endpoint settles the paid decision on Cardano preprod and rejects a replay with HTTP 409. Masumi records the paid task, while Koios and protocol data supply the cited evidence. Integration is one guard before the seller signature.

## Stack

Cardano preprod and mainnet data, Bun and TypeScript, Next.js, Koios, Blockfrost, Cardano token registry data, Minswap data, x402 Cardano payments, Masumi task settlement, Sokosumi, and Aiken Security Reviewer.

## Links

- Live app: https://cardano-risk-coworker.vercel.app/
- Deck: https://cardano-risk-coworker.vercel.app/deck
- Demo script: [`docs/DEMO-SCRIPT.md`](DEMO-SCRIPT.md)
- Agent API: [`docs/AGENT-API.md`](AGENT-API.md)

## Transaction evidence

Every transaction below returned a confirmed record from Koios preprod `tx_status` on 2026-10-07.

| Evidence | Koios confirmations | Transaction |
| --- | ---: | --- |
| Seller A Risk Desk payment | 2190 | [fc053ce1c9...1246a31](https://preprod.cardanoscan.io/transaction/fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31) |
| Seller A payment | 2188 | [3866ed31eb...252659a](https://preprod.cardanoscan.io/transaction/3866ed31eb44b4278abfdb897c377e3d69a6d5c9e8649df8a966ba11d252659a) |
| Seller B Risk Desk payment | 2184 | [fad4fce272...1784a1ad](https://preprod.cardanoscan.io/transaction/fad4fce27239cd0850bfa49100bebf00064780e9e908f4b61166d3461784a1ad) |
| Production x402 Risk Desk payment | 539 | [66d28ffbb3...705dd5ba](https://preprod.cardanoscan.io/transaction/66d28ffbb319d191ee62bc0833af6af031c463604cba5b2121f007ce705dd5ba) |
