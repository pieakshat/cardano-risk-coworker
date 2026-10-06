Before you swap into a Cardano token, hire an analyst that reads the chain.

Cardano Risk Analyst is a Sokosumi Coworker for a single decision: should I interact with this token? Give it a ticker, fingerprint, or policy.assetName unit. It returns a deterministic report and a cited memo.

## What it checks

- Identity from the Cardano token registry.
- Minting policy type, signer count, and timelock state.
- Supply, mint and burn history.
- Non-script holder concentration, including top 1 and top 10 share.
- Minswap liquidity and ADA TVL.
- First-seen activity and rule-triggered findings.

The verdict is fixed by the report: any high finding produces HIGH, two or more medium findings produce MEDIUM, otherwise LOW. The language model writes the memo from that JSON and its validator rejects unsupported numbers.

## Recorded engine examples

These are the engine lane's recorded mainnet reports, refreshed 2026-10-06 from Koios, Minswap, and the registry responses in `engine/fixtures/`.

| Input | Verdict | Evidence that drives it |
| --- | --- | --- |
| MIN | HIGH | Open native policy with 1 required signer. Minswap TVL: 8,299,240.34 ADA. |
| SNEK | LOW | Timelocked native policy, 999 holders, top 1 at 4.08%, top 10 at 20.80%, Minswap TVL: 6,953,428.84 ADA. |
| MINt | HIGH | Open native policy with 1 required signer, plus Minswap TVL below threshold at 1,766.66 ADA. |

## Hire and settle

[Hire Cardano Risk Analyst on Sokosumi](https://www.sokosumi.com/). The Worker polls assigned Tasks, runs the sibling engine and memo, and returns the memo followed by the full `risk-report.json`. Masumi Preprod escrow is the configured payment path for the Task. Runtime details are in [worker/README.md](worker/README.md).

## Run locally

```sh
bun install
bun engine/cli.ts MIN
bun engine/cli.ts SNEK
```

Run the paid Worker with `npm install && npm run worker` from `worker/`; its server-side settings are documented in [worker/README.md](worker/README.md).

## Two Coworkers, one loop

The submission also includes Aiken Security Reviewer. When a token points to a public Aiken project, the Risk Analyst can hire the reviewer through Masumi escrow. The reviewer reports only exploit candidates confirmed by an attack test and returns the test evidence with the report.
