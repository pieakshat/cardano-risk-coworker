"use client";

import { useEffect, useState } from "react";
import styles from "./deck.module.css";

type Slide = {
  kicker: string;
  title: string;
  lead?: string;
  body: React.ReactNode;
};

// Values are copied from engine/reports/MIN.json, SNEK.json, MINt.json and POOL-MINSWAP.json.
const slides: Slide[] = [
  {
    kicker: "CARDANO RISK ANALYST",
    title: "Should my agent pay this Cardano counterparty?",
    lead: "A paid preflight check before value moves.",
    body: <p className={styles.prompt}>Use ← → to read. Press P to open the human Risk Desk.</p>,
  },
  {
    kicker: "THE DECISION",
    title: "The decision comes before the transaction.",
    lead: "A counterparty is the thing your agent is about to send value into.",
    body: <div className={styles.columns}><Panel title="Token">Mint policy, holders, registry identity, pool exit</Panel><Panel title="Script">Protocol identity, TVL, UTxOs, recent transactions</Panel><Panel title="x402 seller" accent>PayTo, asset, amount, resource, timeout</Panel></div>,
  },
  {
    kicker: "THE CHECKS",
    title: "Three evidence checks become one verdict.",
    lead: "The report keeps facts and judgment separate.",
    body: <div className={styles.columns}><Panel title="01  Who controls it">Mint policy open? Admin key? First seen when? Known protocol?</Panel><Panel title="02  Is the code safe">Script type and size. Public Aiken source. Exploit test before finding.</Panel><Panel title="03  Can you get in and out" accent>Liquidity for the amount. TVL, UTxOs, recent transactions. Settlement Desk when paying.</Panel></div>,
  },
  {
    kicker: "THE RULES",
    title: "Rules stay deterministic.",
    lead: "The memo can be narrated. The verdict comes from explicit rules.",
    body: <div className={styles.columns}><Panel title="Assessment shape" dark><code>decision{`\n`}blockingReasons[]{`\n`}conditions[]{`\n`}evidence[]{`\n`}subject{`\n`}checkedAt</code></Panel><Panel title="Rule examples" accent>mint policy open → blocking<br />amount above caller cap → blocking<br />new payTo → condition<br />non-HTTPS resource → blocking</Panel></div>,
  },
  {
    kicker: "WHO HIRES IT",
    title: "A paid agent hires the Risk Desk.",
    lead: "The same Coworker is available to agents, people, and Sokosumi Tasks.",
    body: <div className={styles.columns}><Panel title="x402" accent>Agent receives HTTP 402. Pays for a risk check. Receives the assessment.</Panel><Panel title="Human UI">Enter a token or script. Inspect cited evidence. Choose the next action.</Panel><Panel title="Sokosumi">Hire Cardano Risk Analyst. Task input is the target. Masumi tracks the result.</Panel></div>,
  },
  {
    kicker: "THE PAYMENT GATE",
    title: "x402 checks the seller before payment.",
    lead: "Risk Desk is the pause between a payment request and a signature.",
    body: <div className={styles.flow}>{[["402", "Seller asks", "asset, amount, payTo"], ["01", "Risk check", "x402 pays Risk Desk"], ["02", "Evidence", "counterparty, asset"], ["03", "Decision", "stop or continue"], ["04", "Payment", "only after verdict"]].map(([number, title, body], index) => <Panel key={number} title={number} accent={index === 2}>{title}<br /><br /><span>{body}</span></Panel>)}</div>,
  },
  {
    kicker: "MAINNET REPORT  /  engine/reports/MIN.json",
    title: "MIN says DO NOT INTERACT.",
    lead: "The stored report blocks the action because the native mint policy remains open.",
    body: <div className={styles.columns}><Panel title="DO NOT INTERACT" accent>MIN<br />Native policy<br />Required signers: 1<br />Mint policy: open<br />Finding: mint-open / high</Panel><Panel title="Source calls" dark><code>asset_info_29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e<br />registry_29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e<br />script_info_29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6</code></Panel></div>,
  },
  {
    kicker: "MAINNET REPORTS  /  engine/reports/SNEK.json + MINt.json",
    title: "SNEK passes. MINt stops.",
    lead: "The difference is visible in the evidence, not a confidence score.",
    body: <div className={styles.columns}><Panel title="SNEK  /  INTERACT" accent>Native policy is timelocked<br />Mint policy: closed<br />999 sampled holders<br />Top 1: 4.0821102137%<br />Top 10: 4.3279131478%</Panel><Panel title="MINt  /  DO NOT INTERACT">Native policy remains open<br />1 required signer<br />Minswap liquidity: 1766.66 ADA<br />Findings: mint-open, liquidity</Panel></div>,
  },
  {
    kicker: "MAINNET REPORT  /  engine/reports/POOL-MINSWAP.json",
    title: "The pool report makes exit evidence concrete.",
    lead: "Minswap V2 is identified as a known Plutus protocol script.",
    body: <div className={styles.columns}><Panel title="INTERACT" accent>Script type: plutusV2<br />Script size: 3965 bytes<br />TVL: 23409267.450065 ADA<br />Recent tx count: 1000<br />Known protocol: Minswap V2 pool</Panel><Panel title="Source calls" dark><code>script_info_ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b<br />address_utxos_addr1z84q0denmyep98ph3tmzwsmw0j7zau9ljmsqx6a4rvaau66j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq777e2a</code></Panel></div>,
  },
  {
    kicker: "AGENT DEMO",
    title: "The agent has one safe branch.",
    lead: "It pays a seller only when the assessment is not DO_NOT_INTERACT.",
    body: <div className={styles.columns}><Panel title="Seller returns 402">The agent reads the payment requirements and target.</Panel><Panel title="Risk Desk returns verdict" accent>The decision is an Assessment, not a model confidence score.</Panel><Panel title="Agent branches">INTERACT → pay seller<br />CONDITIONS → inspect<br />DO_NOT_INTERACT → refuse</Panel></div>,
  },
  {
    // Source: agent-demo/runs/1791298553018.json; every hash confirmed by Koios preprod tx_status on 2026-10-06.
    kicker: "PREPROD RUN",
    title: "One seller paid. One refused.",
    lead: "The agent paid the Risk Desk 1 ADA over x402 for each seller, then acted on the verdict.",
    body: <div className={styles.columns}><Panel title="Seller A: INTERACT">Asks 2 ADA to an established wallet.<br /><br />Risk check <Tx h="fc053ce1c90ce352c944dff8afd5519d422b7995015302f1ea9f4afbc1246a31" /><br />Seller paid <Tx h="3866ed31eb44b4278abfdb897c377e3d69a6d5c9e8649df8a966ba11d252659a" /></Panel><Panel title="Seller B: DO_NOT_INTERACT" accent>Asks 5 tokens under an open mint policy, to an address first seen today.<br /><br />Risk check <Tx h="fad4fce27239cd0850bfa49100bebf00064780e9e908f4b61166d3461784a1ad" /><br />Blocking rule asset-mint-open. Seller not paid.</Panel></div>,
  },
  {
    kicker: "THE NETWORK",
    title: "Why Cardano and Masumi.",
    lead: "Agents do not need to understand Cardano before they spend. They can hire a Coworker that does.",
    body: <div className={styles.columns}><Panel title="Cardano" accent>Native assets carry minting policy evidence.<br /><br />Plutus scripts expose protocol surfaces.<br /><br />Koios and protocol APIs give the report its sources.</Panel><Panel title="Masumi">Sokosumi makes the Coworker discoverable.<br /><br />Tasks make the read accountable.<br /><br />Escrow turns the evidence into paid work.</Panel></div>,
  },
];

