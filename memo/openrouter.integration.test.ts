import { strict as assert } from "node:assert";
import { writeMemo } from "./index";
import { numbersAreGrounded } from "./number-validator";
import report from "./sample-min.json" with { type: "json" };

if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required for this integration test");
const result = await writeMemo(report);
assert.ok(result.markdown.length > 0);
assert.equal(numbersAreGrounded(result.markdown, report), true);
console.log("OpenRouter integration: ok");
