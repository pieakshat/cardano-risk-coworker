import { strict as assert } from "node:assert";
import { writeMemo } from "./index";
import { numbersAreGrounded } from "./number-validator";
import report from "./sample-min.json" with { type: "json" };

const grounded = await writeMemo(report);
assert.deepEqual(grounded.json, report);
assert.equal(numbersAreGrounded(grounded.markdown, report), true);
assert.equal(numbersAreGrounded("The supply is 999999.", report), false);
console.log("writeMemo: ok");
