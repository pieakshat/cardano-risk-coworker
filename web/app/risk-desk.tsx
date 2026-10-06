/* Hallmark · pre-emit critique: P5 H4 E4 S5 R4 V5 */
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
type Gate = { name: string; question: string; state: "pass" | "hold" | "stop" | "idle"; line: string };

// The intent is the framing a user picks; the report underneath is always a real read.
const INTENTS = [
  { intent: "Swap 500 ADA into MIN", input: "MIN" },
  { intent: "Buy SNEK with 200 ADA", input: "SNEK" },
  { intent: "Add liquidity to this DEX pool", input: "addr1z84q0denmyep98ph3tmzwsmw0j7zau9ljmsqx6a4rvaau66j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq777e2a" },
  { intent: "Deposit into a contract, source first", input: "https://github.com/Invariant-0/cardano-ctf/tree/main/01_sell_nft" },
];

const DECISION = { LOW: "GO", MEDIUM: "GO, WITH CONDITIONS", HIGH: "STOP" } as const;

export default function RiskDesk() {
  const [intent, setIntent] = useState(INTENTS[0].intent);
  const [input, setInput] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [settlement, setSettlement] = useState<SettlementRun | null>(null);

  useEffect(() => { fetch("/api/settle/latest").then((r) => r.json()).then(setSettlement).catch(() => setSettlement({ status: "unavailable" })); }, []);
  useEffect(() => {
    if (!loading) { setTick(0); return; }
    const timer = window.setInterval(() => setTick((t) => Math.min(t + 1, 2)), 900);
    return () => window.clearInterval(timer);
  }, [loading]);

  function pick(i: (typeof INTENTS)[number]) {
    setIntent(i.intent);
    setInput(i.input);
    setError("");
    const stored = storedReports.find((r) => r.input.toUpperCase() === i.input.toUpperCase());
    if (stored) setReport(stored as Report);
    else void run(i.input);
  }

  async function run(value = input) {
    const v = value.trim();
    if (!v) return;
    if (/^https?:\/\/github\.com\//i.test(v)) { window.location.href = `/security?repo=${encodeURIComponent(v)}`; return; }
    setLoading(true); setError(""); setReport(null);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: v }) });
      const result = (await response.json()) as ApiResult;
      if (!response.ok || "error" in result) throw new Error("error" in result ? result.error : "The read did not finish");
      setReport(result.json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The read did not finish");
    } finally {
      setLoading(false);
    }
  }

  const gates = useMemo(() => buildGates(report, loading, tick), [report, loading, tick]);
  const decision = report ? DECISION[report.verdict] : null;

  return (
    <main className={styles.shell}>
      <header className={styles.nav}>
        <a className={styles.brand} href="/">Cardano Risk Desk</a>
        <nav className={styles.navLinks}>
          <a href="#agent">For agents</a>
          <a href="/security">Code review</a>
          <a className={styles.hire} href={process.env.NEXT_PUBLIC_COWORKER_URL || "https://preprod.sokosumi.com"}>Hire on Sokosumi</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.kicker}>Pre-flight for autonomous agents on Cardano</p>
        <h1>Know the contract before your agent touches it.</h1>
        <p className={styles.lede}>Tokens, DEX pools, lending markets, escrows, any Plutus script. Hand the Risk Desk what your agent is about to call. It reads the chain and the code, then holds the call or lets it through.</p>
      </section>

      <section className={styles.bench} aria-label="Pre-flight check">
        <div className={styles.callColumn}>
          <span className={styles.label}>Your agent wants to</span>
          <p className={styles.intent}>{intent}</p>
          <form className={styles.target} onSubmit={(e: FormEvent) => { e.preventDefault(); void run(); }}>
            <label htmlFor="contract" className={styles.label}>Contract it will touch</label>
            <div className={styles.inputRow}>
              <input id="contract" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ticker, policy.asset, script address, hash or GitHub URL" autoComplete="off" spellCheck={false} />
              <button type="submit" disabled={loading || !input.trim()}>{loading ? "Reading" : "Run pre-flight"}</button>
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
          </form>
          <div className={styles.intents}>
            {INTENTS.map((i) => (
              <button key={i.intent} className={i.intent === intent ? styles.intentOn : styles.intentOff} onClick={() => pick(i)}>{i.intent}</button>
            ))}
          </div>
        </div>

        <ol className={styles.gates} aria-live="polite" aria-busy={loading}>
          {gates.map((g, n) => (
            <li key={g.name} className={styles[`gate_${g.state}`]}>
              <span className={styles.gateIndex}>{n + 1}</span>
              <div className={styles.gateBody}>
                <h2>{g.name}</h2>
                <p className={styles.gateQuestion}>{g.question}</p>
                {g.line && <p className={styles.gateLine}>{g.line}</p>}
              </div>
              <span className={styles.gateState}>{g.state === "idle" ? "" : g.state}</span>
            </li>
          ))}
        </ol>

        <div className={`${styles.verdict} ${report ? styles[`verdict_${report.verdict}`] : styles.verdict_idle}`}>
          <span className={styles.label}>The call is</span>
          <strong>{loading ? "being read" : decision ?? "waiting"}</strong>
          {report && <p>{verdictReason(report)}</p>}
          {report?.generatedAt && <small>Report from {formatWhen(report.generatedAt)} · <button className={styles.inline} onClick={() => void run(report.target === "script" ? report.contract?.address || report.input : report.unit)}>re-run live</button></small>}
        </div>
      </section>

      {report && <Evidence report={report} />}

      <section className={styles.agent} id="agent">
        <div>
          <span className={styles.kicker}>For agents</span>
          <h2>Your agent gets the same answer as JSON.</h2>
          <p>Hire the Risk Desk on Sokosumi before any call that moves value. Each read is a paid Task settled through Masumi escrow on Cardano: the result hash goes on chain before the Coworker is paid.</p>
        </div>
        <pre className={styles.json}>{JSON.stringify(agentView(report, intent), null, 2)}</pre>
      </section>

      <Settlement run={settlement} />

      <footer className={styles.footer}>
        <span>Reads Koios and Blockfrost mainnet, Minswap pools and the Cardano token registry. Every finding carries the call that produced it.</span>
      </footer>
    </main>
  );
}

