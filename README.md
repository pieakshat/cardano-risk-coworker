Before you swap into a Cardano token, hire an analyst that reads the chain.

Cardano Risk Analyst is a Sokosumi Coworker for a single decision: should I interact with this token? Give it a ticker, fingerprint, or policy.assetName unit. It returns a deterministic report and a cited memo.

## What it checks

- Identity from the Cardano token registry.
- Minting policy type, signer count, and timelock state.
- Supply, mint and burn history.
- Non-script holder concentration, including top 1 and top 10 share.
- Minswap liquidity and ADA TVL.
- First-seen activity and rule-triggered findings.
- Blockfrost mainnet holder data, sampled from the top 100 addresses and flagged in the memo when concentration is material.

The verdict is fixed by the report: any high finding produces HIGH, two or more medium findings produce MEDIUM, otherwise LOW. The language model writes the memo from that JSON and its validator rejects unsupported numbers.

## Recorded engine examples

These are the engine lane's recorded mainnet reports, refreshed 2026-10-06 from Koios, Minswap, and the registry responses in `engine/fixtures/`.

| Input | Verdict | Holder evidence | Evidence that drives it |
| --- | --- | --- |
| MIN | HIGH | Largest 94 holder addresses sampled; top 1 is 0.72%, top 10 is 1.11%. | Native mint policy with 1 required signer and no time lock. Blockfrost holder sample is flagged. |
| SNEK | LOW | Largest 88 holder addresses sampled; top 1 is 2.39%, top 10 is 6.57%. | Timelocked native policy. |
| MINt | HIGH | Largest 99 holder addresses sampled; top 1 is 0.56%, top 10 is 0.99%. | Open native policy with 1 required signer, plus Minswap TVL below threshold at 1,766.66 ADA. |

## Hire it

Cardano Risk Analyst is available through the registered Coworker record:

- Coworker: `01a11080-a6c3-7686-abf4-b0d1594cb82b`

The Worker polls assigned Tasks, runs the sibling engine and memo, and returns the memo followed by the full `risk-report.json`. Masumi Preprod escrow is the configured payment path for the Task. Runtime details are in [worker/README.md](worker/README.md).

## Run locally

```sh
bun install
bun engine/cli.ts MIN
bun engine/cli.ts SNEK
```

Run the paid Worker with `npm install && npm run worker` from `worker/`; its server-side settings are documented in [worker/README.md](worker/README.md).

## Two Coworkers, one loop

The submission also includes Aiken Security Reviewer. When a token points to a public Aiken project, the Risk Analyst sends the repository to the live scanner, which produces candidates, generates attack tests, runs them against the submitted source, and returns test evidence. The reviewer reports a finding only when the exploit test passes; candidates without a passing exploit test remain review material rather than findings.
