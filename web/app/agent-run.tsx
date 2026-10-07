import styles from "./agent-run.module.css";

const tx = (hash: string) => `https://preprod.cardanoscan.io/transaction/${hash}`;
const short = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-4)}`;

// Source: agent-demo/runs/1791298553018.json. Every hash confirmed by Koios preprod tx_status on 2026-10-07.
const sellers = [
  {
    name: "Seller A",
    asks: "2 ADA, paid to a wallet with 27 transactions since 5 Oct",
    decision: "INTERACT",
    rules: "no blocking rule, no condition",
    check: "fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31",
    outcome: { label: "Agent pays the seller", hash: "3866ed31eb44b4278abfdb897c377e3d69a6d5c9e8649df8a966ba11d252659a" },
  },
  {
    name: "Seller B",
    asks: "5 units of a token whose mint policy is still open, paid to an address with 1 transaction, first seen that day",
    decision: "DO_NOT_INTERACT",
    rules: "blocking asset-mint-open; conditions counterparty-first-seen, counterparty-tx-count",
    check: "fad4fce27239cd0850bfa49100bebf00064780e9e908f4b61166d3461784a1ad",
    outcome: { label: "Agent refuses. Nothing is sent to the seller." },
  },
];

// Source: live POST https://cardano-risk-coworker.vercel.app/api/x402/risk-check without payment, 2026-10-07.
const challenge = `HTTP/1.1 402 Payment Required
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "cardano:preprod",
    "amount": "1000000",
    "asset": "lovelace",
    "payTo": "addr_test1qq0zga2c…q3c7zyq",
    "maxTimeoutSeconds": 600,
    "extra": { "confirmationPolicy": { "l1Confirmations": 0 } }
  }]
}`;

export function AgentRun() {
  return (
    <section className={styles.run} aria-labelledby="run-h">
      <p className={styles.kicker}>One agent, two sellers, Cardano preprod</p>
      <h2 id="run-h" className={styles.title}>It paid one seller and refused the other.</h2>
      <p className={styles.lede}>Both sellers answered with an x402 payment request. Before paying either, the agent paid the Risk Desk 1 ADA to check the request, then did what the verdict said.</p>
      <div className={styles.pair}>
        {sellers.map((s) => (
          <article key={s.name} className={styles.seller} data-decision={s.decision}>
            <h3>{s.name}</h3>
            <p className={styles.asks}>Asks {s.asks}.</p>
            <dl>
              <div><dt>Risk check paid</dt><dd><a href={tx(s.check)}>{short(s.check)}</a></dd></div>
              <div><dt>Verdict</dt><dd className={styles.decision}>{s.decision}</dd></div>
              <div><dt>Rules</dt><dd>{s.rules}</dd></div>
              <div><dt>{s.outcome.label}</dt><dd>{s.outcome.hash ? <a href={tx(s.outcome.hash)}>{short(s.outcome.hash)}</a> : "no transaction"}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <div className={styles.wire}>
        <p className={styles.kicker}>What an agent sees first</p>
        <p className={styles.lede}><code>POST /api/x402/risk-check</code> answers 402 with these terms. The agent pays them, retries with the signed payment, and gets the verdict back as JSON.</p>
        <pre className={styles.code}><code>{challenge}</code></pre>
      </div>
    </section>
  );
}