function buildGates(report: Report | null, loading: boolean, tick: number): Gate[] {
  const base = [
    { name: "Who controls it", question: "Can someone mint, upgrade or drain it on their own?" },
    { name: "Is the code safe", question: "Does the contract hold when someone attacks it?" },
    { name: "Can you get in and out", question: "Is there liquidity for your size, at a fair price?" },
  ];
  if (loading) return base.map((g, i) => ({ ...g, state: "idle" as const, line: i < tick ? "read" : i === tick ? "reading the chain" : "queued" }));
  if (!report) return base.map((g) => ({ ...g, state: "idle" as const, line: "" }));
  const sev = (ids: string[]): Gate["state"] => {
    const hits = report.findings.filter((f) => ids.some((id) => f.id.includes(id)));
    return hits.some((f) => f.severity === "high") ? "stop" : hits.some((f) => f.severity === "medium") ? "hold" : "pass";
  };
  const script = report.target === "script";
  if (report.summaryOnly) {
    // summary snapshots carry findings but not policy or pool detail: speak only to what they hold
    const say = (ids: string[]) => report.findings.filter((f) => ids.some((id) => f.id.includes(id))).map((f) => f.title).join("; ") || "No rule fired in the stored snapshot. Re-run live for full detail.";
    return [
      { ...base[0], state: sev(["mint", "top1", "top10", "admin", "unknown", "age", "registry"]), line: say(["mint", "top1", "top10", "registry", "age"]) },
      { ...base[1], state: "idle", line: "Re-run live to read the policy script." },
      { ...base[2], state: sev(["liquidity"]), line: say(["liquidity"]) },
    ];
  }
  const control = script
    ? `${report.contract?.knownProtocol || "Not a recognised protocol script"}${report.contract?.firstSeen ? `, live since ${formatDay(report.contract.firstSeen)}` : ""}.`
    : report.policy.mintOpen
      ? `Mint policy is a ${report.policy.scriptType} script with ${report.policy.requiredSigners} signer${report.policy.requiredSigners === 1 ? "" : "s"} and no time lock: more can be minted.`
      : `Minting closed${report.policy.timelockedBefore ? ` since ${formatDay(report.policy.timelockedBefore)}` : ""}. Largest wallet holds ${pct(report.holders.top1Pct)} of supply.`;
  const code = script
    ? `${report.contract?.scriptType || "Script"}${report.contract?.scriptSizeBytes ? `, ${report.contract.scriptSizeBytes} bytes` : ""}. Send its Aiken source to the Security Reviewer for exploit-tested findings.`
    : report.policy.scriptType === "native" ? "Native policy: no Plutus code to attack." : "Plutus policy: send its source to the Security Reviewer.";
  const exit = script
    ? `${ada(report.contract?.tvlAda || 0)} ADA locked here.`
    : `${ada(report.liquidity.totalTvlAda)} ADA of DEX liquidity across ${report.liquidity.pools.length} pools.`;
  return [
    { ...base[0], state: sev(["mint", "top1", "top10", "admin", "unknown", "age", "registry"]), line: control },
    { ...base[1], state: script ? "hold" : "pass", line: code },
    { ...base[2], state: sev(["liquidity"]), line: exit },
  ];
}

