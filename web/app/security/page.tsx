"use client";

import { FormEvent, useState } from "react";
import styles from "./security.module.css";

type Candidate = { rule: string; file: string; line: number; why: string; attackSketch: string };
type Target = { target: string; groundTruthCount: number; confirmedFindings: Array<{ status?: string; candidate?: Candidate; model?: string; testSource?: string }>; needsReview: Candidate[]; falsePositives: number; elapsedMs: number; llmCalls: number; capped?: boolean };
type Result = { repoUrl: string; candidates: Candidate[]; confirmed: Candidate[]; needsReview: Candidate[]; note: string; benchmark: { targets: Target[] } };

export default function SecurityPage() {
  const [repoUrl, setRepoUrl] = useState("https://github.com/Invariant-0/cardano-ctf");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try { const response = await fetch("/api/security", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repoUrl }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setResult(data); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Review failed"); setResult(null); }
    finally { setLoading(false); }
  }
  return <main className={styles.shell}><header className={styles.nav}><a href="/" className={styles.brand}><span className={styles.mark}>R</span> Cardano Risk Analyst</a><a href="/">Token risk desk</a></header><section className={styles.hero}><p className={styles.kicker}>AIKEN SECURITY REVIEWER · EXPLOIT GATE</p><h1>Find candidates. Confirm only what breaks.</h1><p>Give the reviewer a public Aiken repository. Static candidates stay separate until an attack test compiles and passes its honest control.</p><form onSubmit={submit}><label htmlFor="repo">GitHub repository URL</label><div className={styles.inputRow}><input id="repo" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} /><button disabled={loading}>{loading ? "Reviewing…" : "Review repository"}</button></div>{error && <p className={styles.error}>{error}</p>}</form></section>{result && <Review result={result} />}</main>;
}

function Review({ result }: { result: Result }) { const benchmark = result.benchmark.targets; return <section className={styles.report}><div className={styles.columns}><article><div className={styles.sectionHead}><h2>Scanner candidates</h2><span>{result.candidates.length}</span></div>{result.candidates.length ? result.candidates.map((item) => <Finding key={`${item.file}-${item.line}`} item={item} />) : <p className={styles.empty}>No structural candidates found in this checkout.</p>}</article><aside><div className={styles.sectionHead}><h2>Needs review</h2><span>{result.needsReview.length}</span></div>{result.needsReview.map((item) => <Finding key={`${item.file}-${item.line}`} item={item} />)}<h2 className={styles.confirmedTitle}>Confirmed findings</h2>{result.confirmed.length ? result.confirmed.map((item) => <Finding key={`${item.file}-${item.line}`} item={item} />) : <p className={styles.empty}>No exploit test has confirmed a finding for this checkout.</p>}</aside></div><p className={styles.note}>{result.note}</p><div className={styles.sectionHead}><h2>Benchmark evidence</h2><span>real Aiken exploit tests</span></div><div className={styles.tableWrap}><table><thead><tr><th>Target</th><th>Known</th><th>Confirmed</th><th>Recall</th><th>False positives</th><th>Time</th><th>Model calls</th></tr></thead><tbody>{benchmark.map((item) => <tr key={item.target}><td>{item.target}</td><td>{item.groundTruthCount}</td><td>{item.confirmedFindings.length}</td><td>{item.groundTruthCount ? `${Math.round(item.confirmedFindings.length / item.groundTruthCount * 100)}%` : "100%"}</td><td>{item.falsePositives}</td><td>{(item.elapsedMs / 1000).toFixed(1)}s{item.capped ? " cap" : ""}</td><td>{item.llmCalls}</td></tr>)}</tbody></table></div></section> }
function Finding({ item }: { item: Candidate }) { return <article className={styles.finding}><div><code>{item.rule}</code><span>{item.file}:{item.line}</span></div><h3>{item.why}</h3><p>{item.attackSketch}</p></article> }
