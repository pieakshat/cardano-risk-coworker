import { expect, test } from "bun:test";
import { canonicalJson, preflight, termsHash } from "./index.ts";

const established = "addr_test1qp3d5uypvnx8ujr2mjdppu2whvrraps8ac7he3fj63zfjv3jctq4qksmzd858a52pajdtyl0fg6kf9gwaxql9emvn7gsa04dkf";
const fresh = "addr_test1qp7rx8u74gaezymd9xumue7cu7c7rjsx2h70qyhu2c7jds4n90s8u5jzxl8wcrl5lle67l6fps63mcudn4ygx5lv6ezsevc4fz";
const tusdm = "e675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c9.0014df10745553444d";
const fixtures = `${import.meta.dir}/fixtures`;
const deps = { fixtureDir: `${fixtures}/established` };

test("canonical terms hash ignores object key order", () => {
  expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  expect(termsHash({ b: 2, a: 1 })).toBe(termsHash({ a: 1, b: 2 }));
});

test("established preprod wallet passes", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, amount: "2000000", maxAmount: "5000000", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, deps);
  expect(assessment.decision).toBe("INTERACT");
  expect(assessment.blockingReasons).toEqual([]);
  expect(assessment.conditions).toEqual([]);
  expect(assessment.evidenceScore).toBe(100);
});

test("fresh preprod address is conditional", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: fresh, amount: "2000000", maxAmount: "5000000", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, { fixtureDir: `${fixtures}/fresh-open` });
  expect(assessment.decision).toBe("INTERACT_WITH_CONDITIONS");
  expect(assessment.blockingReasons).toEqual([]);
  expect(assessment.conditions).toEqual(["counterparty-first-seen", "counterparty-tx-count"]);
});

test("open-mint asset blocks an otherwise valid payment", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: fresh, asset: tusdm, amount: "500000", maxAmount: "1000000", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, { fixtureDir: `${fixtures}/fresh-open` });
  expect(assessment.decision).toBe("DO_NOT_INTERACT");
  expect(assessment.blockingReasons).toContain("asset-mint-open");
});

test("amount over cap blocks", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, amount: "5000001", maxAmount: "5000000", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, deps);
  expect(assessment.decision).toBe("DO_NOT_INTERACT");
  expect(assessment.blockingReasons).toContain("amount-over-cap");
});
