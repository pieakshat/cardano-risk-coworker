import styles from "./sections.module.css";

const tx = (hash: string) => `https://preprod.cardanoscan.io/transaction/${hash}`;
const short = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-6)}`;

const ESCROW = "d429727560321bf615a15c0a917c8dc09acc7edd9f378f77b2e81d2bad1b9dd7";
const RESULT = "7748d9324313b70e3483a17df763f180d6afdc60783b69d811a228a45b1d7119";

export function Proven() {
  return (
    <section className={styles.proven} id="proven" aria-labelledby="proven-title">
      <p className={styles.kicker}>Proven on Sokosumi</p>
      <h2 id="proven-title">Two Coworkers, hired on Sokosumi, answered on real targets.</h2>
      <div className={styles.pair}>
        <article>
          <h3>Risk Desk checks MIN</h3>
          <p className={styles.asks}>The Cardano Risk Desk, listed on Sokosumi as the Risk Analyst Coworker, was hired and paid through Masumi escrow to check MIN.</p>
          <dl>
            <div><dt>Task</dt><dd>01a1152f-6ac1-76c8-b245-b0bccff73ee2</dd></div>
            <div><dt>Verdict</dt><dd className={styles.bad}>DO NOT INTERACT</dd></div>
            <div><dt>Escrow payment</dt><dd><a href={tx(ESCROW)} target="_blank" rel="noreferrer">{short(ESCROW)}</a></dd></div>
            <div><dt>Result submitted on chain</dt><dd><a href={tx(RESULT)} target="_blank" rel="noreferrer">{short(RESULT)}</a></dd></div>
          </dl>
        </article>
        <article>
          <h3>Security Reviewer breaks a contract</h3>
          <p className={styles.asks}>The Aiken Security Reviewer Coworker read <a href="https://github.com/Invariant-0/cardano-ctf/tree/main/01_sell_nft" target="_blank" rel="noreferrer">Invariant-0/cardano-ctf 01_sell_nft</a> and confirmed the exploit by running it.</p>
          <dl>
            <div><dt>Task</dt><dd>01a11579-9cce-70dd-86bd-9da3a5772a31</dd></div>
            <div><dt>Finding</dt><dd className={styles.bad}>CONFIRMED double satisfaction</dd></div>
            <div><dt>What it means</dt><dd>One payment satisfies two script inputs.</dd></div>
            <div><dt>Proof</dt><dd>An exploit test passes on the contract and fails on a patched one.</dd></div>
          </dl>
        </article>
      </div>
    </section>
  );
}
