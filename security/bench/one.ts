// Single-target probe: bun security/bench/one.ts <projectDir> [rule]
import { scan } from "../scanner/scanner.ts"
import { confirm } from "../exploit/index.ts"

const [dir, rule] = process.argv.slice(2)
for (const candidate of scan(dir).filter((c) => !rule || c.rule === rule)) {
  const started = Date.now()
  const result = await confirm(dir, candidate)
  const attempts = result.modelAttempts.map((m) => `${m.model}:${m.attempts}:${m.compile}/${m.attack}/${m.control}`).join(" ")
  console.log(candidate.rule, result.status, `calls=${result.llmCalls}`, `${((Date.now() - started) / 1000).toFixed(0)}s`, attempts)
  if (result.status !== "CONFIRMED") console.log(result.reason, "\n", (result.modelAttempts.at(-1)?.output ?? "").slice(0, 1800))
  if (result.testSource) await Bun.write(`/tmp/last-${candidate.rule}.ak`, result.testSource)
}
