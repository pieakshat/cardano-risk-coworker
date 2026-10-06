# Settlement Desk

The Settlement Desk prices the seller's requested asset from the buyer's held asset, refuses unsafe execution, submits the Minswap V2 preprod order, waits for the batcher fill, then pays an x402 v2 seller in that exact asset.

The preprod path is deliberately two-step. Minswap pool spends are batcher-gated, so the quote's minimum output is protected in the order but the fill is a later transaction.

## Evidence

| Event | Transaction | Timing | Cardanoscan |
|---|---|---:|---|
| Minswap order | pending live run | pending | [preprod transactions](https://preprod.cardanoscan.io/transactions) |
| Minswap fill | pending live run | pending | [preprod transactions](https://preprod.cardanoscan.io/transactions) |
| x402 payment | pending live run | pending | [preprod transactions](https://preprod.cardanoscan.io/transactions) |

Pool quote math uses live Koios preprod UTxOs, the 30/10,000 Minswap fee, and exact-out constant-product pricing. A pay asset with no configured mainnet twin is reported as `testnet asset, no mainnet risk data`. Price impact above 3% and a configured HIGH risk verdict refuse before signing.

Run with `set -a; source /Users/user/Desktop/canton/recourse/.env.live; set +a; bun settle/run.ts`. The real run also requires `BLOCKFROST_API_KEY_PREPROD`, because the legacy Minswap SDK uses Blockfrost for transaction construction, and `SETTLE_SELLER_ADDRESS`.
