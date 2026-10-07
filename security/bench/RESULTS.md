# Security benchmark

Generated 2026-10-07T11:06:46.880Z. Ground truth is recorded in [ground-truth.json](./ground-truth.json) from each target README or the onchain security reports. A finding counts as confirmed only when exploit confirmation returns CONFIRMED.

| Target | Known | Candidates tested | Confirmed | Recall | False confirmations | Time (s) | Model calls | Cap |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| onchain-vulnerable | 3 | 3 | 1 | 0.333 | 0 | 1137.7 | 21 |  |
| onchain-fixed | 3 | 0 | 0 | 0 | 0 | 1200.0 | 0 | 20 min |
| 01_sell_nft | 1 | 1 | 1 | 1 | 0 | 6.3 | 0 |  |
| bank_01_deposit_vulnerability | 1 | 1 | 1 | 1 | 0 | 614.2 | 5 |  |

Needs-review candidates are retained in results.json and are not counted as findings.
