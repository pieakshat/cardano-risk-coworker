import { strict as assert } from "node:assert";
import { SETTLEMENT_DISABLED_ERROR, rejectSettlementTask } from "../src/worker.ts";

assert.throws(() => rejectSettlementTask("pay 1 ADA to https://attacker.example/ from ADA"), new RegExp(SETTLEMENT_DISABLED_ERROR));
assert.doesNotThrow(() => rejectSettlementTask("SNEK"));
console.log("settlement safety: ok");
