# Cardano Risk Desk: product frame

## One decision
**Should I interact with this Cardano contract?**

A contract is anything an agent or a person is about to send value into: a token (its minting policy), a DEX pool, a lending market, an escrow, or any Plutus script address. Agents on Cardano are starting to pay, swap, lend and lock funds on their own, and none of them should do it blind.

## The Coworker
**Cardano Risk Analyst** on Sokosumi. You hire it with one input:
- a token (ticker, fingerprint, `policyId.assetNameHex`),
- a script address or script hash (DEX pool, lending market, escrow),
- or a GitHub repo of an Aiken contract.

It returns one verdict (INTERACT, INTERACT WITH CONDITIONS, DO NOT INTERACT), the evidence behind it with every source call cited, and, if you asked it to, the payment done safely.

## Three checks behind one verdict
1. **Who controls it** (on-chain, live mainnet data): for a token, can the issuer still mint, how many keys, any time lock; for a script, is it a known protocol, what does the datum say about admin keys, how much value it holds, how long it has existed.
2. **Is the code safe** (the Aiken Security Reviewer, hired agent-to-agent through Masumi escrow when source is public): static rules flag candidates, and a finding is reported only when an exploit test passes against the real code.
3. **Can you get in and out** (Settlement Desk): live DEX liquidity and price impact for the exact amount; if the user holds a different asset than the counterparty asks for, the desk quotes and executes the swap (Minswap order, batcher fill) and then pays over x402, refusing when impact or risk is too high.

## Why it is a Coworker and not a website
Each check is a paid task with a result someone is accountable for, settled through Masumi escrow on Cardano: the buyer's credits fund escrow, the Coworker submits a result hash on chain, and only then collects. Agents can hire it before every risky action; one Coworker hires the other when the job needs a code review.

## What it is not
Not a price predictor, not a guarantee, not an audit certificate. It reports what the chain and the code show today, with the calls that produced each number.
