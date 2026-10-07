/* Hallmark · pre-emit critique: P5 H5 E5 S5 R4 V5 */
"use client";

import styles from "./risk-desk.module.css";
import { AgentRun } from "./agent-run";
import { CheckForm } from "./components/check-form";
import { HowItWorks } from "./components/how-it-works";
import { Proven } from "./components/proven";
import { Result } from "./components/result";
import { agentView } from "./components/report";
import { useCheck } from "./components/use-check";

const GUARD_SNIPPET = `import { guardedPay, RefusedPayment } from "@cardano-risk-coworker/guard";

// before
const paid = await client.createPaymentPayload(paymentRequired);
// after
const result = await guardedPay(paymentRequired, { wallet, maxAmount: "2000000" });
// result.paid is true only after the Risk Desk allows the seller
// refused payments throw RefusedPayment with ruleIds`;

const PROOF_SOURCES = [
  {
    image: "/proof/cardano-rug-pulls.png",
    title: "Cardano documents rug pulls as a live ecosystem scam",
    note: "Cardano, undated, accessed 07 Oct 2026",
    href: "https://cardano.org/common-scams/",
  },
  {
    image: "/proof/reddit-scam-tokens.png",
    title: "The r/cardano automod warns about imitation tokens and wallet-draining links",
    note: "u/SL13PNIR, date shown as 3y ago, accessed 07 Oct 2026",
    href: "https://www.reddit.com/r/cardano/comments/1ba4c90/psa_added_new_comment_command_to_the_automod/",
  },
  {
    image: "/proof/cardanoscan-rug-token.png",
    title: "Cardanoscan shows a token named RUG with a rug-themed project link",
    note: "Cardanoscan, token created 24 Jan 2022, accessed 07 Oct 2026",
    href: "https://cardanoscan.io/token/bdb184eadfa9fb6b584e2d16e1a1a738eb80b47752387cf064ac5d16525547?address=addr1q9n5df5hyjjnhpc3rjw69zjj662xdkl8g2azwtfm6k5kqajjtz7y93808mevjgshdsvl9p9q9cpnhapq5c9qpfnx6lsqkj8e0d",
  },
  {
    image: "/proof/x402-issue-508.png",
    title: "x402 issue #508 describes phishing-like paywall fraud against agents",
    note: "kdenhartog, 27 Oct 2025",
    href: "https://github.com/x402-foundation/x402/issues/508",
  },
  {
    image: "/proof/x402-issue-3500.png",
    title: "x402 issue #3500 records a valid payment that exceeded user intent",
    note: "ak68a, 16 Sep 2026",
    href: "https://github.com/x402-foundation/x402/issues/3500",
  },
  {
    image: "/proof/hn-x402-fidelity.png",
    title: "A Hacker News operator reports low service fidelity across x402 endpoints",
    note: "dshaker, 25 Feb 2026",
    href: "https://news.ycombinator.com/item?id=47158809",
  },
] as const;

const OPEN_MINT_TOKENS = [
  ["MIN", "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e"],
  ["IAG", "5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114494147"],
  ["DJED", "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61446a65644d6963726f555344"],
  ["iUSD", "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b6988069555344"],
  ["SUNDAE", "9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d7753554e444145"],
  ["AGIX", "f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc53541474958"],
  ["NTX", "edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e993444794e5458"],
  ["COPI", "b6a7467ea1deb012808ef4e87b5ff371e85f7142d7b356a40d9b42a0436f726e75636f70696173205b76696120436861696e506f72742e696f5d"],
  ["GENS", "dda5fdb1002f7389b33e036b6afee82a8189becb6cba852e8b79b4fb0014df1047454e53"],
  ["WRT", "c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d507357696e67526964657273"],
  ["HUNT", "95a427e384527065f2f8946f5e86320d0117839a5e98ea2c0b55fb0048554e54"],
] as const;

