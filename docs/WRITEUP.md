# Cardano Token Analyst

## Problem

Token names and social claims do not answer the pre-swap question: who controls minting, who holds the supply, and can a buyer exit through available liquidity? An autonomous buyer needs a compact, cited decision before it sends value.

## Approach

The Coworker accepts one token identifier and produces two linked artifacts:

1. A `RiskReport` assembled from live Cardano and market data.
2. A memo written only from that report, with source calls and exact numbers.

Rules stay deterministic. An open minting policy, concentrated ownership, recent minting, absent registry identity, low liquidity, or a young token becomes a finding with a fixed severity. The memo layer explains those facts, but it does not choose the verdict. On the refreshed reports, MIN is HIGH for its open one-signer policy, SNEK is LOW with a timelocked policy and 2.39% top holder concentration across the largest 88 holder addresses sampled, and MINt is HIGH for open minting plus 1,766.66 ADA of Minswap liquidity.

The second Coworker, Aiken Security Reviewer, extends the loop to public Aiken projects. It scans for candidates, generates an exploit test, and reports a finding only when the attack test passes against the submitted source. The Risk Analyst can hire it agent-to-agent through Masumi escrow, so a token review and a script review share one paid Task boundary.

## Cardano infrastructure

### Blockfrost holder sample

The engine reads the top-100 holder sample from Blockfrost mainnet, separates script-held supply, and flags the sample in the report. This gives the buyer a bounded, inspectable concentration signal alongside policy and liquidity facts.

### Koios

Koios mainnet is the chain data source for asset facts, policy scripts, holder addresses, supply, and first-seen timestamps. Holder pages are bounded and script addresses are separated before concentration is calculated.

### Minswap

Minswap's public API supplies pool pairs and ADA liquidity. The report sums the matching pool TVL so a buyer sees practical exit depth rather than a token name alone.

### Cardano token registry

The registry anchors the identity check: name, ticker, decimals, URL, and registry presence. A missing entry is itself a medium finding.

### Masumi MPS

Masumi MPS supplies the payment and identity boundary for paid Tasks. The Worker completes a Sokosumi Task with the markdown memo and JSON report, while escrow settles the seller wallet on Preprod.

### Sokosumi

Sokosumi is the discovery and Task surface. A buyer hires Cardano Risk Analyst with a token string, receives the report, and can use the same payment path to hire Aiken Security Reviewer for a public script review.

### x402

x402 is the adjacent HTTP payment pattern: a service advertises a paid response and the buyer retries with payment proof. This project uses Sokosumi and Masumi escrow for the Coworker Task boundary, while keeping the report itself portable as markdown plus JSON.

## Why the split matters

The chain facts, deterministic rules, memo, and payment receipt are separate evidence layers. A reviewer can inspect the JSON, trace a finding to its source call, read the prose, and follow the Task settlement without treating model text as the source of truth.

## Exploit-gated security review

The live Security Reviewer scans a public Aiken repository, turns scanner candidates into attack tests, and runs each test against the submitted source. A finding is returned only when the exploit test passes, with the rule, file and line, attack shape, and test evidence attached. Candidates without a passing exploit test stay in review material and do not become findings.
