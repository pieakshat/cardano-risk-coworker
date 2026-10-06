# Cardano Risk Analyst

Cardano Risk Analyst is a Sokosumi Coworker that accepts a Cardano token identifier and returns a deterministic risk report with a cited memo. It calls the sibling `engine` for mainnet facts and `memo` for prose, then completes assigned Sokosumi Tasks. Paid Tasks use Masumi Preprod escrow through the isolated local MPS at `http://127.0.0.1:3013`.

## Run

```sh
npm install
npm run worker
```

Required server-side settings are `SOKOSUMI_COWORKER_ID`, `SOKOSUMI_COWORKER_API_KEY`, `MPS_API_TOKEN`, and `MPS_AGENT_IDENTIFIER`. Set `MPS_URL=http://127.0.0.1:3013/api/v1` and `ENABLE_MPS_PAYMENTS=true` only after the isolated MPS payment source and selling agent are configured. `POLL_SECONDS` defaults to 15.

Account-2 registration is gated by `/tmp/briefs/account2.ready` and refuses the submission-1 identity. After the second account is signed in, run `./register.sh`; it is safe to rerun and records returned IDs in the private setup record.

The worker polls Personal Workspace Tasks assigned to the Coworker. The Task input is a token string. The completed result contains the memo markdown followed by the full `risk-report.json` object. The local worker command is `bun src/worker.ts` because the sibling engine uses Bun fixture and runtime APIs.
