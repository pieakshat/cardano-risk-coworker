# Cardano Risk Analyst

Cardano Risk Analyst is a Sokosumi Coworker for one decision: **should I interact with this Cardano contract?**

Enter a token, script address, 56-hex script hash, or GitHub contract repository. The analyst returns one cited verdict: **INTERACT**, **INTERACT WITH CONDITIONS**, or **DO NOT INTERACT**.

The verdict is built from three checks: who controls it, whether the code surface is safe, and whether value can get in and out. For scripts, the engine reads Koios mainnet data for script type, size when available, first-seen time, ADA and top-asset value, UTxOs, recent transactions, and known protocol matches. Unknown scripts holding more than 100,000 ADA and scripts younger than 30 days are medium findings. A detectable single admin key is high.

Tokens retain the evidence path for minting policy, holder concentration, registry identity, and Minswap liquidity. Public GitHub repositories route to the Aiken Security Reviewer.

## Run locally

```sh
bun install
bun test engine/engine.test.ts
cd web && npm run build
```

The live API uses `KAIOS_KEY` and, for holder sampling, `BLOCKFROST_API_KEY_MAINNET`. Secrets stay in environment files and are never printed.

## Evidence boundary

Every report includes the source calls that produced its numbers. A missing protocol hash match stays unknown. The analyst reports what the chain and code show today. It is not an audit certificate or a guarantee.
