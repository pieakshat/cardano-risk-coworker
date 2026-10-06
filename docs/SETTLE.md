# Settlement Desk

The Settlement Desk prices the seller's requested asset from the buyer's held asset, refuses unsafe execution, submits the Minswap V2 preprod order, waits for the batcher fill, then pays an x402 v2 seller in that exact asset.

The preprod path is deliberately two-step. Minswap pool spends are batcher-gated, so the quote's minimum output is protected in the order but the fill is a later transaction.

## Latest live attempt

The live preprod scan at 2026-10-06 found the Minswap V2 ADA/tUSDC pool at `c82c8c167356d75f842dc6b7d12a18a1473d054a0086f062e0d03fec5808c352#1`, with 1,619,399,138 lovelace and 694,744,792 tUSDC. The quote for 10,000 tUSDC was 23,689 lovelace at 1.603% price impact, below the 3% refusal threshold. The runner reached the x402 seller after the swap phase, but the local facilitator's Blockfrost socket closed during payment construction. No successful payment transaction is claimed.

Run artifact: `settle/runs/1791287328931.json`.

## Evidence

| Event | Transaction | Timing | Cardanoscan |
|---|---|---:|---|
| Minswap order | not confirmed in a completed run | recorded in failed artifact only | [preprod transactions](https://preprod.cardanoscan.io/transactions) |
| Minswap fill | not confirmed in a completed run | recorded in failed artifact only | [preprod transactions](https://preprod.cardanoscan.io/transactions) |
| x402 payment | not completed | facilitator socket failure | [preprod transactions](https://preprod.cardanoscan.io/transactions) |

Pool quote math uses live Koios preprod UTxOs, the 30/10,000 Minswap fee, and exact-out constant-product pricing. A pay asset with no configured mainnet twin is reported as `testnet asset, no mainnet risk data`. Price impact above 3% and a configured HIGH risk verdict refuse before signing.

Run with `set -a; source /Users/user/Desktop/canton/recourse/.env.live; source /Users/user/Desktop/canton/cost-of-trust/mps/.env; set +a; bun settle/run.ts`. The run also requires `BLOCKFROST_API_KEY_PREPROD`, because the legacy Minswap SDK uses Blockfrost for transaction construction, and `SETTLE_SELLER_ADDRESS`.
