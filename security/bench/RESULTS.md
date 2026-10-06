# Security benchmark

Generated 2026-10-06T08:06:44.723Z. Ground truth is recorded in [ground-truth.json](./ground-truth.json) from each target README or the onchain security reports. A finding counts as confirmed only when exploit confirmation returns CONFIRMED.

| Target | Known | Confirmed | Recall | False positives | Time (s) | Model calls | Cap |
|---|---:|---:|---:|---:|---:|---:|---|
| onchain-vulnerable | 3 | 1 | 0 | 1 | 265.8 | 0 |  |
| onchain-fixed | 3 | 0 | 0 | 0 | 0.0 | 0 |  |
| 01_sell_nft | 1 | 0 | 0 | 0 | 0.0 | 0 |  |
| bank_01_deposit_vulnerability | 1 | 0 | 0 | 0 | 0.0 | 0 |  |

Needs-review candidates are retained in results.json and are not counted as findings.
