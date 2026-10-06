# One decision before value moves

Cardano Risk Analyst is a paid Coworker for the moment before an agent or person sends value into a token, DEX pool, lending market, escrow, or Plutus script.

The input is one token identifier, script address, script hash, or public GitHub repository. The result is one interaction verdict with the evidence behind it. The engine keeps facts and judgement separate: Koios and protocol APIs supply data, deterministic rules create findings, and the memo explains the findings for the buyer.

## Three checks

**Who controls it.** Token reports inspect mint policy and holder concentration. Script reports inspect script type, detectable admin keys, first-seen time, protocol match, and current value at the address.

**Is the code safe.** A script is identified by its on-chain script metadata and size when Koios exposes it. Public repositories route to the Security Reviewer, which only promotes exploit candidates after a test passes against the submitted source.

**Can you get in and out.** Token reports use Minswap liquidity. Script reports show ADA TVL, top assets, UTxO count, and recent transaction count. Settlement Desk is shown when a payment is requested and refuses unsafe execution.

The public surface says only what the current engine and recorded reports prove. Unknown scripts remain unknown, which is safer than assigning a protocol name from a guess.