function Evidence({ report }: { report: Report }) {
  return (
    <section className={styles.evidence}>
      <div className={styles.evidenceHead}><span className={styles.kicker}>Evidence</span><h2>{report.findings.length ? `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}` : "No rule fired"}</h2></div>
      <div className={styles.findingList}>
        {report.findings.map((f) => (
          <article key={f.id} className={styles[`finding_${f.severity}`] || styles.finding_info}>
            <span>{f.severity}</span><h3>{f.title}</h3><p>{f.evidence}</p>
          </article>
        ))}
      </div>
      <details className={styles.sources}>
        <summary>{report.sources.length} source calls</summary>
        {report.sources.map((s) => <div key={`${s.call}-${s.at}`}><code>{s.call}</code><time>{s.at}</time></div>)}
      </details>
    </section>
  );
}

function Settlement({ run }: { run: SettlementRun | null }) {
  const r = run?.result;
  return (
    <section className={styles.settle}>
      <div>
        <span className={styles.kicker}>Then it can pay for you</span>
        <h2>Holding the wrong asset is no reason to sign blind.</h2>
        <p>If the seller asks for an asset your agent does not hold, the Risk Desk quotes the swap against live Minswap reserves, refuses above 3% price impact or on a STOP verdict, then places the order and pays the x402 seller once the batcher fills.</p>
      </div>
      <dl className={styles.settleData}>
        <dt>Latest run</dt>
        <dd>{r ? `200 from the seller, ${Math.round(r.timingsMs.orderToSubmitted / 1000)} s end to end` : run?.status === "pending" ? "Recording" : "No completed run yet"}</dd>
        {r && <><dt>Rate</dt><dd>{r.rate}</dd><dt>Transactions</dt><dd className={styles.txs}><a href={`https://preprod.cardanoscan.io/transaction/${r.orderTx}`}>order</a><a href={`https://preprod.cardanoscan.io/transaction/${r.fillTx}`}>fill</a><a href={`https://preprod.cardanoscan.io/transaction/${r.paymentTx}`}>payment</a></dd></>}
      </dl>
    </section>
  );
}

function verdictReason(r: Report) {
  const top = r.findings.find((f) => f.severity === "high") ?? r.findings.find((f) => f.severity === "medium");
  if (top) return top.title;
  return r.target === "script" ? "No control, age or value rule fired for this script." : "No rule fired on minting, holders, registry or liquidity.";
}

function agentView(r: Report | null, intent: string) {
  if (!r) return { intent, decision: null, note: "Pick a call above. This is the object your agent receives." };
  return {
    intent,
    contract: r.target === "script" ? r.contract?.address || r.input : r.unit,
    decision: r.verdictLabel || { LOW: "INTERACT", MEDIUM: "INTERACT WITH CONDITIONS", HIGH: "DO NOT INTERACT" }[r.verdict],
    reasons: r.findings.map((f) => ({ id: f.id, severity: f.severity })),
    sources: r.sources.length,
  };
}

function ada(v: number) { return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : Math.round(v).toLocaleString("en-US"); }
function pct(v: number) { return `${v.toFixed(2)}%`; }
function formatDay(v: string) { return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(v)); }
function formatWhen(v: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(v)); }
