# Cardano Risk Desk

An approval step before your agent pays anyone on Cardano. The agent pays the Risk Desk 1 ADA over x402, receives `INTERACT`, `INTERACT WITH CONDITIONS` or `DO_NOT_INTERACT` with the rule ids and chain evidence behind it, and signs the seller payment only on an allowing verdict.

Live: https://cardano-risk-coworker.vercel.app/

The first screen takes a token ticker or contract address, runs the three gates and answers in plain words, for example: "Do not let your agent pay in MIN: whoever holds the policy key can mint more at any time." The evidence and every source call sit under the verdict.

A short glossary for newcomers: a **mint policy** is the rule inside a Cardano token that says who can create more of it. **x402** is a web payment standard where a server answers `402 Payment Required` with a price and the client pays and retries. **Escrow** is a contract that holds a payment while the work is done; Masumi escrows Sokosumi tasks.

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

Full guard reference: [`guard/README.md`](guard/README.md).

## Proof

| Proof | What it shows | Evidence |
| --- | --- | --- |
| Production x402 paid call | The deployed endpoint returns 402, settles a paid check on Cardano preprod, and answers a replay of the same payment with HTTP 409 | [66d28ffbb3...05dd5ba](https://preprod.cardanoscan.io/transaction/66d28ffbb319d191ee62bc0833af6af031c463604cba5b2121f007ce705dd5ba), [`web/lib/x402/LIVE-PROOF.json`](web/lib/x402/LIVE-PROOF.json) |
| `guardedPay` against the production endpoint | Seller A returns `INTERACT` and is paid. Seller B returns `DO_NOT_INTERACT` and receives nothing | [`guard/LIVE-PROOF.json`](guard/LIVE-PROOF.json) |
| Two-seller preprod runs | One agent checks two x402 sellers, pays Seller A after `INTERACT`, and refuses Seller B after `DO_NOT_INTERACT` | [`agent-demo/runs/1791341265898.json`](agent-demo/runs/1791341265898.json), [`agent-demo/runs/1791298553018.json`](agent-demo/runs/1791298553018.json) |
| Time-locked native policies | SNEK's policy `all[before slot 90915881, sig]` is read against the current slot, reads as controlled, and returns `INTERACT WITH CONDITIONS` | [`preflight/preflight.test.ts`](preflight/preflight.test.ts) |

Every transaction hash is listed with its Koios confirmation count in [`docs/BUILDERBASE.md`](docs/BUILDERBASE.md).

## Proven on Sokosumi

| Coworker | Task | Result | Evidence |
| --- | --- | --- | --- |
| Risk Analyst (the Cardano Risk Desk) | `01a1152f-6ac1-76c8-b245-b0bccff73ee2` on MIN | `DO NOT INTERACT` | Masumi escrow [d429727560...ad1b9dd7](https://preprod.cardanoscan.io/transaction/d429727560321bf615a15c0a917c8dc09acc7edd9f378f77b2e81d2bad1b9dd7), result submitted on chain [7748d93243...a45b1d7119](https://preprod.cardanoscan.io/transaction/7748d9324313b70e3483a17df763f180d6afdc60783b69d811a228a45b1d7119) |
| Aiken Security Reviewer | `01a11579-9cce-70dd-86bd-9da3a5772a31` on [Invariant-0/cardano-ctf `01_sell_nft`](https://github.com/Invariant-0/cardano-ctf/tree/main/01_sell_nft) | `CONFIRMED` double satisfaction: one payment satisfies two script inputs | An exploit test passes on the contract and fails on a patched contract |

Both transactions are confirmed on Cardano preprod by Koios `tx_status`, listed in [`docs/BUILDERBASE.md`](docs/BUILDERBASE.md).

## The two-seller run

Seller A asks 2 ADA and its receiving wallet has an established history. The agent receives `INTERACT` and pays Seller A. Seller B asks for a token whose mint policy is open and its receiving address has one transaction, so the agent receives `DO_NOT_INTERACT` under `asset-mint-open`, with `counterparty-first-seen` and `counterparty-tx-count` recorded as conditions, and sends nothing to Seller B.

| Run | Seller | Risk Desk payment | Verdict | Seller payment |
| --- | --- | --- | --- | --- |
| 2 | A | [91ae89f531...23f646](https://preprod.cardanoscan.io/transaction/91ae89f531480d490e5f89f67913d86e77fcf666778d7b5202a6951a8923f646) | `INTERACT` | [6f514c89e2...99cdc6](https://preprod.cardanoscan.io/transaction/6f514c89e296e43efc5d5af5cd60f9e5a3e13be8ca19daecc1355ed1d599cdc6) |
| 2 | B | [c063f45b3b...168a22](https://preprod.cardanoscan.io/transaction/c063f45b3ba73d73f932a534fe274ab7b9f748e5da9c2fdff48916efb0168a22) | `DO_NOT_INTERACT` | none sent |
| 1 | A | [fc053ce1c9...246a31](https://preprod.cardanoscan.io/transaction/fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31) | `INTERACT` | [3866ed31eb...52659a](https://preprod.cardanoscan.io/transaction/3866ed31eb44b4278abfdb897c377e3d69a6d5c9e8649df8a966ba11d252659a) |
| 1 | B | [fad4fce272...84a1ad](https://preprod.cardanoscan.io/transaction/fad4fce27239cd0850bfa49100bebf00064780e9e908f4b61166d3461784a1ad) | `DO_NOT_INTERACT` | none sent |

## Evidence path

Every report includes the source calls that produced its findings. For scripts, the engine reads Koios mainnet data for script type, size when available, first-seen time, ADA and top-asset value, UTxOs, recent transactions, and known protocol matches. A missing protocol hash match remains an explicit finding.

Tokens retain the evidence path for minting policy, holder concentration, registry identity, and Minswap liquidity. Public GitHub repositories route to the Aiken Security Reviewer.

The Risk Desk applies three gates:

1. Who controls it: can someone mint, upgrade, or drain it on their own?
2. Is the code safe: does the contract hold when someone attacks it?
3. Can you get in and out: is there liquidity for your size at a fair price?

## x402 agent flow

The Risk Desk is a paid x402 service. The agent receives `402 Payment Required`, pays the Risk Desk on Cardano preprod, retries with the signed payment, and receives the verdict as JSON. The production payment is confirmed on chain in transaction `66d28ffbb319d191ee62bc0833af6af031c463604cba5b2121f007ce705dd5ba`, and replaying it returns HTTP 409.

## Coworkers on Sokosumi

The Risk Desk runs as the Risk Analyst Coworker (`01a11080-a6c3-7686-abf4-b0d1594cb82b`) and sends Aiken source to the Security Reviewer Coworker (`01a11117-ad9f-71a5-a792-45d15c8c9ae0`).

## How to run

```sh
bun install
bun test
cd web && bun run build
```

The live API uses `KAIOS_KEY` and, for holder sampling, `BLOCKFROST_API_KEY_MAINNET`. Keep secrets in the environment.
