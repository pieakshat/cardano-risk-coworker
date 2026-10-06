import { expect, test } from "bun:test";
import { analyzeWith, holderConcentration, top1IsHigh } from "./engine.ts";
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
