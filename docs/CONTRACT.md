# Cardano Risk Analyst: lane contract

A Sokosumi AI Coworker that does one job: given a Cardano token (policy id, policy.assetName unit, ticker or fingerprint), return a risk memo answering "should I interact with this token?". Data is gathered deterministically from Cardano mainnet; the verdict comes from fixed rules; the LLM only writes the prose and must cite the facts. It gets paid per Task on Sokosumi through Masumi escrow (Preprod).

## engine/ (lane ENGINE): `analyze(input: string): Promise<RiskReport>`
Sources: Koios mainnet `https://api.koios.rest/api/v1` (bearer KAIOS_KEY), Minswap public API, Cardano token registry `https://tokens.cardano.org/metadata/<unit>`.
```ts
type Finding = { id: string; severity: "info" | "low" | "medium" | "high"; title: string; evidence: string /* exact value + source call */ };
type RiskReport = {
  input: string; unit: string; policyId: string; assetNameAscii: string; fingerprint: string;
  identity: { registryName?: string; ticker?: string; decimals?: number; url?: string; inRegistry: boolean };
  policy: { scriptType: "native" | "plutus" | "unknown"; timelockedBefore?: string /* ISO; minting closed after */; requiredSigners: number; mintOpen: boolean };
  supply: { total: string; mintTxCount: number; burnTxCount: number; lastMintAt?: string };
  holders: { count: number; top1Pct: number; top10Pct: number; scriptHeldPct: number /* in contracts e.g. DEX pools */ };
  liquidity: { pools: Array<{ dex: string; tvlAda: number; pair: string }>; totalTvlAda: number };
  activity: { tx24h?: number; firstSeen: string };
  findings: Finding[];
  verdict: "LOW" | "MEDIUM" | "HIGH";   // deterministic: any high -> HIGH; >=2 medium -> MEDIUM; else LOW
  sources: Array<{ call: string; at: string }>;
};
```
Rules (each a Finding, thresholds in engine/rules.ts): mint policy still open (no time lock, few signers) = high; top1 holder > 30% of supply (excluding DEX/script pools) = high; top10 > 70% = medium; no registry entry = medium; total DEX TVL < 10,000 ADA = medium; token younger than 30 days = medium; recent mint after launch = high.
CLI: `bun engine/cli.ts <input>` prints the JSON. Golden tests on 3 real mainnet tokens with recorded responses (e.g. MIN, SNEK, and one low-liquidity token).

## memo/ (lane MEMO): `writeMemo(r: RiskReport): Promise<{ markdown: string; json: RiskReport }>`
OpenRouter (`OPENROUTER_API_KEY`, MODEL `nvidia/nemotron-3-super-120b-a12b:free`, fallback `nvidia/nemotron-3-ultra-550b-a55b:free`; max_tokens >= 800). Prompt gives only the RiskReport JSON; the memo must quote numbers exactly and never add facts; a validator rejects any number in the prose not present in the JSON and retries once, then falls back to a deterministic template. Output sections: Verdict, What this token is, Who controls minting, Who holds it, Can you exit (liquidity), Red flags, Sources.

## worker/ (lane WORKER): Sokosumi Coworker runtime
Mirror `/Users/user/Desktop/canton/cost-of-trust/coworker` (working, registered, rehearsal Task COMPLETED) and the official guide `/Users/user/Desktop/canton/token2049-origins/research/masumi/agent-guide.md`. Reuse the existing Vendor `01a10fcf-be3e-766d-b32c-300330ed9187` and the running MPS at http://127.0.0.1:3012 (owned by cost-of-trust/mps; do not restart it; register a new agent/selling wallet in it). New Coworker "Cardano Risk Analyst". Task input = token string; Task result = memo markdown + JSON file.

## web/ (lane WEB): public landing at port 4402
One input box (token) -> live report rendered from engine + memo; "Hire on Sokosumi" link to the Coworker; examples. Hallmark theme, not Grid.

Credentials (never print): KAIOS_KEY via `set -a; source /Users/user/Desktop/canton/recourse/.env.live`; OPENROUTER_API_KEY via `/Users/user/Desktop/canton/cost-of-trust/coworker/.env.local`.

# Part 2: Aiken Security Reviewer (same submission, second Coworker under the same Vendor)

One submission, two Coworkers that hire each other: the Risk Analyst checks a token from chain data; when the token's minting policy or the protocol it touches is a Plutus script with public Aiken source, it hires the Security Reviewer through Masumi escrow (agent-to-agent, the workshop's "Agent-to-agent network" slide).

The Security Reviewer's rule: no finding is reported unless an exploit test proves it. Input: a public GitHub repo URL (+ optional path) of an Aiken project. Output: a report where each finding carries severity, file:line, the attack transaction shape, and an Aiken test that PASSES against the submitted code (the attack is accepted), plus the suggested fix and a test that fails after the fix where possible. Unconfirmed candidates are listed separately as "needs review", never as findings.

## security/scanner/ (lane SEC-SCANNER): `scan(projectDir): Candidate[]`
Static rules over Aiken source and plutus.json: double satisfaction (outputs checked by address/value without binding to the own input out-ref or a single-script-input rule), missing or one-sided validity-range checks on time-dependent redeemers, missing signer checks, unbounded datum fields an attacker controls at lock time, minting policies without one-shot uniqueness, staking-credential substitution on payouts, `else` handlers that succeed, value checks with >= that allow token dust, redeemers with no state-transition check. Each candidate: { rule, file, line, why, attackSketch }.

## security/exploit/ (lane SEC-EXPLOIT): `confirm(projectDir, candidate): Confirmed | Unconfirmed`
Copies the project to work/<id>/ (gitignored), asks an LLM (OpenRouter, OPENROUTER_API_KEY; pick the best free coder model from https://openrouter.ai/api/v1/models, fallback nvidia/nemotron-3-ultra-550b-a55b:free, max_tokens >= 1500) to write an Aiken attack test for the candidate using the project's own types, runs `~/.aiken/bin/aiken check`, and marks CONFIRMED only if the attack test passes; a control test (honest tx) must also pass. Up to 3 repair attempts feeding back compiler errors. Records the test source.

## security/bench/ (lane SEC-BENCH): ground-truth benchmark
Corpus with known answers: (1) /Users/user/Desktop/canton/cost-of-trust/onchain at commit ce28fef (known: Critical double satisfaction across vault and coverage outputs; High INCONCLUSIVE/early settle with no time window; High report not bound to task) versus commit 6a45d0a (fixed: those must NOT be confirmed); ground truth in /Users/user/Desktop/canton/cost-of-trust/onchain/SECURITY-codex.md, SECURITY-opus.md, SECURITY-FIXED.md. (2) https://github.com/Invariant-0/cardano-ctf vulnerable levels with their documented intended bugs. Runs scan+confirm on each, outputs bench/results.json and bench/RESULTS.md with recall and false-positive counts per target. This is the answer to "how do you know".

## security/worker/ (lane SEC-WORKER): Sokosumi Coworker "Aiken Security Reviewer"
Same Vendor 01a10fcf-be3e-766d-b32c-300330ed9187, same MPS on 3012, guide research/masumi/agent-guide.md. Task input: repo URL. Result: report markdown + exploit tests as a file. Plus the agent-to-agent hook: an HTTP endpoint the Risk Analyst worker calls to hire it (Masumi purchase via MPS), documented for worker/.
