# Cardano Risk Desk

## One-liners

- **Cardano Agentic Commerce:** A paid, cited approval step between an agent's x402 request and its seller payment on Cardano.
- **Main:** One agent checks two sellers, pays the one with an established wallet, and sends nothing to the one whose open mint policy and one-transaction address trip blocking rules.

## 150-word write-up

Cardano Risk Desk is the approval step before an agent pays a Cardano seller. The agent pays the Risk Desk 1 ADA over x402 and receives `INTERACT`, `INTERACT WITH CONDITIONS` or `DO_NOT_INTERACT`, each with rule ids and the Koios calls behind them. One `guardedPay` call wraps the seller payment, so a refused verdict never reaches the wallet signature. On preprod, one agent checks two sellers. Seller A has an established receiving wallet and is paid 2 ADA. Seller B asks for a token with an open mint policy from a one-transaction address and receives nothing. The production endpoint settled a paid check in transaction `66d28ffb319d...` and answered a replay of that payment with HTTP 409. Time-locked native policies are read against the current slot, so SNEK's closed policy reads as controlled. The Risk Desk and an Aiken Security Reviewer are Coworkers on Sokosumi. Integration is one guard before the seller signature.

## Stack

Cardano preprod and mainnet data, Bun and TypeScript, Next.js, Koios, Blockfrost, Cardano token registry data, Minswap data, x402 Cardano payments (`@x402/cardano`), Masumi, Sokosumi, and the Aiken Security Reviewer.

## Live links

- Live app: https://cardano-risk-coworker.vercel.app/
- Deck: https://cardano-risk-coworker.vercel.app/deck
- x402 endpoint: `POST https://cardano-risk-coworker.vercel.app/api/x402/risk-check`
- One-line guard: [`guard/README.md`](../guard/README.md)
- Demo script: [`docs/DEMO-SCRIPT.md`](DEMO-SCRIPT.md)
- Agent API: [`docs/AGENT-API.md`](../public-docs/AGENT-API.md)

## Coworkers

| Coworker | Sokosumi id |
| --- | --- |
| Risk Analyst (the Cardano Risk Desk) | `01a11080-a6c3-7686-abf4-b0d1594cb82b` |
| Security Reviewer (Aiken source review) | `01a11117-ad9f-71a5-a792-45d15c8c9ae0` |

## Transaction evidence

Every transaction below returned a confirmed record from Koios preprod `tx_status` on 2026-10-07.

| Evidence | Source | Koios confirmations | Transaction |
| --- | --- | ---: | --- |
| Production x402 Risk Desk payment, replay returns 409 | [`web/lib/x402/LIVE-PROOF.json`](../web/lib/x402/LIVE-PROOF.json) | 802 | [66d28ffbb3...05dd5ba](https://preprod.cardanoscan.io/transaction/66d28ffbb319d191ee62bc0833af6af031c463604cba5b2121f007ce705dd5ba) |
| guardedPay, Seller A Risk Desk payment | [`guard/LIVE-PROOF.json`](../guard/LIVE-PROOF.json) | 257 | [312e724c18...c6e4b3](https://preprod.cardanoscan.io/transaction/312e724c18a137da44f59b9b3b1af47fad7f70492a731d624f7883c174c6e4b3) |
| guardedPay, Seller A payment | [`guard/LIVE-PROOF.json`](../guard/LIVE-PROOF.json) | 256 | [96bbd1de79...65688c](https://preprod.cardanoscan.io/transaction/96bbd1de790311b26eca30d5a693695c122a87f18e8c75eb7924b8a24965688c) |
| guardedPay, Seller B Risk Desk payment (refused, no seller payment) | [`guard/LIVE-PROOF.json`](../guard/LIVE-PROOF.json) | 251 | [ccc263f968...71cb5f6](https://preprod.cardanoscan.io/transaction/ccc263f968b7c88e3d3406ed8f87dca6d0f135f6856b2cef41456792e71cb5f6) |
| Two-seller run 2, Seller A Risk Desk payment | [`agent-demo/runs/1791341265898.json`](../agent-demo/runs/1791341265898.json) | 612 | [91ae89f531...23f646](https://preprod.cardanoscan.io/transaction/91ae89f531480d490e5f89f67913d86e77fcf666778d7b5202a6951a8923f646) |
| Two-seller run 2, Seller A payment | [`agent-demo/runs/1791341265898.json`](../agent-demo/runs/1791341265898.json) | 609 | [6f514c89e2...99cdc6](https://preprod.cardanoscan.io/transaction/6f514c89e296e43efc5d5af5cd60f9e5a3e13be8ca19daecc1355ed1d599cdc6) |
| Two-seller run 2, Seller B Risk Desk payment (refused) | [`agent-demo/runs/1791341265898.json`](../agent-demo/runs/1791341265898.json) | 606 | [c063f45b3b...168a22](https://preprod.cardanoscan.io/transaction/c063f45b3ba73d73f932a534fe274ab7b9f748e5da9c2fdff48916efb0168a22) |
| Two-seller run 1, Seller A Risk Desk payment | [`agent-demo/runs/1791298553018.json`](../agent-demo/runs/1791298553018.json) | 2453 | [fc053ce1c9...246a31](https://preprod.cardanoscan.io/transaction/fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31) |
| Two-seller run 1, Seller A payment | [`agent-demo/runs/1791298553018.json`](../agent-demo/runs/1791298553018.json) | 2451 | [3866ed31eb...52659a](https://preprod.cardanoscan.io/transaction/3866ed31eb44b4278abfdb897c377e3d69a6d5c9e8649df8a966ba11d252659a) |
| Two-seller run 1, Seller B Risk Desk payment (refused) | [`agent-demo/runs/1791298553018.json`](../agent-demo/runs/1791298553018.json) | 2447 | [fad4fce272...84a1ad](https://preprod.cardanoscan.io/transaction/fad4fce27239cd0850bfa49100bebf00064780e9e908f4b61166d3461784a1ad) |

## Sokosumi task evidence

Both transactions returned a confirmed record from Koios preprod `tx_status` on 2026-10-07.

| Coworker task | Target | Koios confirmations | Transaction |
| --- | --- | ---: | --- |
| Risk Analyst `01a1152f-6ac1-76c8-b245-b0bccff73ee2`, Masumi escrow payment | MIN, verdict `DO NOT INTERACT` | 477 | [d429727560...ad1b9dd7](https://preprod.cardanoscan.io/transaction/d429727560321bf615a15c0a917c8dc09acc7edd9f378f77b2e81d2bad1b9dd7) |
| Risk Analyst `01a1152f-6ac1-76c8-b245-b0bccff73ee2`, result submitted on chain | MIN, verdict `DO NOT INTERACT` | 448 | [7748d93243...a45b1d7119](https://preprod.cardanoscan.io/transaction/7748d9324313b70e3483a17df763f180d6afdc60783b69d811a228a45b1d7119) |

The Security Reviewer task `01a11579-9cce-70dd-86bd-9da3a5772a31` ran on [Invariant-0/cardano-ctf `01_sell_nft`](https://github.com/Invariant-0/cardano-ctf/tree/main/01_sell_nft) and returned a `CONFIRMED` double-satisfaction exploit: one payment satisfies two script inputs. The exploit test passes on the contract and fails on a patched contract.