export default function RiskDesk() {
  const check = useCheck();

  return (
    <main className={styles.shell}>
      <header className={styles.nav}>
        <a className={styles.brand} href="/">Cardano Risk Desk</a>
        <nav className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#proven">Proven</a>
          <a href="#guard">For agents</a>
          <a href="/security">Code review</a>
          <a href="/deck">Deck</a>
          <a className={styles.hire} href="https://preprod.sokosumi.com">Hire on Sokosumi</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>The problem</p>
          <h1>Your agent holds a wallet. The seller is a stranger.</h1>
          <p className={styles.lede}>An AI agent with a wallet pays sellers it has never met. It can be asked to pay in a token anyone can print, or to sign for a contract nobody checked. What can it lose?</p>
        </div>
        <CheckForm input={check.input} setInput={check.setInput} loading={check.loading} error={check.error} run={check.run} pick={check.pick} />
      </section>

      <Result report={check.report} loading={check.loading} elapsed={check.elapsed} input={check.input} rerun={check.run} />

      <HowItWorks />

      <Proven />

      <section className={styles.why} aria-labelledby="why-title">
        <p className={styles.kicker}>Why it matters</p>
        <h2 id="why-title">Three ways a payment can look ordinary and still be wrong.</h2>
        <ul className={styles.fear}>
          <li><strong>Open mint policy</strong><span>The issuer can print more of the token after your agent pays.</span></li>
          <li><strong>Fresh address</strong><span>The seller disappears after settlement.</span></li>
          <li><strong>Unknown script</strong><span>The destination is not the protocol it claims to be.</span></li>
        </ul>
      </section>

      <section className={styles.proof} aria-labelledby="proof-title">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>The evidence</p>
          <h2 id="proof-title">This is not a hypothetical failure mode.</h2>
          <p>Cardano users report imitation tokens and rug pulls. x402 contributors report phishing-like paywalls and payments that are valid on chain but wrong for the user.</p>
        </div>
        <div className={styles.proofList}>
          {PROOF_SOURCES.map((source) => (
            <a className={styles.proofItem} href={source.href} key={source.href} target="_blank" rel="noreferrer">
              <img src={source.image} alt="" />
              <span className={styles.proofText}><strong>{source.title}</strong><small>{source.note}</small></span>
              <span className={styles.proofArrow} aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.measurement} aria-labelledby="measurement-title">
        <div>
          <p className={styles.kicker}>Our mainnet measurement</p>
          <h2 id="measurement-title"><span>11</span> of the top 20 have an open mint policy.</h2>
          <p>Measured on 6 Oct 2026 from the engine report for the tokens in <code>engine/top-tokens.json</code>. An open policy means more supply can be minted. Time-locked policies such as SNEK&apos;s, closed at slot 90,915,881, read as controlled.</p>
        </div>
        <div className={styles.tokenList} aria-label="Top 20 tokens with open mint policies">
          {OPEN_MINT_TOKENS.map(([ticker, unit]) => <a href={`https://cardanoscan.io/token/${unit}`} key={unit} target="_blank" rel="noreferrer">{ticker}<span>open mint</span></a>)}
        </div>
      </section>

      <AgentRun />

      <section className={styles.agent} id="guard" aria-labelledby="guard-title">
        <div>
          <span className={styles.kicker}>Integrate in one line</span>
          <h2 id="guard-title">One guard before the seller signature.</h2>
          <p>guardedPay pays the Risk Desk, reads the verdict, and signs the seller payment only when the verdict allows it. DO NOT INTERACT never pays the seller. INTERACT WITH CONDITIONS is refused unless you opt in. The same call ran against this production endpoint: Seller A was paid, Seller B received nothing.</p>
        </div>
        <pre className={styles.json}>{GUARD_SNIPPET}</pre>
      </section>

      <section className={styles.agent} id="agent">
        <div>
          <span className={styles.kicker}>For agents</span>
          <h2>Your agent gets the same answer as JSON.</h2>
          <p>Hire the Risk Desk on Sokosumi before any call that moves value, or call the x402 endpoint directly. Every verdict carries the rule ids and the chain reads behind it.</p>
        </div>
        <pre className={styles.json}>{JSON.stringify(agentView(check.report), null, 2)}</pre>
      </section>

      <footer className={styles.footer}>
        <span>Reads Koios and Blockfrost mainnet, Minswap pools and the Cardano token registry. Every finding carries the call that produced it.</span>
      </footer>
    </main>
  );
}
