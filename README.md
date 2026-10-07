# Cardano Risk Desk

Check how risky any action is for your agent when it interacts with any contract/Account on Cardano.

An approval step before your agent pays anyone on Cardano.

Live: https://cardano-risk-coworker.vercel.app/

Demo moment: one agent checks two x402 sellers,
pays Seller A after `INTERACT`, and refuses Seller B after `DO_NOT_INTERACT`.

- Seller A risk check: [fc053ce1c9...6a31](https://preprod.cardanoscan.io/transaction/fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31)
- Seller A payment: [3866ed31eb...659a](https://preprod.cardanoscan.io/transaction/3866ed31eb44b4278abfdb897c377e3d69a6d5c9e8649df8a966ba11d252659a)
- Seller B risk check: [fad4fce272...a1ad](https://preprod.cardanoscan.io/transaction/fad4fce27239cd0850bfa49100bebf00064780e9e908f4b61166d3461784a1ad)

## How to run

```sh
bun install
bun test engine/engine.test.ts
cd web && npm run build
```

The live API uses `KAIOS_KEY` and, for holder sampling, `BLOCKFROST_API_KEY_MAINNET`. Keep secrets in the environment.

## What it does

Cardano Risk Desk is a Sokosumi Coworker for one decision: should an agent interact with this Cardano counterparty?

An agent receives an x402 payment request, pays the Risk Desk 1 ADA over x402, receives `INTERACT`, `INTERACT WITH CONDITIONS`, or `DO NOT INTERACT` with rule ids, and only then pays the seller.

The live two-seller run is recorded in [`agent-demo/runs/1791298553018.json`](agent-demo/runs/1791298553018.json). Seller A asks 2 ADA and the receiving wallet has 27 transactions since 5 Oct. The agent receives `INTERACT` and pays Seller A. Seller B asks for a token whose mint policy is open and the receiving address has 1 transaction, so the agent receives `DO_NOT_INTERACT` and sends nothing to Seller B.

## Evidence path

Every report includes the source calls that produced its findings. For scripts, the engine reads Koios mainnet data for script type, size when available, first-seen time, ADA and top-asset value, UTxOs, recent transactions, and known protocol matches. A missing protocol hash match remains an explicit finding.

Tokens retain the evidence path for minting policy, holder concentration, registry identity, and Minswap liquidity. Public GitHub repositories route to the Aiken Security Reviewer.

The analyst has three gates:

1. Who controls it: can someone mint, upgrade, or drain it on their own?
2. Is the code safe: does the contract hold when someone attacks it?
3. Can you get in and out: is there liquidity for your size at a fair price?

## x402 agent flow

The Risk Desk is itself a paid x402 Coworker. The agent receives `402 Payment Required`, pays the Risk Desk on Cardano preprod, retries with the signed payment, and receives the verdict as JSON. The production payment is confirmed on chain in transaction `66d28ffb319d191ee62bc0833af6af031c463604cba5b2121f007ce705dd5ba`, and replaying it returns HTTP 409.

## Cardano preprod run

| Seller | Risk check | Verdict | Seller payment |
| --- | --- | --- | --- |
| Seller A | [fc053ce1c9...6a31](https://preprod.cardanoscan.io/transaction/fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31) | `INTERACT` | [3866ed31eb...659a](https://preprod.cardanoscan.io/transaction/3866ed31eb44b4278abfdb897c377e3d69a6d5c9e8649df8a966ba11d252659a) |
| Seller B | [fad4fce272...a1ad](https://preprod.cardanoscan.io/transaction/fad4fce27239cd0850bfa49100bebf00064780e9e908f4b61166d3461784a1ad) | `DO_NOT_INTERACT` | No transaction sent |

Seller A's decision cites the receiving wallet's transaction history and first-seen data. Seller B returns `DO_NOT_INTERACT` under `asset-mint-open`, with `counterparty-first-seen` and `counterparty-tx-count` recorded as conditions.

## Checks

```sh
bun test
bunx tsc --noEmit
```
