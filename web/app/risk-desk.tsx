"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./risk-desk.module.css";
import { storedReports } from "../lib/stored-reports";

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
  holders: { count: number; top1Pct: number; top10Pct: number; scriptHeldPct: number; sampled: boolean };
  liquidity: { pools: Array<{ dex: string; tvlAda: number; pair: string }>; totalTvlAda: number };
  activity: { tx24h?: number; firstSeen: string };
  findings: Finding[];
  verdict: "LOW" | "MEDIUM" | "HIGH";
  verdictLabel?: "INTERACT" | "INTERACT WITH CONDITIONS" | "DO NOT INTERACT";
  target?: "token" | "script";
  contract?: { address?: string; scriptHash: string; scriptType: string; scriptSizeBytes?: number; firstSeen: string; tvlAda: number; topAssets: Array<{ unit: string; quantity: string }>; utxoCount: number; recentTxCount: number; knownProtocol?: string; adminKeyCount?: number };
  sources: Array<{ call: string; at: string }>;
  generatedAt?: string;
  summaryOnly?: boolean;
};

type ApiResult = { markdown: string; json: Report } | { error: string };
type SettlementRun = { status: string; result?: { orderTx: string; fillTx: string; paymentTx: string; quotedInput: string; rate: string; timingsMs: { orderToSubmitted: number; fill: number } } };

export default function RiskDesk() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState(0);
  const [settlement, setSettlement] = useState<SettlementRun | null>(null);

  useEffect(() => { fetch("/api/settle/latest").then((response) => response.json()).then(setSettlement).catch(() => setSettlement({ status: "unavailable" })); }, []);

  const checks = ["Who controls it", "Is the code safe", "Can you get in and out"];
  useEffect(() => {
    if (!loading) { setPhase(0); return; }
    const timer = window.setInterval(() => setPhase((current) => Math.min(current + 1, checks.length - 1)), 850);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function submit(event?: FormEvent, requestedInput = input) {
    event?.preventDefault();
    if (!requestedInput.trim()) return;
    if (/^https?:\/\/github\.com\//i.test(requestedInput.trim())) { window.location.href = `/security?repo=${encodeURIComponent(requestedInput.trim())}`; return; }
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
            <p className={styles.kicker}>CARDANO MAINNET · DECISION MEMO</p>
            <h1>Should I interact with this Cardano contract?</h1>
            <p className={styles.lede}>One cited verdict for a token, DEX pool, lending market, escrow, Plutus script, or public contract repository.</p>
            <form className={styles.search} onSubmit={submit}>
              <label htmlFor="token">Contract input</label>
              <div className={styles.inputRow}>
                <input id="token" value={input} onChange={(event) => setInput(event.target.value)} placeholder="MIN, script address, hash, or GitHub URL" autoComplete="off" />
                <button type="submit" disabled={loading || !input.trim()}>{loading ? "Reading…" : "Get verdict"}</button>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
            </form>
            <div className={styles.examples}>
              <span>Try an example</span>
              {storedReports.map((example) => <span className={styles.example} key={example.input}>
                <button onClick={() => { setInput(example.input); setReport(example); setError(""); }}>{example.input}</button>
                <small>report from {formatGeneratedAt(example.generatedAt)}</small>
                <button className={styles.rerun} onClick={() => { setInput(example.unit); void submit(undefined, example.unit); }}>re-run live</button>
              </span>)}
            </div>
          </div>
          <div className={styles.signalPanel} aria-label="What the report checks" aria-busy={loading}>
            <div className={styles.panelHeader}><span>REQUEST / RISK-READ</span><span>LIVE</span></div>
            {checks.map((check, index) => <div className={styles.readLine} key={check}><span>{check}</span><strong>{loading ? (index < phase ? "done" : index === phase ? "reading…" : "queued") : check === "identity" ? "ready" : check === "minting" ? "control" : check === "holders" ? "concentration" : "liquidity"}</strong></div>)}
            <div className={styles.panelFooter}><span>KOIOS + MINSWAP + TOKEN REGISTRY</span><span className={styles.status}>● ready</span></div>
          </div>
        </section>
      ) : (
        <ReportView report={report} redFlag={redFlag} onReset={() => { setReport(null); setInput(""); }} onRerun={() => { setReport(null); void submit(undefined, report.unit); }} />
      )}

      <section className={styles.method} id="how-it-works">
        <p className={styles.kicker}>THE READ</p>
        <div className={styles.methodGrid}><h2>Facts first. Verdict second.</h2><p>The verdict is fixed by the report rules. The memo only explains the evidence, so the important numbers stay traceable to their source calls.</p></div>
      </section>
      <SettlementPanel run={settlement} />
      <footer className={styles.footer} id="sources"><span>Cardano Risk Analyst</span><span>Koios mainnet · Minswap · Cardano token registry</span></footer>
    </main>
  );
}

