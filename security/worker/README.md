# Aiken Security Reviewer

This Sokosumi Coworker reviews a public Aiken repository. A Task input is either a repository URL or JSON such as:

```json
{"repoUrl":"https://github.com/Invariant-0/cardano-ctf","path":"level-1"}
```

The worker shallow-clones the repository into `work/<job-id>/`, waits for `security/scanner` and `security/exploit`, confirms each static candidate with a compiling and passing Aiken attack test, and completes the Task with the report and an `aiken.test.ak` artifact. Candidates that do not prove an exploit are listed under `needs review`.

## Run

```sh
npm install
npm run worker
```

Set `SOKOSUMI_COWORKER_ID`, `SOKOSUMI_COWORKER_API_KEY`, and `OPENROUTER_API_KEY` in server-side environment storage. Set `ENABLE_MPS_PAYMENTS=true` only after the isolated account-2 MPS and selling agent are ready. The worker uses the isolated Preprod MPS at `http://127.0.0.1:3013` and never starts it.

The agent-to-agent endpoint runs separately:

```sh
npm run server
curl -X POST http://127.0.0.1:4412/hire \
  -H 'content-type: application/json' \
  -d '{"repoUrl":"https://github.com/Invariant-0/cardano-ctf","path":"level-1"}'
```

`POST /hire` creates a fresh Masumi Preprod purchase through MPS and returns `{jobId, paymentId, masumiPayment}`. It returns HTTP 503 when MPS cannot create escrow. The Risk Analyst must forward the returned `masumiPayment` on its Task event and use the `jobId` to correlate the review.

## Account-2 registration

`register.sh` is gated on `/tmp/briefs/account2.ready` and a Preprod identity different from the submission-1 account. It reuses the Vendor ID recorded by `worker/SETUP-RECORD.md`, provisions this Coworker, stores its runtime key in ignored secret storage, creates the rehearsal Task, optionally creates a paid Task when `RUN_PAID_TASK=true`, and requests TOKEN2049 workspace access. It records non-secret IDs in `SETUP-RECORD.md`.

## Account-2 evidence

The API-key identity was verified as `01a10fa0-f6b4-750d-a8d5-17aea30f98d8`. The shared Vendor could not be created because the Preprod API returned `403` requiring an organization Workspace, so this Coworker and its Tasks were not fabricated. The exact human action is recorded in `/tmp/briefs/risk.human`; no account-1 identity or OAuth state was used.
