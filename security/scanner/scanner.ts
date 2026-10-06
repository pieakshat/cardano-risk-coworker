import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

export type Candidate = {
  rule: string
  file: string
  line: number
  why: string
  attackSketch: string
}

type Block = {
  text: string
  start: number
  file: string
}

function filesUnder(root: string): string[] {
  const result: string[] = []
  for (const name of readdirSync(root)) {
    if ([".git", "build", "work"].includes(name)) continue
    const path = join(root, name)
    const stat = statSync(path)
    if (stat.isDirectory()) result.push(...filesUnder(path))
    else if (name.endsWith(".ak")) result.push(path)
  }
  return result
}

function blocks(source: string, file: string): Block[] {
  const lines = source.split("\n")
  const result: Block[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!/\b(?:pub\s+)?fn\s+\w+|\bvalidator\s+\w+/.test(lines[i])) continue
    let depth = 0
    let opened = false
    let end = i
    for (; end < lines.length; end++) {
      for (const char of lines[end]) {
        if (char === "{") {
          depth++
          opened = true
        } else if (char === "}") depth--
      }
      if (opened && depth <= 0) break
    }
    result.push({ text: lines.slice(i, end + 1).join("\n"), start: i, file })
    i = end
  }
  return result
}

function lineOf(block: Block, needle: string): number {
  const offset = block.text.split("\n").findIndex((line) => line.includes(needle))
  return block.start + Math.max(0, offset) + 1
}

function candidate(block: Block, rule: string, needle: string, why: string, attackSketch: string): Candidate {
  return { rule, file: block.file, line: lineOf(block, needle), why, attackSketch }
}

