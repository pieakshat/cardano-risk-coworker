import assert from "node:assert/strict";
import { test } from "bun:test";
import { analyzeWith } from "../../engine/engine.ts";

const root = new URL("../../engine/fixtures/", import.meta.url).pathname;
const recorded = async (url: string, init?: RequestInit): Promise<Response> => {
  const body = JSON.parse(String(init?.body ?? "{}"));
  const query = new URL(url).searchParams;
  const file = url.includes("/asset_info") ? "min-asset_info.json"
    : url.includes("/asset_addresses") ? "min-asset_addresses-0.json"
      : url.includes("/script_info") ? "min-script_info.json"
        : url.includes("/pools/metrics") ? "min-pools.json"
          : url.includes("tokens.cardano.org") ? "min-registry.json"
            : body.term ? "min-pools.json" : "min-asset_info.json";
  return new Response(await Bun.file(`${root}${file}`).text(), { status: 200 });
};
import { writeMemo } from "../../memo/index.ts";

test("a recorded MIN task produces a grounded memo and report", async () => {
  const previousFixtures = process.env.RISK_FIXTURES;
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.RISK_FIXTURES = "1";
  delete process.env.OPENROUTER_API_KEY;
  try {
    const report = await analyzeWith(recorded, "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e");
    const result = await writeMemo(report);
    assert.equal(result.json.unit, report.unit);
    assert.match(result.markdown, /## Verdict|Verdict/);
    assert.match(result.markdown, /DO NOT INTERACT|INTERACT WITH CONDITIONS|INTERACT/);
  } finally {
    if (previousFixtures === undefined) delete process.env.RISK_FIXTURES;
    else process.env.RISK_FIXTURES = previousFixtures;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});
