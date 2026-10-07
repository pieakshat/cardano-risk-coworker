# Cardano Risk Desk: project write-up

Live: https://cardano-risk-coworker.vercel.app · Paid API: `POST /api/x402/risk-check` · Sokosumi Coworkers: Risk Analyst (`01a11080-a6c3-7686-abf4-b0d1594cb82b`), Aiken Security Reviewer (`01a11117-ad9f-71a5-a792-45d15c8c9ae0`)

## The problem

An AI agent with a Cardano wallet can now pay anyone. x402 makes it one HTTP round trip: a seller answers `402 Payment Required` with a price and an asset, and the agent signs. Nothing in that loop asks whether the seller, or the token it wants to be paid in, deserves the money.

On Cardano that question has real answers sitting on chain. A native token's mint policy says who can create more of it. A script address says what code holds the funds. A receiving wallet has a history or it does not. A person checks these by opening an explorer. An agent paying in a loop does not, and it signs whatever the seller asks for.

Cardano Risk Desk is the approval step that sits between an agent's x402 request and its seller payment.

## What it does

The agent sends the seller's payment request (or any token ticker, policy id or contract address) and pays the Risk Desk 1 ADA over x402. It gets back one of three verdicts, each with the rule ids that fired and the chain calls behind them:

- `INTERACT`
- `INTERACT WITH CONDITIONS`
- `DO_NOT_INTERACT`

The verdict comes from three checks, asked in plain words:

1. **Who controls it?** Can someone mint more, upgrade the script or drain it on their own?
2. **Is the code safe?** Does the contract hold when someone attacks it?
3. **Can you get in and out?** Is there liquidity for your size at a fair price?

The first screen of the site answers in a sentence. For MIN it says: "Do not let your agent pay in MIN: whoever holds the policy key can mint more at any time." For the Minswap V2 pool address it says the contract is a recognised Minswap V2 pool script. SNEK's policy is time-locked (`all[before slot 90915881, sig]`); the Risk Desk reads it against the current slot, sees that the minting window has closed, and treats the supply as controlled.

### One line to integrate

```ts
const result = await guardedPay(paymentRequired, { wallet, maxAmount: "2000000" });
// result.paid is true only after the Risk Desk allows the seller
// a refused seller throws RefusedPayment with the rule ids
```

`guardedPay` wraps the x402 client. It buys a Risk Desk check, and only an allowing verdict reaches the wallet signature. A refused seller never sees a signed payment.

### Proven on chain

- **Production x402 check.** The deployed endpoint answers 402, settles a paid check on Cardano preprod (`66d28ffb`), and returns HTTP 409 when the same payment is replayed.
- **Two sellers, one agent.** On preprod one agent checks two x402 sellers. Seller A has an established receiving wallet, gets `INTERACT` and is paid 2 ADA (`96bbd1de`). Seller B wants payment in a token with an open mint policy, from an address with a single transaction; it gets `DO_NOT_INTERACT` and receives nothing. We ran this twice from the agent and once through `guardedPay` against production.
- **A fully paid Sokosumi task.** The Risk Analyst Coworker checked MIN through Sokosumi: the buyer's ADA was locked in Masumi escrow (`d4297275`), the result was submitted on chain (`7748d932`), and the seller collected the payment (`a07abc23`). Verdict: `DO NOT INTERACT`.
- **A confirmed exploit.** The Aiken Security Reviewer took Invariant-0's `cardano-ctf` level `01_sell_nft` on Sokosumi task `01a11579` and returned a confirmed double-satisfaction finding: one payment output satisfies two script inputs spent in the same transaction. The attack test it generated passes against the contract and fails against a patched copy that allows only one script input, so the finding is proven by execution, not by pattern matching.

## Technical approach

### Chain reads

- **Koios** for policy scripts, asset info, holder distribution, address history and transaction status. Native scripts are parsed into their `all` / `any` / `before` / `after` / `sig` tree and evaluated against the current slot, which is how a time-locked policy is told apart from an open one.
- **Blockfrost** as a second indexer for address and asset reads.
- **Cardano token registry** data for names and decimals, and **Minswap** pool data for liquidity and price impact.
- A table of known script hashes (`engine/known-scripts.json`) recognises established contracts such as Minswap V2 pools.

Every read is recorded with its endpoint and the value it returned, so each verdict carries its own evidence.

### Decision engine

`engine/rules.ts` turns those reads into rules with stable ids (for example an open mint policy, a one-transaction receiving address, or concentrated holders). `preflight/` scores a seller's x402 payment request before signature. The verdict is the strictest result of the three checks, and every rule that fired is returned to the caller.

### Aiken Security Reviewer

The reviewer clones the submitted Aiken repository, detects the compiler and stdlib version (legacy v1.0.24-alpha or current v1.1), and scans validators for known Cardano attack shapes such as double satisfaction. For each candidate it generates an attack test and runs `aiken check`. A finding is reported as confirmed only when the attack test passes on the submitted source. A benchmark against known-vulnerable CTF levels (`security/bench`) guards against regressions.

### Payments and agents

- **x402 v2** with `@x402/cardano`: Cardano `exact` payments, one-time payment ids, replay rejection.
- **Masumi payment service** for escrowed Sokosumi tasks: lock, result submission and collection all on chain.
- **Sokosumi Coworkers** so people and other agents can hire the Risk Analyst and the Security Reviewer directly.

### Tools and infrastructure

| Layer | Technology |
| --- | --- |
| Chain data | Koios, Blockfrost, Cardano token registry, Minswap |
| Contracts reviewed | Aiken (v1.0.24-alpha and v1.1 toolchains), Plutus |
| Agent payments | x402 v2, `@x402/cardano` |
| Agent marketplace | Masumi payment service, Sokosumi Coworkers |
| Services | Bun and TypeScript |
| Web | Next.js on Vercel (check form, x402 API, deck) |
| Workers | Fly.io (Risk Analyst and Security Reviewer task workers) |

## Deploying and scaling it in the real world

**Where it sits.** The Risk Desk belongs in the payment path of any agent that holds a wallet: inside an agent framework's x402 client, inside a wallet SDK, or in front of a marketplace's checkout. `guardedPay` is a single function, so an existing agent adopts it by changing one call.

**Cost per check.** A check is a small set of indexed reads plus deterministic rule evaluation, with no model call in the decision path. Policy scripts, script hashes and registry data rarely change, so results cache well per policy id and address; the live checks we ran answered in seconds. That makes 1 ADA per check viable at the volume agents pay at, and the work scales horizontally on stateless web servers.

**Security reviews at scale.** Contract reviews are heavier, so they run as queued jobs on workers, each in its own working directory with a pinned Aiken toolchain. More workers means more reviews in parallel. Confirmed findings come with a runnable test, which makes them cheap for a contract author to verify and fix.

**Moving to mainnet.** The chain reads already run against mainnet data (the MIN, SNEK and Minswap verdicts are mainnet assets). Payments run on preprod today; mainnet means switching the x402 network id and pointing the Masumi payment service at mainnet. The rules do not change.

**Getting stronger with use.** Every refused payment is a labelled example of a seller an agent should not have paid. The known-script table and the rule set grow from those cases, and a team that ships a new Cardano contract can have it reviewed by the same Coworker before any agent is asked to pay into it.
