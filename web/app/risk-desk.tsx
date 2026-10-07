/* Hallmark · pre-emit critique: P5 H5 E5 S5 R4 V5 */
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./risk-desk.module.css";
import { AgentRun } from "./agent-run";
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

const PROOF_SOURCES = [
  {
    image: "/proof/cardano-rug-pulls.png",
    title: "Cardano documents rug pulls as a live ecosystem scam",
    note: "Cardano, undated, accessed 07 Oct 2026",
    href: "https://cardano.org/common-scams/",
  },
  {
    image: "/proof/reddit-scam-tokens.png",
    title: "The r/cardano automod warns about imitation tokens and wallet-draining links",
    note: "u/SL13PNIR, date shown as 3y ago, accessed 07 Oct 2026",
    href: "https://www.reddit.com/r/cardano/comments/1ba4c90/psa_added_new_comment_command_to_the_automod/",
  },
  {
    image: "/proof/cardanoscan-rug-token.png",
    title: "Cardanoscan shows a token named RUG with a rug-themed project link",
    note: "Cardanoscan, token created 24 Jan 2022, accessed 07 Oct 2026",
    href: "https://cardanoscan.io/token/bdb184eadfa9fb6b584e2d16e1a1a738eb80b47752387cf064ac5d16525547?address=addr1q9n5df5hyjjnhpc3rjw69zjj662xdkl8g2azwtfm6k5kqajjtz7y93808mevjgshdsvl9p9q9cpnhapq5c9qpfnx6lsqkj8e0d",
  },
  {
    image: "/proof/x402-issue-508.png",
    title: "x402 issue #508 describes phishing-like paywall fraud against agents",
    note: "kdenhartog, 27 Oct 2025",
    href: "https://github.com/x402-foundation/x402/issues/508",
  },
  {
    image: "/proof/x402-issue-3500.png",
    title: "x402 issue #3500 records a valid payment that exceeded user intent",
    note: "ak68a, 16 Sep 2026",
    href: "https://github.com/x402-foundation/x402/issues/3500",
  },
  {
    image: "/proof/hn-x402-fidelity.png",
    title: "A Hacker News operator reports low service fidelity across x402 endpoints",
    note: "dshaker, 25 Feb 2026",
    href: "https://news.ycombinator.com/item?id=47158809",
  },
] as const;

const OPEN_MINT_TOKENS = [
  ["MIN", "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e"],
  ["IAG", "5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114494147"],
  ["DJED", "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61446a65644d6963726f555344"],
  ["iUSD", "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b6988069555344"],
  ["SUNDAE", "9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d7753554e444145"],
  ["AGIX", "f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc53541474958"],
  ["NTX", "edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e993444794e5458"],
  ["COPI", "b6a7467ea1deb012808ef4e87b5ff371e85f7142d7b356a40d9b42a0436f726e75636f70696173205b76696120436861696e506f72742e696f5d"],
  ["GENS", "dda5fdb1002f7389b33e036b6afee82a8189becb6cba852e8b79b4fb0014df1047454e53"],
  ["WRT", "c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d507357696e67526964657273"],
  ["HUNT", "95a427e384527065f2f8946f5e86320d0117839a5e98ea2c0b55fb0048554e54"],
] as const;

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
          <a href="/deck">Deck</a>
          <a className={styles.hire} href="https://preprod.sokosumi.com/coworkers/01a11080-a6c3-7686-abf4-b0d1594cb82b">Hire on Sokosumi</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>The problem</p>
          <h1>Your agent holds a wallet. The seller is a stranger.</h1>
          <p className={styles.lede}>It receives an x402 request, pays in tokens, and signs for contracts nobody checked. What can it lose?</p>
        </div>
        <div className={styles.fear}>
          <p className={styles.fearLead}>Three ways a payment can look ordinary and still be wrong.</p>
          <ul>
            <li><strong>Open mint policy</strong><span>The issuer can print more of the token after your agent pays.</span></li>
            <li><strong>Fresh address</strong><span>The seller disappears after settlement.</span></li>
            <li><strong>Unknown script</strong><span>The destination is not the protocol it claims to be.</span></li>
          </ul>
        </div>
      </section>

      <section className={styles.proof} aria-labelledby="proof-title">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>The evidence</p>
          <h2 id="proof-title">This is not a hypothetical failure mode.</h2>
          <p>Cardano users report imitation tokens and rug pulls. x402 contributors report phishing-like paywalls and payments that are valid on chain but wrong for the user.</p>
        </div>
        <div className={styles.proofList}>
          {PROOF_SOURCES.map((source) => (
            <a className={styles.proofItem} href={source.href} key={source.href} target="_blank" rel="noreferrer">
              <img src={source.image} alt="" />
              <span className={styles.proofText}><strong>{source.title}</strong><small>{source.note}</small></span>
              <span className={styles.proofArrow} aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.measurement} aria-labelledby="measurement-title">
        <div>
          <p className={styles.kicker}>Our mainnet measurement</p>
          <h2 id="measurement-title"><span>11</span> of the top 20 have an open mint policy.</h2>
          <p>Measured from the cached engine report for the tokens in <code>engine/top-tokens.json</code>. An open policy means more supply can be minted.</p>
        </div>
        <div className={styles.tokenList} aria-label="Top 20 tokens with open mint policies">
          {OPEN_MINT_TOKENS.map(([ticker, unit]) => <a href={`https://cardanoscan.io/token/${unit}`} key={unit} target="_blank" rel="noreferrer">{ticker}<span>open mint</span></a>)}
        </div>
      </section>

      <section className={styles.answer} aria-labelledby="answer-title">
        <p className={styles.kicker}>The answer</p>
        <h2 id="answer-title">Put a cited decision between the request and the signature.</h2>
        <p className={styles.lede}>Your agent gets an x402 payment request. It pays the Risk Desk 1 ADA over x402, gets INTERACT, INTERACT WITH CONDITIONS or DO NOT INTERACT with the rule ids behind it, and only then pays the seller.</p>
        <ol className={styles.flow} aria-label="How an agent uses the Risk Desk">
          <li><b>Seller answers 402</b> with its payment terms</li>
          <li><b>Agent pays the Risk Desk 1 ADA</b> over x402 to check those terms</li>
          <li><b>Verdict comes back</b> with the rule ids and the on-chain evidence</li>
          <li><b>Agent pays or refuses</b> the seller on that verdict</li>
        </ol>
      </section>

      <AgentRun />


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
