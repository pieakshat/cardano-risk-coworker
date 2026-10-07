"use client";

import type { FormEvent } from "react";
import styles from "./check.module.css";
import { EXAMPLES } from "./use-check";

type Props = {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  error: string;
  run: (v: string) => void;
  pick: (v: string) => void;
};

export function CheckForm({ input, setInput, loading, error, run, pick }: Props) {
  return (
    <form className={styles.form} aria-labelledby="check-title" onSubmit={(e: FormEvent) => { e.preventDefault(); run(input); }}>
      <h2 id="check-title" className={styles.formTitle}>Check a token or contract</h2>
      <p className={styles.formHelp}>Paste a ticker or address your agent is about to pay. No wallet needed.</p>
      <label htmlFor="contract" className={styles.label}>Token ticker or contract address</label>
      <div className={styles.inputRow}>
        <input id="contract" name="contract" value={input} onChange={(e) => setInput(e.target.value)} placeholder="MIN, SNEK, or an addr1 address" autoComplete="off" spellCheck={false} aria-describedby={error ? "check-error" : undefined} />
        <button type="submit" disabled={loading}>{loading ? "Checking" : "Check it"}</button>
      </div>
      {error && <p id="check-error" className={styles.error} role="alert">{error}</p>}
      <div className={styles.examples} role="group" aria-label="Examples">
        <span className={styles.label}>Or try one</span>
        {EXAMPLES.map((e) => (
          <button type="button" key={e.label} className={styles.example} onClick={() => pick(e.input)} disabled={loading}>
            <b>{e.label}</b><small>{e.note}</small>
          </button>
        ))}
      </div>
      <p className={styles.formFoot}>Reading Cardano mainnet takes 10 to 25 seconds. Reviewing Aiken source instead? <a href="/security">Open the code review</a>.</p>
    </form>
  );
}