export default function DeckPage() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === " ") setIndex((value) => Math.min(value + 1, slides.length - 1));
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(value - 1, 0));
      if (event.key.toLowerCase() === "p") window.location.href = "/";
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <main className={styles.deck} aria-label="Cardano Risk Analyst pitch deck">
    <header className={styles.topbar}><a href="/">Cardano Risk Desk</a><span>RISK ANALYST / EVIDENCE REGISTER</span><a href="/deck/cardano-risk-analyst.pptx" download>Download PPTX</a></header>
    <aside className={styles.sourceIndex} aria-label="Evidence register"><h2>The decision comes before the transaction</h2><p>Mainnet reports: engine/reports/MIN.json, engine/reports/SNEK.json, engine/reports/MINt.json, engine/reports/POOL-MINSWAP.json</p></aside>
    <section className={styles.slide} aria-live="polite">
      <div className={styles.content}><p className={styles.kicker}>{slide.kicker}</p><h1 className={styles.title}>{slide.title}</h1>{slide.lead && <p className={styles.lead}>{slide.lead}</p>}{slide.body}</div>
    </section>
    <footer className={styles.controls}><button onClick={() => setIndex((value) => Math.max(value - 1, 0))} disabled={index === 0} aria-label="Previous slide">←</button><span><strong>{String(index + 1).padStart(2, "0")}</strong> / {String(slides.length).padStart(2, "0")}</span><button onClick={() => setIndex((value) => Math.min(value + 1, slides.length - 1))} disabled={index === slides.length - 1} aria-label="Next slide">→</button><span className={styles.hint}>Arrow keys / space</span></footer>
  </main>;
}

function Tx({ h }: { h: string }) {
  return <a href={`https://preprod.cardanoscan.io/transaction/${h}`} target="_blank" rel="noreferrer">{h.slice(0, 8)}…{h.slice(-4)}</a>;
}

function Panel({ title, children, accent = false, dark = false }: { title: string; children: React.ReactNode; accent?: boolean; dark?: boolean }) {
  return <article className={`${styles.panel} ${accent ? styles.accent : ""} ${dark ? styles.dark : ""}`}><h2>{title}</h2><div>{children}</div></article>;
}
