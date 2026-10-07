import { expect, test } from "bun:test";
import { canonicalJson, nativePolicyOpen, preflight, termsHash } from "./index.ts";

const established = "addr_test1qp3d5uypvnx8ujr2mjdppu2whvrraps8ac7he3fj63zfjv3jctq4qksmzd858a52pajdtyl0fg6kf9gwaxql9emvn7gsa04dkf";
const mainnetAddress = "addr1q93k6rgprz5fxwkpvl2vgjq4pwejth400f8aldz2m3lj7khrnd05p259l0qjrf396am6wahv5895ey35y62fexta3q5q3cc3k8";
const fresh = "addr_test1qp7rx8u74gaezymd9xumue7cu7c7rjsx2h70qyhu2c7jds4n90s8u5jzxl8wcrl5lle67l6fps63mcudn4ygx5lv6ezsevc4fz";
const tusdm = "e675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c9.0014df10745553444d";
const snek = "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f.534e454b";
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

test("fresh payment facts are conditional", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, amount: "2000000", maxAmount: "5000000", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, { fixtureDir: `${fixtures}/fresh-open` });
  expect(assessment.decision).toBe("INTERACT_WITH_CONDITIONS");
  expect(assessment.blockingReasons).toEqual([]);
  expect(assessment.conditions).toEqual(["counterparty-first-seen", "counterparty-tx-count"]);
});

test("plutus mint policy is conditional, not blocking", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, asset: tusdm, amount: "500000", maxAmount: "1000000", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, { fixtureDir: `${fixtures}/fresh-open` });
  expect(assessment.blockingReasons).not.toContain("asset-mint-open");
  expect(assessment.conditions).toContain("mint-policy-plutus");
});

test("amount over cap blocks", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, amount: "5000001", maxAmount: "5000000", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, deps);
  expect(assessment.decision).toBe("DO_NOT_INTERACT");
  expect(assessment.blockingReasons).toContain("amount-over-cap");
});

test("loopback HTTP is exempt and recorded", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, amount: "2000000", maxAmount: "5000000", resource: "http://127.0.0.1:4403/", maxTimeoutSeconds: 600 }, deps);
  expect(assessment.blockingReasons).not.toContain("resource-not-https");
  expect(assessment.evidence).toContainEqual(expect.objectContaining({ rule: "resource-loopback" }));
});

test.each(["http://example.com/", "http://127.0.0.1.evil.com/"])("public HTTP resource blocks: %s", async (resource) => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, amount: "2000000", maxAmount: "5000000", resource, maxTimeoutSeconds: 600 }, deps);
  expect(assessment.blockingReasons).toContain("resource-not-https");
});

test("wrong-network payTo blocks before address facts are trusted", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:mainnet", payTo: established, amount: "2", maxAmount: "5", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, deps);
  expect(assessment.blockingReasons).toContain("payto-invalid");
});

test("HTTPS scheme parsing is case insensitive", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, amount: "2", maxAmount: "5", resource: "HTTPS://seller.example/data", maxTimeoutSeconds: 600 }, deps);
  expect(assessment.blockingReasons).not.toContain("resource-not-https");
});

test("amount cap is not compared across asset units", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:preprod", payTo: established, asset: tusdm, amount: "50000000", maxAmount: "1", maxAmountAsset: "lovelace", resource: "https://seller.example/data", maxTimeoutSeconds: 600 }, { fixtureDir: `${fixtures}/fresh-open` });
  expect(assessment.blockingReasons).not.toContain("amount-over-cap");
});

test("recorded Koios SNEK policy is closed without blocking payment", async () => {
  const assessment = await preflight({ type: "x402_payment", network: "cardano:mainnet", payTo: mainnetAddress, asset: snek, amount: "1", maxAmount: "2", resource: "https://seller.example/data" }, { fixtureDir: `${fixtures}/snek-closed` });
  expect(assessment.decision).not.toBe("DO_NOT_INTERACT");
  expect(assessment.blockingReasons).not.toContain("asset-mint-open");
  expect(assessment.evidence).toContainEqual(expect.objectContaining({ rule: "asset-mint-policy", value: expect.stringContaining("controlled") }));
});

test("native policy semantics use the current slot and combinators", () => {
  expect(nativePolicyOpen({ type: "sig", keyHash: "key" }, 100)).toBe(true);
  expect(nativePolicyOpen({ type: "all", scripts: [{ type: "sig" }, { type: "before", slot: 99 }] }, 100)).toBe(false);
  expect(nativePolicyOpen({ type: "any", scripts: [{ type: "before", slot: 99 }, { type: "after", slot: 100 }] }, 100)).toBe(true);
  expect(nativePolicyOpen({ type: "atLeast", required: 2, scripts: [{ type: "sig" }, { type: "before", slot: 99 }, { type: "after", slot: 100 }] }, 100)).toBe(true);
});
