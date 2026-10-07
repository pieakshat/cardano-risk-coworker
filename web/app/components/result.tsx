import styles from "./check.module.css";
import { LABEL, buildGates, formatWhen, plainVerdict, subject, type Report } from "./report";
import { STEPS } from "./use-check";

type Props = { report: Report | null; loading: boolean; elapsed: number; input: string; rerun: (v: string) => void };

export function Result({ report, loading, elapsed, input, rerun }: Props) {
  if (loading) return <Progress elapsed={elapsed} input={input} />;
  if (!report) return null;
  const label = report.verdictLabel || LABEL[report.verdict];
  const gates = buildGates(report);
  const target = report.target === "script" ? report.contract?.address || report.input : report.unit;
  return (
    <section className={`${styles.result} ${styles[`v_${report.verdict}`]}`} aria-label={`Verdict for ${subject(report)}`} aria-live="polite">
      <div className={styles.resultMain}>
        <span className={styles.label}>Verdict for {subject(report)}</span>
        <p className={styles.stamp}>{label}</p>
        <p className={styles.plain}>{plainVerdict(report)}</p>
        <p className={styles.provenance}>
          {report.generatedAt ? <>Saved read from {formatWhen(report.generatedAt)} UTC. </> : <>Read live just now. </>}
          <button type="button" className={styles.inline} onClick={() => rerun(target)}>{report.generatedAt ? "Re-run live" : "Check again"}</button>
        </p>
      </div>
      <ol className={styles.gates} aria-label="The three checks">
        {gates.map((g, n) => (
          <li key={g.name} className={styles[`gate_${g.state}`]}>
            <span className={styles.gateIndex} aria-hidden="true">{n + 1}</span>
            <div>
              <h3>{g.name}</h3>
              <p className={styles.gateQuestion}>{g.question}</p>
              <p className={styles.gateLine}>{g.line}</p>
            </div>
            <span className={styles.gateState}>{g.state === "idle" ? "not read" : g.state === "pass" ? "clear" : g.state === "hold" ? "caution" : "stop"}</span>
          </li>
        ))}
      </ol>
      <Evidence report={report} />
    </section>
  );
}

function Progress({ elapsed, input }: { elapsed: number; input: string }) {
  const active = STEPS.reduce((n, s, i) => (elapsed >= s.at ? i : n), 0);
  return (
    <section className={styles.progress} aria-live="polite" aria-busy="true" aria-label="Check in progress">
      <div>
        <span className={styles.label}>Checking {input.length > 24 ? `${input.slice(0, 12)}...${input.slice(-6)}` : input}</span>
        <p className={styles.plain}>Reading Cardano mainnet. This takes about 10 to 25 seconds.</p>
        <p className={styles.provenance}>{elapsed} second{elapsed === 1 ? "" : "s"} so far</p>
      </div>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.text} data-state={i < active ? "done" : i === active ? "active" : "queued"}>
            <span>{i < active ? "done" : i === active ? "now" : "next"}</span>{s.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Evidence({ report }: { report: Report }) {
  return (
    <div className={styles.evidence}>
      <div className={styles.evidenceHead}><span className={styles.label}>Evidence</span><h3>{report.findings.length ? `${report.findings.length} rule${report.findings.length === 1 ? "" : "s"} fired` : "No rule fired"}</h3></div>
      <div className={styles.findingList}>
        {report.findings.length === 0 && <p className={styles.gateQuestion}>None of the minting, holder, registry or liquidity rules found a problem.</p>}
        {report.findings.map((f) => (
          <article key={f.id} className={styles[`finding_${f.severity}`] || styles.finding_info}>
            <span>{f.severity}</span><h4>{f.title}</h4><p>{f.evidence}</p>
          </article>
        ))}
      </div>
      <details className={styles.sources}>
        <summary>{report.sources.length} source calls behind this verdict</summary>
        {report.sources.map((s) => <div key={`${s.call}-${s.at}`}><code>{s.call}</code><time>{s.at}</time></div>)}
      </details>
    </div>
  );
}
