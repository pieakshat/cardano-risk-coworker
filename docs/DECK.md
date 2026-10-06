# Cardano Token Analyst deck

1. **Before you swap, hire an analyst that reads the chain.** A paid Cardano Risk Analyst Coworker returns a cited token verdict.
2. **The decision comes before the swap.** Identity, minting control, holder concentration, and exit liquidity are the buyer's questions.
3. **One deterministic report.** Resolve the token, gather chain and market facts, score fixed rules, and explain the result.
4. **What the chain contributes.** Koios for mainnet facts, Minswap for liquidity, the Cardano token registry for identity, Masumi MPS for escrow.
5. **Verdicts answer a narrow question.** LOW, MEDIUM, and HIGH are derived from findings, not chosen by the language model.
6. **Evidence is the product.** Every finding includes an exact value and source call. A memo validator rejects unsupported numbers.
7. **Two Coworkers, one payment loop.** Risk Analyst checks the token. Aiken Security Reviewer scans live and confirms candidates with passing attack tests. Sokosumi discovery and Masumi escrow connect them.
8. **Hire it and follow settlement.** Start a Task with `MIN` or a public Aiken repository, receive the memo or security report, and verify the seller-wallet payout on Preprod.

9. **Live engine proof.** MIN is HIGH because its native mint policy has one signer and no time lock. SNEK is LOW with a timelocked policy and 2.39% top-holder concentration across the largest 88 holder addresses sampled. Blockfrost contributes a flagged top-100 mainnet holder sample.

10. **Exploit-gated security.** The live scanner produces candidates, generates attack tests, and promotes a finding only after the exploit test passes against the submitted source.

The editable source is [deck/build_cardano_risk.py](../deck/build_cardano_risk.py). The generated presentation is [deck/cardano-risk-analyst.pptx](../deck/cardano-risk-analyst.pptx).
