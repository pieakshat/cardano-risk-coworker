# BuilderBase

## Project

Cardano Risk Analyst

## Tracks

- Cardano Agentic Commerce: A paid Cardano Coworker that checks a counterparty before an agent sends an x402 payment.
- Main: A live two-seller run shows the same agent paying one seller and refusing the other from Cardano evidence.

## 150-word write-up

Cardano Risk Analyst is a pre-flight payment decision for autonomous agents. Before an agent pays a Cardano seller, it pays the Risk Desk 1 ADA over x402 and receives `INTERACT`, `INTERACT WITH CONDITIONS`, or `DO_NOT_INTERACT` with the rule ids and evidence calls behind the result. The live proof runs one agent against two sellers. Seller A asks 2 ADA, its receiving wallet has 27 transactions since 5 October, and the agent receives `INTERACT` before paying it. Seller B requests a token whose mint policy is open and uses a receiving address with 1 transaction first seen that day. The agent receives `DO_NOT_INTERACT` with `asset-mint-open` and sends nothing to the seller. The result is a simple agent loop: inspect the x402 request, pay for a cited Cardano decision, then follow the decision. Masumi records the task result on Cardano, while Koios and protocol data supply the evidence used by the gates.

## Tech stack

Cardano preprod and mainnet data, Bun and TypeScript, Next.js, Koios, Blockfrost, Cardano token registry data, Minswap data, x402 Cardano payments, Masumi task settlement, and an Aiken Security Reviewer path for public repositories.

## Links

- Live app: https://cardano-risk-coworker.vercel.app/
- Demo script: [`docs/DEMO-SCRIPT.md`](DEMO-SCRIPT.md)
- Recorded run: [`agent-demo/runs/1791298553018.json`](../agent-demo/runs/1791298553018.json)
- Agent API: [`docs/AGENT-API.md`](AGENT-API.md)

## Transaction evidence

| Evidence | Transaction |
| --- | --- |
| Seller A Risk Desk payment | [fc053ce1c9...6a31](https://preprod.cardanoscan.io/transaction/fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31) |
| Seller A payment | [3866ed31eb...659a](https://preprod.cardanoscan.io/transaction/3866ed31eb44b4278abfdb897c377e3d69a6d5c9e8649df8a966ba11d252659a) |
| Seller B Risk Desk payment | [fad4fce272...a1ad](https://preprod.cardanoscan.io/transaction/fad4fce27239cd0850bfa49100bebf00064780e9e908f4b61166d3461784a1ad) |
| Seller B payment | No transaction sent after `DO_NOT_INTERACT`. |
