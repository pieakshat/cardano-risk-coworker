import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, "ground-truth.json"), "utf8")) as Record<string, { bugs: string[]; projectDir: string }>;

describe("security benchmark manifest", () => {
  test("covers both onchain revisions and every CTF level", () => {
    expect(Object.keys(manifest)).toHaveLength(27);
    expect(manifest["onchain-vulnerable"].bugs).toHaveLength(3);
    expect(manifest["onchain-fixed"].bugs).toHaveLength(3);
    expect(manifest["bank_13_almost_there"].projectDir).toContain("cardano-ctf");
  });
});
