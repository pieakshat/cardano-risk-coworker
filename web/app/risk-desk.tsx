"use client";

import { FormEvent, useState } from "react";
import styles from "./risk-desk.module.css";

type Finding = { id: string; severity: string; title: string; evidence: string };
type Report = {
  input: string;
  unit: string;
  policyId: string;
  assetNameAscii: string;
  fingerprint: string;
  identity: { registryName?: string; ticker?: string; decimals?: number; url?: string; inRegistry: boolean };
  policy: { scriptType: string; timelockedBefore?: string; requiredSigners: number; mintOpen: boolean };
  supply: { total: string; mintTxCount: number; burnTxCount: number; lastMintAt?: string };
  holders: { count: number; top1Pct: number; top10Pct: number; scriptHeldPct: number };
  liquidity: { pools: Array<{ dex: string; tvlAda: number; pair: string }>; totalTvlAda: number };
  activity: { tx24h?: number; firstSeen: string };
  findings: Finding[];
  verdict: "LOW" | "MEDIUM" | "HIGH";
  sources: Array<{ call: string; at: string }>;
};

type ApiResult = { markdown: string; json: Report } | { error: string };

const examples = [
  { label: "MIN", value: "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e" },
  { label: "SNEK", value: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b" },
];

export default function RiskDesk() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event?: FormEvent, requestedInput = input) {
    event?.preventDefault();
    if (!requestedInput.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: requestedInput }),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok || "error" in result) throw new Error("error" in result ? result.error : "Analysis failed");
      setReport(result.json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  const redFlag = report?.findings.find((finding) => finding.severity === "high") ?? report?.findings[0];

  return (
    <main className={styles.shell}>
      <header className={styles.nav}>
        <a className={styles.brand} href="/" aria-label="Cardano Risk Analyst home"><span className={styles.mark}>R</span> Cardano Risk Analyst</a>
        <div className={styles.navLinks}><a href="#how-it-works">How it works</a><a href="#sources">Sources</a><a className={styles.hire} href={process.env.NEXT_PUBLIC_COWORKER_URL || "https://sokosumi.com"}>Hire on Sokosumi</a></div>
      </header>

      {!report ? (
        <section className={styles.intro}>
          <div className={styles.introCopy}>
            <p className={styles.kicker}>CARDANO MAINNET · RISK MEMO</p>
            <h1>Know the token before you touch it.</h1>
            <p className={styles.lede}>A deterministic read on minting control, holder concentration, liquidity, and recent activity. Enter one token identifier.</p>
            <form className={styles.search} onSubmit={submit}>
              <label htmlFor="token">Token identifier</label>
              <div className={styles.inputRow}>
                <input id="token" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Policy ID, unit, ticker, or fingerprint" autoComplete="off" />
                <button type="submit" disabled={loading || !input.trim()}>{loading ? "Reading…" : "Analyse token"}</button>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
            </form>
            <div className={styles.examples}><span>Try an example</span>{examples.map((example) => <button key={example.label} onClick={() => { setInput(example.label); void submit(undefined, example.value); }}>{example.label}</button>)}</div>
          </div>
          <div className={styles.signalPanel} aria-label="What the report checks">
            <div className={styles.panelHeader}><span>REQUEST / RISK-READ</span><span>LIVE</span></div>
            <div className={styles.readLine}><span>mint_policy</span><strong>control</strong></div>
            <div className={styles.readLine}><span>holder_set</span><strong>concentration</strong></div>
            <div className={styles.readLine}><span>exit_path</span><strong>liquidity</strong></div>
            <div className={styles.readLine}><span>recent_activity</span><strong>timing</strong></div>
            <div className={styles.panelFooter}><span>KOIOS + MINSWAP + TOKEN REGISTRY</span><span className={styles.status}>● ready</span></div>
          </div>
        </section>
      ) : (
        <ReportView report={report} redFlag={redFlag} onReset={() => { setReport(null); setInput(""); }} />
      )}

      <section className={styles.method} id="how-it-works">
        <p className={styles.kicker}>THE READ</p>
        <div className={styles.methodGrid}><h2>Facts first. Verdict second.</h2><p>The verdict is fixed by the report rules. The memo only explains the evidence, so the important numbers stay traceable to their source calls.</p></div>
      </section>
      <footer className={styles.footer} id="sources"><span>Cardano Risk Analyst</span><span>Koios mainnet · Minswap · Cardano token registry</span></footer>
    </main>
  );
}

function ReportView({ report, redFlag, onReset }: { report: Report; redFlag?: Finding; onReset: () => void }) {
  return <section className={styles.report} aria-live="polite">
    <div className={styles.reportTop}><div><p className={styles.kicker}>RISK MEMO · {report.input}</p><h1>This token is <span className={styles[`verdict${report.verdict}`]}>{report.verdict.toLowerCase()} risk</span>.</h1><p className={styles.lede}>{report.identity.registryName || report.assetNameAscii || report.unit}</p></div><button className={styles.reset} onClick={onReset}>Analyse another token</button></div>
    {redFlag && <div className={`${styles.redFlag} ${styles[`flag${redFlag.severity}`]}`}><span className={styles.flagLabel}>BIGGEST RED FLAG</span><strong>{redFlag.title}</strong><p>{redFlag.evidence}</p></div>}
    <div className={styles.reportBody}><div className={styles.findings}><div className={styles.sectionHead}><h2>Findings</h2><span>{report.findings.length} evidence-backed checks</span></div>{report.findings.map((finding) => <article className={styles.finding} key={finding.id}><div className={styles.findingTitle}><span className={`${styles.severity} ${styles[`severity${finding.severity}`]}`}>{finding.severity}</span><h3>{finding.title}</h3></div><p>{finding.evidence}</p></article>)}</div><aside className={styles.facts}><h2>Evidence trail</h2><dl><dt>Policy</dt><dd>{report.policyId || "Not resolved"}</dd><dt>Fingerprint</dt><dd>{report.fingerprint || "Not resolved"}</dd><dt>Holders</dt><dd>{report.holders.count.toLocaleString()}</dd><dt>Liquidity</dt><dd>{report.liquidity.totalTvlAda.toLocaleString()} ADA</dd></dl><a className={styles.hireWide} href={process.env.NEXT_PUBLIC_COWORKER_URL || "https://sokosumi.com"}>Hire on Sokosumi <span>↗</span></a></aside></div>
    <div className={styles.sources}><h2>Source calls</h2>{report.sources.map((source) => <div className={styles.source} key={`${source.call}-${source.at}`}><code>{source.call}</code><time>{source.at}</time></div>)}</div>
  </section>;
}
