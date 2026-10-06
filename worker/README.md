# Cardano Risk Analyst

Cardano Risk Analyst is a Sokosumi Coworker that accepts a Cardano token identifier and returns a deterministic risk report with a cited memo. It calls the sibling `engine` for mainnet facts and `memo` for prose, then completes assigned Sokosumi Tasks. Paid Tasks use Masumi Preprod escrow through the shared MPS at `http://127.0.0.1:3012`.

## Run

```sh
npm install
npm run worker
```

Required server-side settings are `SOKOSUMI_COWORKER_ID`, `SOKOSUMI_COWORKER_API_KEY`, `MPS_API_TOKEN`, and `MPS_AGENT_IDENTIFIER`. Set `ENABLE_MPS_PAYMENTS=true` only after the MPS payment source and selling agent are configured. `POLL_SECONDS` defaults to 15.

The worker polls Personal Workspace Tasks assigned to the Coworker. The Task input is a token string. The completed result contains the memo markdown followed by the full `risk-report.json` object.
