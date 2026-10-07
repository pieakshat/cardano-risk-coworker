import styles from "./sections.module.css";

const STEPS = [
  { head: "The seller asks your agent to pay", body: "A seller answers the agent's request with a price and the words 402 Payment Required." },
  { head: "The agent pays the Risk Desk 1 ADA to check first", body: "The Risk Desk reads Cardano mainnet: who can mint the token, who holds it, and whether you can sell it." },
  { head: "The verdict decides", body: "INTERACT, INTERACT WITH CONDITIONS or DO NOT INTERACT, with the rule ids behind it. Only an allowing verdict reaches the wallet signature." },
] as const;

const GLOSS = [
  { term: "Mint policy", def: "The rule inside a Cardano token that says who can create more of it. An open policy means someone still can." },
  { term: "x402", def: "A web payment standard. A server replies 402 Payment Required with a price, and the client pays and retries." },
  { term: "Escrow", def: "A contract holds the payment while the work is done. On Sokosumi, Masumi escrows the task and the result is recorded on chain." },
] as const;

export function HowItWorks() {
  return (
    <section className={styles.how} id="how" aria-labelledby="how-title">
      <p className={styles.kicker}>How it works</p>
      <h2 id="how-title">Three steps between a request and a payment.</h2>
      <ol className={styles.steps}>
        {STEPS.map((s) => <li key={s.head}><b>{s.head}</b><span>{s.body}</span></li>)}
      </ol>
      <dl className={styles.gloss}>
        {GLOSS.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>)}
      </dl>
    </section>
  );
}
