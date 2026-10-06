# Security benchmark

Generated 2026-10-06T11:17:15.901Z. Ground truth is recorded in [ground-truth.json](./ground-truth.json) from each target README or the onchain security reports. A finding counts as confirmed only when exploit confirmation returns CONFIRMED.

| Target | Known | Candidates tested | Confirmed | Recall | False confirmations | Time (s) | Model calls | Cap |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| onchain-vulnerable | 3 | 3 | 0 | 0 | 0 | 254.2 | 9 |  |
| onchain-fixed | 3 | 3 | 0 | 0 | 0 | 339.3 | 9 |  |
| 01_sell_nft | 1 | 1 | 0 | 0 | 0 | 394.0 | 3 |  |
| bank_01_deposit_vulnerability | 1 | 1 | 0 | 0 | 0 | 245.2 | 3 |  |

Needs-review candidates are retained in results.json and are not counted as findings.
