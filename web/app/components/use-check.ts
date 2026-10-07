"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { storedReports } from "../../lib/stored-reports";
import type { ApiResult, Report } from "./report";

export const EXAMPLES = [
  { label: "MIN", input: "MIN", note: "a popular token" },
  { label: "SNEK", input: "SNEK", note: "a meme token" },
  { label: "Minswap pool", input: "addr1z84q0denmyep98ph3tmzwsmw0j7zau9ljmsqx6a4rvaau66j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq777e2a", note: "a DEX contract" },
] as const;

export const STEPS = [
  { at: 0, text: "Looking it up on Cardano" },
  { at: 3, text: "Reading who can mint or change it" },
  { at: 7, text: "Checking which wallets hold it" },
  { at: 12, text: "Checking you can get out: DEX liquidity" },
  { at: 17, text: "Writing the verdict" },
] as const;

const CLIENT_TIMEOUT_MS = 58_000;

function saved(input: string) {
  const found = storedReports.find((r) => r.input.toUpperCase() === input.trim().toUpperCase());
  return found ? (found as Report) : null;
}

function plainError(status: number, message?: string) {
  if (status === 400 && message) return message;
  if (status === 504) return "Reading the chain took too long this time. Try again, or open MIN or SNEK for a saved read.";
  if (status === 502) return "We could not read that. Use a token ticker like MIN, a policy id followed by the asset name, or an addr1 script address.";
  if (status === 0) return "We could not reach the Risk Desk. Check your connection and try again.";
  return "The check did not finish. Try again in a moment.";
}

export function useCheck() {
  const [input, setInput] = useState("MIN");
  const [report, setReport] = useState<Report | null>(() => saved("MIN"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [loading]);

  const run = useCallback(async (value: string) => {
    const v = value.trim();
    if (!v) { setError("Type a token ticker like MIN, or pick an example."); return; }
    if (/^https?:\/\/github\.com\//i.test(v)) { window.location.href = `/security?repo=${encodeURIComponent(v)}`; return; }
    const ticket = ++latest.current;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: v }), signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) });
      let body: ApiResult | null = null;
      try { body = (await response.json()) as ApiResult; } catch { body = null; }
      if (ticket !== latest.current) return;
      if (!response.ok || !body || "error" in body) throw Object.assign(new Error(plainError(response.status, body && "error" in body ? body.error : undefined)), { plain: true });
      setReport(body.json);
    } catch (caught) {
      if (ticket !== latest.current) return;
      const plain = caught instanceof Error && (caught as Error & { plain?: boolean }).plain;
      setError(plain ? (caught as Error).message : plainError(caught instanceof DOMException && caught.name === "TimeoutError" ? 504 : 0));
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, []);

  // Examples with a saved read answer at once. Everything else is a live read.
  const pick = useCallback((example: string) => {
    setInput(example);
    setError("");
    const stored = saved(example);
    if (stored) { latest.current++; setLoading(false); setReport(stored); } else void run(example);
  }, [run]);

  return { input, setInput, report, loading, error, elapsed, run, pick };
}
