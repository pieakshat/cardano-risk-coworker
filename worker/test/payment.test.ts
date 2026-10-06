import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256 } from "../src/payment.ts";

test("result hashes are stable UTF-8 SHA-256 values", () => {
  assert.equal(sha256("MIN"), "d319c28c2d23e115501524432e4ae591254394e799bf3e95c53f526525175e4c");
});
