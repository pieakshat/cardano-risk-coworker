import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Attempt = { compile: string; attack: string; control: string };
type Result = {
  target: string;
  groundTruthCount: number;
  candidatesTested: number;
  confirmedFindings: Array<{ candidate: { rule: string }; modelAttempts: Attempt[] }>;
  foundBugs: string[];
  falsePositives: number;
  expectedNoConfirmed: boolean;
  capped?: boolean;
};

const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, "ground-truth.json"), "utf8")) as Record<string, { bugs: string[]; projectDir: string; replayFrom?: string }>;
const results = (JSON.parse(readFileSync(resolve(import.meta.dir, "results.json"), "utf8")) as { targets: Result[] }).targets;
const byName = (name: string): Result => {
  const found = results.find((result) => result.target === name);
  if (!found) throw new Error(`results.json has no ${name}`);
  return found;
};

describe("security benchmark manifest", () => {
  test("covers both onchain revisions and every CTF level", () => {
    expect(Object.keys(manifest)).toHaveLength(4);
    expect(manifest["onchain-vulnerable"].bugs).toHaveLength(3);
    expect(manifest["onchain-fixed"].bugs).toHaveLength(3);
    expect(manifest["bank_01_deposit_vulnerability"].projectDir).toContain("cardano-ctf");
    expect(manifest["onchain-fixed"].replayFrom).toBe("onchain-vulnerable");
  });
});

describe("security benchmark results", () => {
  test("fixed target gets the vulnerable candidates replayed and none confirm", () => {
    const fixed = byName("onchain-fixed");
    expect(fixed.capped).toBeFalsy();
    expect(fixed.candidatesTested).toBeGreaterThan(0);
    expect(fixed.confirmedFindings).toHaveLength(0);
    expect(fixed.falsePositives).toBe(0);
  });

  test("every confirmed finding carries a passing attack and a passing control", () => {
    const confirmed = results.flatMap((result) => result.confirmedFindings);
    expect(confirmed.length).toBeGreaterThan(0);
    for (const finding of confirmed) {
      const last = finding.modelAttempts[finding.modelAttempts.length - 1];
      expect([last.compile, last.attack, last.control]).toEqual(["pass", "pass", "pass"]);
    }
  });

  test("vulnerable targets confirm at least one known bug each with no false confirmations", () => {
    for (const name of ["onchain-vulnerable", "01_sell_nft", "bank_01_deposit_vulnerability"]) {
      const result = byName(name);
      expect(result.capped).toBeFalsy();
      expect(result.foundBugs.length).toBeGreaterThan(0);
      expect(result.falsePositives).toBe(0);
    }
  });
});
