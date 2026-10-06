"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import styles from "./security.module.css";

type Candidate = { rule: string; file: string; line: number; why: string; attackSketch: string };
type JobStatus = "queued" | "generating" | "compiling" | "confirmed" | "not_confirmed";
type JobCandidate = {
  index: number;
  candidate: Candidate;
  status: JobStatus;
  startedAt?: number;
  elapsedMs?: number;
  reason?: string;
  model?: string;
  attempts?: number;
  testSource?: string;
  checkOutput?: string;
  passLines?: string[];
};
type Job = { id: string; status: "running" | "done" | "interrupted"; candidates: JobCandidate[] };
type Caps = { full: boolean; serverless: boolean; git: boolean; reason: string };
type Timings = { resolveMs?: number; cloneMs?: number; checkoutMs?: number; scanMs?: number; totalMs: number; cached?: boolean };
type Review = {
  repoUrl: string;
  sha: string;
  ref: string;
  project: string;
  candidates: Candidate[];
  jobId: string | null;
  confirmation: { available: boolean; reason?: string };
  timings: Timings;
};
type Pending = { repoUrl: string; sha: string; ref: string; projects: string[] };
type Target = {
  target: string;
  groundTruthCount?: number;
  confirmedFindings?: unknown[];
  falsePositives?: number;
  elapsedMs?: number;
  llmCalls?: number;
  capped?: boolean;
};

const DEFAULT_URL = "https://github.com/Invariant-0/cardano-ctf";
const STORE = "aiken-review:last";
const secs = (ms?: number) => `${((ms ?? 0) / 1000).toFixed(1)}s`;