function SettlementPanel({ run }: { run: SettlementRun | null }) {
  const result = run?.result;
  return <section className={styles.settlement} aria-labelledby="settle-title">
    <div><p className={styles.kicker}>SETTLEMENT DESK · PREPROD</p><h2 id="settle-title">Settle a payment</h2><p className={styles.settlementLead}>Quote the seller’s asset from what you hold, then route the Minswap fill into an x402 payment.</p><p className={styles.refusal}><strong>Refusal rule</strong> Stop before signing when price impact exceeds 3% or the configured mainnet twin is HIGH risk.</p></div>
    <div className={styles.settlementData}><div><span>Latest quote</span><strong>{result ? `${result.quotedInput} lovelace → 10,000 tUSDC` : "Waiting for a verified run"}</strong><small>{result ? `${result.rate} actual rate` : "ADA against live preprod reserves"}</small></div><div><span>Latest real run</span>{result ? <><strong>200 from local x402 seller</strong><small>{result.timingsMs.fill} ms order to fill, {result.timingsMs.orderToSubmitted} ms total</small><nav className={styles.txLinks}><a href={`https://preprod.cardanoscan.io/transaction/${result.orderTx}`}>order</a><a href={`https://preprod.cardanoscan.io/transaction/${result.fillTx}`}>fill</a><a href={`https://preprod.cardanoscan.io/transaction/${result.paymentTx}`}>payment</a></nav></> : <small>{run?.status === "pending" ? "Run is being recorded" : "No completed run recorded"}</small>}</div></div>
  </section>;
}

function ReportView({ report, redFlag, onReset, onRerun }: { report: Report; redFlag?: Finding; onReset: () => void; onRerun: () => void }) {
  const controls = report.target === "script" ? `${report.contract?.knownProtocol || "Unknown script"}. ${report.contract?.utxoCount ?? 0} UTxOs, first seen ${formatReportDate(report.contract?.firstSeen || report.activity.firstSeen)}.` : `Mint policy is ${report.policy.mintOpen ? "open" : "closed"}; ${report.holders.sampled ? `${report.holders.top1Pct.toFixed(2)}% is held by the largest sampled holder.` : "holder concentration is not sampled."}`;
  const code = report.target === "script" ? `${report.contract?.scriptType || "Unknown"} script${report.contract?.scriptSizeBytes ? `, ${report.contract.scriptSizeBytes} bytes` : ""}. Findings are raised only when a deterministic rule fires.` : "Minting policy and identity checks are reported from mainnet data.";
  const exit = report.target === "script" ? `${formatAda(report.contract?.tvlAda || 0)} ADA locked across ${report.contract?.utxoCount || 0} UTxOs.` : `${formatAda(report.liquidity.totalTvlAda)} ADA across ${report.liquidity.pools.length} pools.`;
  return <section className={styles.report} aria-live="polite">
    <div className={styles.reportTop}><div><p className={styles.kicker}>DECISION MEMO · {report.input}</p><h1><span className={styles[`verdict${report.verdict}`]}>{report.verdictLabel || ({ LOW: "INTERACT", MEDIUM: "INTERACT WITH CONDITIONS", HIGH: "DO NOT INTERACT" } as const)[report.verdict]}</span></h1><p className={styles.lede}>{report.contract?.knownProtocol || report.identity.registryName || report.assetNameAscii || report.unit}</p>{report.generatedAt && <p className={styles.storedAt}>Stored report from {formatGeneratedAt(report.generatedAt)}{report.summaryOnly ? " · summary snapshot" : ""}</p>}</div><div className={styles.reportActions}><button className={styles.reset} onClick={onRerun}>Re-run live</button><button className={styles.reset} onClick={onReset}>Analyse another input</button></div></div>
    {redFlag && <div className={`${styles.redFlag} ${styles[`flag${redFlag.severity}`]}`}><span className={styles.flagLabel}>BIGGEST RED FLAG</span><strong>{redFlag.title}</strong><p>{redFlag.evidence}</p></div>}
    <div className={styles.reportBody}><div className={styles.findings}><div className={styles.sectionHead}><h2>Three checks</h2><span>{report.findings.length ? `${report.findings.length} findings` : "No findings"}</span></div><PassedCheck title="Who controls it" evidence={controls} /><PassedCheck title="Is the code safe" evidence={code} /><PassedCheck title="Can you get in and out" evidence={exit} />{report.findings.map((finding) => <article className={styles.finding} key={finding.id}><div className={styles.findingTitle}><span className={`${styles.severity} ${styles[`severity${finding.severity}`]}`}>{finding.severity}</span><h3>{finding.title}</h3></div><p>{finding.evidence}</p></article>)}</div><aside className={styles.facts}><h2>Evidence trail</h2><dl><dt>{report.target === "script" ? "Script hash" : "Policy"}</dt><dd>{report.policyId || "Not resolved"}</dd><dt>{report.target === "script" ? "Recent transactions" : "Fingerprint"}</dt><dd>{report.target === "script" ? report.contract?.recentTxCount ?? 0 : report.fingerprint || "Not resolved"}</dd><dt>Liquidity / TVL</dt><dd>{formatAda(report.target === "script" ? report.contract?.tvlAda || 0 : report.liquidity.totalTvlAda)} ADA</dd></dl><a className={styles.hireWide} href={process.env.NEXT_PUBLIC_COWORKER_URL || "https://sokosumi.com"}>Hire on Sokosumi <span>↗</span></a></aside></div>
    <div className={styles.sources}><h2>Source calls</h2>{report.sources.map((source) => <div className={styles.source} key={`${source.call}-${source.at}`}><code>{source.call}</code><time>{source.at}</time></div>)}</div>
  </section>;
}

function PassedCheck({ title, evidence }: { title: string; evidence: string }) {
  return <article className={styles.passedCheck}><span className={styles.passedMark}>PASS</span><div><h3>{title}</h3><p>{evidence}</p></div></article>;
}

function formatAda(value: number) { return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function formatReportDate(value: string) { return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(value)); }
function formatGeneratedAt(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)); }
