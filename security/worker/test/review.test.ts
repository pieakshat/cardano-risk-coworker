import assert from "node:assert/strict";
import test from "node:test";
import { parseInput } from "../src/review.ts";

test("accepts a GitHub repo and optional in-repo path", () => {
  assert.deepEqual(parseInput(JSON.stringify({ repoUrl: "https://github.com/Invariant-0/cardano-ctf", path: "level-1" })), {
    repoUrl: "https://github.com/Invariant-0/cardano-ctf",
    path: "level-1",
  });
});

test("rejects non-GitHub and escaping paths", () => {
  assert.throws(() => parseInput("https://example.com/a/b"));
  assert.throws(() => parseInput(JSON.stringify({ repoUrl: "https://github.com/a/b", path: "../secret" })));
});
