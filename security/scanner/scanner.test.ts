import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { scan } from "./scanner"

const onchain = "/Users/user/Desktop/canton/cost-of-trust/onchain"

function checkout(commit: string): string {
  const dir = mkdtempSync(join(tmpdir(), "risk-scanner-"))
  const archive = spawnSync("git", ["-C", onchain, "archive", commit], { encoding: "buffer" })
  if (archive.status !== 0) throw new Error(archive.stderr.toString())
  const untar = spawnSync("tar", ["-x", "-C", dir], { input: archive.stdout })
  if (untar.status !== 0) throw new Error(untar.stderr.toString())
  return dir
}

describe("scan", () => {
  test("finds the three known vulnerable-commit candidates", () => {
    const candidates = scan(checkout("ce28fef"))
    const rules = new Set(candidates.map(({ rule }) => rule))
    expect(rules.has("double-satisfaction")).toBe(true)
    expect(rules.has("settle-window")).toBe(true)
    expect(rules.has("missing-task-binding")).toBe(true)
    console.log("ce28fef candidates", candidates)
  })

  test("does not report the fixed double-satisfaction or settle-window rules", () => {
    const candidates = scan(checkout("6a45d0a"))
    const rules = candidates.map(({ rule }) => rule)
    expect(rules).not.toContain("double-satisfaction")
    expect(rules).not.toContain("settle-window")
    expect(rules).not.toContain("missing-task-binding")
    console.log("6a45d0a candidates", candidates)
  })
})
