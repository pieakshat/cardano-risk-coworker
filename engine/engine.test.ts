import { expect, test } from "bun:test";
import { analyzeWith, holderConcentration, policyState, slotToTime, top1IsHigh, unknownScriptFinding } from "./engine.ts";
import type { Fetcher } from "./types.ts";

const root = `${import.meta.dir}/fixtures`;
const units = {
  MIN: "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e",
  SNEK: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
  MINt: "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e74",
};

const recorded: Fetcher = async (url, init) => {
  const body = JSON.parse(String(init?.body ?? "{}"));
  const query = new URL(url).searchParams;
  const queryPolicy = query.get("_asset_policy");
  const queryName = query.get("_asset_name");
  const unit = url.match(/metadata\/([0-9a-f]+)/)?.[1] ?? (body._asset_policy && body._asset_name ? body._asset_policy + body._asset_name : undefined) ?? (queryPolicy && queryName ? queryPolicy + queryName : undefined) ?? body._script_hashes?.[0] ?? body.term;
  const name = Object.entries(units).find(([, value]) => url.includes(value) || unit === value || unit === value.slice(56) || value.startsWith(String(unit)))?.[0] ?? "MIN";
  let file: string;
  if (url.includes("/asset_info")) file = `${root}/${name === "MINt" ? "mint" : name.toLowerCase()}-asset_info.json`;
  else if (url.includes("/asset_addresses")) file = `${root}/${name === "MINt" ? "mint" : name.toLowerCase()}-asset_addresses-0.json`;
  else if (url.includes("/script_info")) file = `${root}/${name === "MINt" ? "mint" : name.toLowerCase()}-script_info.json`;
  else if (url.includes("/pools/metrics")) file = `${root}/${name === "MINt" ? "mint" : name.toLowerCase()}-pools.json`;
  else if (url.includes("tokens.cardano.org")) file = `${root}/${name === "MINt" ? "mint" : name.toLowerCase()}-registry.json`;
  else throw new Error(`unmapped recorded call ${url}`);
  return new Response(await Bun.file(file).text(), { status: 200, headers: { "content-type": "application/json" } });
};

for (const [ticker, unit] of Object.entries(units)) {
  test(`${ticker} report uses recorded mainnet responses`, async () => {
    const report = await analyzeWith(recorded, unit);
    await Bun.write(`${import.meta.dir}/reports/${ticker}.json`, JSON.stringify(report, null, 2));
    expect(report.unit).toBe(unit);
    expect(report.sources.length).toBeGreaterThanOrEqual(5);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(report.verdict);
    expect(report.supply.total).not.toBe("0");
  });
}

test("top1 threshold is a real failing guard", () => {
  const atThreshold = holderConcentration([{ address: "addr1recorded-shape", quantity: 30n }], 100n);
  const overThreshold = holderConcentration([{ address: "addr1recorded-shape", quantity: 31n }], 100n);
  expect(atThreshold.top1Pct).toBe(30);
  expect(overThreshold.top1Pct).toBeGreaterThan(30);
  expect(top1IsHigh(atThreshold.top1Pct)).toBe(false);
  expect(top1IsHigh(overThreshold.top1Pct)).toBe(true);
});

const poolAddress = "addr1z84q0denmyep98ph3tmzwsmw0j7zau9ljmsqx6a4rvaau66j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq777e2a";
const poolRecorded: Fetcher = async (url) => {
  const file = url.includes("blockfrost.io/api/v0/addresses") ? "pool-blockfrost-address.json" : url.includes("/script_info") ? "pool-koios-script_info.json" : url.includes("/address_utxos") ? "pool-koios-address_utxos.json" : "pool-koios-address_txs.json";
  const body = file.endsWith("address_txs.json") ? "[]" : await Bun.file(`${root}/${file}`).text();
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
};

test("recorded mainnet pool derives hash and uses bounded totals", async () => {
  process.env.BLOCKFROST_API_KEY_MAINNET = "recorded";
  const report = await analyzeWith(poolRecorded, poolAddress);
  expect(report.contract?.scriptHash).toBe("ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b");
  expect(report.contract?.scriptType).toBe("plutusV2");
  expect(report.contract?.scriptSizeBytes).toBe(3965);
  expect(report.contract?.tvlAda).toBeGreaterThan(20_000);
  expect(report.contract?.topAssets.length).toBeGreaterThan(0);
  expect(report.contract?.utxoCount).toBe("at least 1000");
  expect(report.contract?.knownProtocol).toBe("Minswap V2 pool");
  expect(report.findings.some((finding) => finding.id === "known-protocol" && finding.severity === "info")).toBe(true);
  const byHash = await analyzeWith(poolRecorded, "ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b");
  expect(byHash.contract?.scriptHash).toBe("ea07b733d932129c378af627436e7cbc2ef0bf96e0036bb51b3bde6b");
});

test("unknown large script is a medium finding", () => {
  expect(unknownScriptFinding(false, 100_000)).toBeUndefined();
  expect(unknownScriptFinding(false, 100_001)?.severity).toBe("medium");
  expect(unknownScriptFinding(false, 100_001)?.title).toBe("Unknown contract holds significant value");
  expect(unknownScriptFinding(true, 1_000_000)).toBeUndefined();
});

test("native policy evaluation honors combinators and expired before locks", () => {
  expect(policyState({ type: "any", scripts: [{ type: "sig" }, { type: "sig" }, { type: "sig" }] }, "native").requiredSigners).toBe(1);
  expect(policyState({ type: "atLeast", required: 2, scripts: [{ type: "sig" }, { type: "sig" }, { type: "sig" }] }, "native").requiredSigners).toBe(2);
  expect(policyState({ type: "all", scripts: [{ type: "before", slot: 9_091_588_1 }, { type: "sig" }] }, "native").mintOpen).toBe(false);
  expect(policyState({ type: "all", scripts: [{ type: "before", slot: 9_999_999_999 }, { type: "sig" }] }, "native").mintOpen).toBe(true);
  expect(slotToTime(90_915_881)).toBe("2023-04-26T04:09:32.000Z");
});