function inspectBlock(block: Block, source: string): Candidate[] {
  const text = block.text
  const result: Candidate[] = []
  const isValidator = /\bvalidator\s+\w+/.test(text)
  const isHandler = isValidator || /\b(?:validate|spend|withdraw|mint)\b/.test(text)

  if (isHandler && /paid_to_(?:address|key)\s*\([^)]*,[^)]*,\s*None\s*\)/s.test(text) && !/sole_script_input\s*\(/.test(text)) {
    result.push(candidate(
      block,
      "double-satisfaction",
      "None",
      "A payout is selected without binding it to the consumed script input and there is no single-script-input guard.",
      "Spend two script inputs in one transaction and make one payout satisfy both validators' value checks.",
    ))
  }

  const outputScan = /\blist\.(?:find|any|filter|has)\s*\(\s*(?:\w+\.)*outputs\b[\s\S]*?\.address\s*==[\s\S]*?(?:lovelace_of|\.value)/
  if (isHandler && outputScan.test(text) && !/sole_script_input\s*\(/.test(text) && !/\b(?:own_ref|output_reference)\b[^\n]*==|==[^\n]*\b(?:own_ref|output_reference)\b/.test(text) && !/\binputs\b[\s\S]*\blist\.length\b|\blist\.length\s*\([^)]*inputs/.test(text)) {
    result.push(candidate(
      block,
      "double-satisfaction",
      "list.find",
      "The payout is any output with the right address and amount, found by searching all outputs without tying it to this script input. One payment satisfies every script input spent in the same transaction.",
      "Spend two script UTxOs owed to the same address in one transaction and pay the price once; each validator finds the same output.",
    ))
  }

  if (isHandler && /(?:^|\n)\s*\w+\s*->\s*True\b/.test(text) && /\bwhen\s+\w+\s+is\b/.test(text)) {
    result.push(candidate(
      block,
      "redeemer-no-state-check",
      "-> True",
      "A redeemer branch of a spend handler returns True with no check on the outputs, so the continuing datum (for example its owner field) is unconstrained by this script.",
      "Spend through the unconstrained branch and write a continuing output whose datum names an attacker-controlled owner, then use the owner-gated branch to withdraw.",
    ))
  }

  const settleText = text.slice(text.indexOf("Settle"))
  if (isHandler && /\bSettle\b/.test(text) && !/lower_bound_from\s*\(\s*tx/.test(settleText) && !/upper_bound_at_most\s*\(\s*tx/.test(settleText)) {
    result.push(candidate(
      block,
      "settle-window",
      "Settle",
      "The time-dependent settle branch has no lower and upper validity-range checks.",
      "Submit a validly signed settle report before the intended task window opens or after it closes.",
    ))
  }

  if (isHandler && /\btask_ref\s*:/.test(source) && /body_coverage/.test(text) && !/body_task_(?:tx_hash|index)/.test(text)) {
    result.push(candidate(
      block,
      "missing-task-binding",
      "task_ref",
      "The datum carries the insured task reference, but the report is only checked against the coverage UTxO.",
      "Reuse a genuine report for another task while presenting the current coverage reference.",
    ))
  }

  if (isHandler && /\b(?:Forfeit|Expire)\b/.test(text) && !/signed\s*\(/.test(text)) {
    result.push(candidate(
      block,
      "missing-signer-check",
      "Forfeit|Expire",
      "A branch that releases or redirects locked value has no visible signer check.",
      "Submit the branch with an unrelated signer and redirect the script value to an attacker-controlled output.",
    ))
  }

  if (isHandler && /\bpaid_to_key\s*\(/.test(text) && /\bunderwriter\s*:\s*ByteArray/.test(source)) {
    result.push(candidate(
      block,
      "staking-credential-substitution",
      "paid_to_key",
      "Payout authorization is represented as a key hash, so the full destination address and stake credential are not pinned.",
      "Route the payment to another stake-variant address with the same payment credential or substitute the intended payout address.",
    ))
  }

  const dust = text.match(/assets\.lovelace_of\([^\n]+\)\s*>=\s*[^\n]+/)
  if (dust) {
    result.push(candidate(
      block,
      "dust-value-check",
      ">=",
      "A minimum value check accepts the entire locked lovelace amount as payout, leaving no explicit minimum-ADA headroom.",
      "Set the payout at the full lovelace balance and strand the returned token output below its required minimum ADA.",
    ))
  }

  if (isValidator && /\belse\s*\([^)]*\)\s*\{[\s\S]*?(?:True|true)\s*\}/.test(text)) {
    result.push(candidate(
      block,
      "succeeding-else-handler",
      "else",
      "The validator fallback branch succeeds instead of rejecting unsupported purposes.",
      "Invoke the validator through an unsupported purpose and bypass the intended spend or mint branch.",
    ))
  }

  return result
}

function plutusValidatorTitles(projectDir: string): string[] {
  const path = join(projectDir, "plutus.json")
  if (!existsSync(path)) return []
  const raw = JSON.parse(readFileSync(path, "utf8")) as { validators?: unknown }
  if (!Array.isArray(raw.validators)) return []
  return raw.validators.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || !("title" in entry)) return []
    const title = (entry as { title?: unknown }).title
    return typeof title === "string" ? [title] : []
  })
}

export function scan(projectDir: string): Candidate[] {
  const akFiles = filesUnder(projectDir).filter((file) => !file.endsWith("_test.ak"))
  const plutusTitles = plutusValidatorTitles(projectDir)
  const found: Candidate[] = []
  const context = akFiles.map((path) => readFileSync(path, "utf8")).join("\n")
  for (const file of akFiles) {
    const source = readFileSync(file, "utf8")
    for (const block of blocks(source, file)) found.push(...inspectBlock(block, context))
  }

  if (plutusTitles.length > 0 && found.length === 0 && akFiles.length === 0) {
    return [{
      rule: "unreviewed-plutus-validator",
      file: relative(projectDir, "plutus.json"),
      line: 1,
      why: "plutus.json declares validators but no Aiken source was available for structural review.",
      attackSketch: "Obtain the public source and confirm each compiled validator's transaction guards before trusting it.",
    }]
  }
  return found
}
