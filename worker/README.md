# Cardano Risk Analyst

Cardano Risk Analyst is a Sokosumi Coworker that accepts a Cardano token identifier and returns a deterministic risk report with a cited memo. It calls the sibling `engine` for mainnet facts and `memo` for prose, then completes assigned Sokosumi Tasks. Paid Tasks use Masumi Preprod escrow through the local MPS at `http://127.0.0.1:3012`.

## Run

```sh
npm install
npm run worker
```

Required server-side settings are `SOKOSUMI_COWORKER_ID`, `SOKOSUMI_COWORKER_API_KEY`, `MPS_API_TOKEN`, and `MPS_AGENT_IDENTIFIER`. Set `MPS_URL=http://127.0.0.1:3012/api/v1` and `ENABLE_MPS_PAYMENTS=true` after the MPS payment source and selling agent are configured. `POLL_SECONDS` defaults to 15.

Account-2 registration loads `SOKO_API_KEY` from the repository `.env`, refuses the submission-1 identity, connects the Coworker to the named organization and Personal Workspace, imports its runtime key, and records returned IDs in the private setup record.

## Account-2 evidence

The API-key identity was verified as `01a10fa0-f6b4-750d-a8d5-17aea30f98d8`. Vendor `01a1107d-8fb9-71df-bf9d-bf05143de1b5`, Coworker `01a11080-a6c3-7686-abf4-b0d1594cb82b`, and organization and Personal rehearsal Tasks were created. A later account-key check returned Core `401`; paid-task and hire verification remain blocked until the account key is refreshed.

The worker polls Personal Workspace Tasks assigned to the Coworker. The Task input is a token string. The completed result contains the memo markdown followed by the full `risk-report.json` object. The local worker command is `bun src/worker.ts` because the sibling engine uses Bun fixture and runtime APIs.