export default function SecurityPage() {
  const [repoUrl, setRepoUrl] = useState(DEFAULT_URL);
  const [caps, setCaps] = useState<Caps | null>(null);
  const [benchmark, setBenchmark] = useState<Target[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const follow = useCallback((jobId: string) => {
    if (poll.current) clearTimeout(poll.current);
    const tick = async () => {
      try {
        const response = await fetch(`/api/security/jobs/${jobId}`, { cache: "no-store" });
        if (response.status === 404) { localStorage.removeItem(STORE); return; }
        const next = (await response.json()) as Job;
        setJob(next);
        setNow(Date.now());
        if (next.status === "running") poll.current = setTimeout(tick, 2000);
      } catch {
        poll.current = setTimeout(tick, 4000);
      }
    };
    void tick();
  }, []);

  useEffect(() => {
    fetch("/api/security").then((r) => r.json()).then((data) => {
      setCaps(data.capabilities);
      setBenchmark(data.benchmark?.targets ?? []);
    }).catch(() => setCaps(null));
    const saved = localStorage.getItem(STORE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { url: string; review: Review };
        setRepoUrl(parsed.url);
        setReview(parsed.review);
        if (parsed.review.jobId) follow(parsed.review.jobId);
      } catch { localStorage.removeItem(STORE); }
    }
    return () => { if (poll.current) clearTimeout(poll.current); };
  }, [follow]);

  const running = job?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  async function run(path?: string) {
    setLoading(true); setError(""); setPending(null);
    if (poll.current) clearTimeout(poll.current);
    try {
      const response = await fetch("/api/security", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repoUrl, path }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Review failed");
      if (data.needsProject) { setPending(data); setReview(null); setJob(null); return; }
      setReview(data); setJob(null);
      localStorage.setItem(STORE, JSON.stringify({ url: repoUrl, review: data }));
      if (data.jobId) follow(data.jobId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review failed");
      setReview(null); setJob(null);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void run(); }

  const unavailable = caps && !caps.full;
  return (
    <main className={styles.shell}>
      <header className={styles.nav}><a href="/" className={styles.brand}><span className={styles.mark}>R</span> Cardano Risk Analyst</a><a href="/">Token risk desk</a></header>
      <section className={styles.hero}>
        <p className={styles.kicker}>AIKEN SECURITY REVIEWER · EXPLOIT GATE</p>
        <h1>Find candidates. Confirm only what breaks.</h1>
        <p>Paste a public Aiken repository, or a folder inside one. The scanner returns structural candidates in seconds. Each of the top three is then attacked with a generated test that must compile and pass next to an honest control before it is called confirmed.</p>
        <form onSubmit={submit}>
          <label htmlFor="repo">GitHub URL: repository root or /tree/branch/folder</label>
          <div className={styles.inputRow}>
            <input id="repo" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} spellCheck={false} autoComplete="off" />
            <button disabled={loading || !repoUrl.trim() || caps?.git === false}>{loading ? "Scanning…" : "Review"}</button>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
        {unavailable && <p className={styles.notice}>{caps.reason}</p>}
      </section>

      {pending && (
        <section className={styles.picker} aria-labelledby="pick">
          <div className={styles.sectionHead}><h2 id="pick">Choose a project</h2><span>{pending.projects.length} aiken.toml in {pending.repoUrl.replace("https://github.com/", "")}@{pending.sha.slice(0, 7)}</span></div>
          <div className={styles.projects}>
            {pending.projects.map((project) => <button key={project} type="button" disabled={loading} onClick={() => void run(project)}>{project || "(repository root)"}</button>)}
          </div>
        </section>
      )}

      {review && <ReviewView review={review} job={job} now={now} />}

      <section className={styles.bench} aria-labelledby="bench">
        <div className={styles.sectionHead}><h2 id="bench">Benchmark: known bugs</h2><span>recorded runs, real Aiken exploit tests</span></div>
        <p className={styles.note}>Ground-truth targets with documented bugs, scanned and attacked ahead of time. These rows are not produced for the repository above.</p>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Target</th><th>Known</th><th>Confirmed</th><th>Recall</th><th>False positives</th><th>Time</th><th>Model calls</th></tr></thead>
            <tbody>
              {benchmark.map((item) => {
                const known = item.groundTruthCount ?? 0;
                const confirmed = item.confirmedFindings?.length ?? 0;
                return <tr key={item.target}><td>{item.target}</td><td>{known}</td><td>{confirmed}</td><td>{known ? `${Math.round((confirmed / known) * 100)}%` : "n/a"}</td><td>{item.falsePositives ?? 0}</td><td>{secs(item.elapsedMs)}{item.capped ? " cap" : ""}</td><td>{item.llmCalls ?? 0}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const LABEL: Record<JobStatus, string> = {
  queued: "Queued",
  generating: "Generating exploit",
  compiling: "Compiling and running aiken check",
  confirmed: "CONFIRMED",
  not_confirmed: "NOT CONFIRMED",
};

function ReviewView({ review, job, now }: { review: Review; job: Job | null; now: number }) {
  const t = review.timings;
  const byIndex = new Map((job?.candidates ?? []).map((item) => [item.index, item]));
  const queuedOnly = !job && review.jobId;
  const confirmed = (job?.candidates ?? []).filter((item) => item.status === "confirmed").length;
  return (
    <section className={styles.report} aria-labelledby="result">
      <div className={styles.sectionHead}>
        <h2 id="result">{review.repoUrl.replace("https://github.com/", "")}{review.project ? ` / ${review.project}` : ""}</h2>
        <span>{review.sha.slice(0, 7)} · {review.candidates.length} candidates in {secs(t.totalMs)}{t.cached ? " (cached clone)" : ""}</span>
      </div>
      {t.cloneMs !== undefined && <p className={styles.timings}>ref {secs(t.resolveMs)} · clone {secs(t.cloneMs)} · checkout {secs(t.checkoutMs)} · scan {t.scanMs}ms</p>}
      {job && <p className={styles.jobline} aria-live="polite">{job.status === "running" ? `Confirming the top ${job.candidates.length} candidate${job.candidates.length === 1 ? "" : "s"} one at a time.` : job.status === "interrupted" ? "The server restarted before this job finished." : `Exploit run finished: ${confirmed} of ${job.candidates.length} confirmed.`}</p>}
      {!review.confirmation.available && review.confirmation.reason && <p className={styles.notice}>{review.confirmation.reason}</p>}
      {review.candidates.length === 0 && <p className={styles.empty}>The scanner found no structural candidates in this project.</p>}
      <ol className={styles.list}>
        {review.candidates.map((item, i) => {
          const run = byIndex.get(i);
          return (
            <li key={`${item.rule}-${item.file}-${item.line}-${i}`} className={`${styles.finding} ${run?.status === "confirmed" ? styles.isConfirmed : ""}`}>
              <div className={styles.findingHead}><code>{item.rule}</code><span>{item.file}:{item.line}</span></div>
              <h3>{item.why}</h3>
              <p>{item.attackSketch}</p>
              {run ? <Verdict run={run} now={now} /> : <p className={styles.state}>{queuedOnly ? "Waiting for the exploit job" : "Needs review. Not in the top three, so no exploit test was generated."}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Verdict({ run, now }: { run: JobCandidate; now: number }) {
  const live = run.status === "generating" || run.status === "compiling";
  const elapsed = run.elapsedMs ?? (live && run.startedAt ? Math.max(0, now - run.startedAt) : undefined);
  return (
    <div className={styles.verdict} data-status={run.status}>
      <p className={styles.state}><strong>{LABEL[run.status]}</strong>{elapsed !== undefined ? ` · ${secs(elapsed)}` : ""}{run.model ? ` · ${run.model}` : ""}{run.attempts ? ` · attempt ${run.attempts}` : ""}</p>
      {run.status === "confirmed" && (
        <>
          {run.passLines?.map((line) => <p key={line} className={styles.pass}>{line}</p>)}
          {run.testSource && <details open><summary>Exploit test source</summary><pre>{run.testSource}</pre></details>}
          {run.checkOutput && <details><summary>aiken check output</summary><pre>{run.checkOutput}</pre></details>}
        </>
      )}
      {run.status === "not_confirmed" && (
        <>
          <p className={styles.reason}>{run.reason}</p>
          {run.checkOutput && <details><summary>Last aiken check output</summary><pre>{run.checkOutput}</pre></details>}
          {run.testSource && <details><summary>Last generated test</summary><pre>{run.testSource}</pre></details>}
        </>
      )}
    </div>
  );
}
