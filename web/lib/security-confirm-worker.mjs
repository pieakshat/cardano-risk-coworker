// Runs under bun: the exploit package uses Bun APIs, so the Next.js (node) server spawns this per candidate.
import { confirm } from "../../security/exploit/index.ts";

const [projectDir, candidateJson] = process.argv.slice(2);
const result = await confirm(projectDir, JSON.parse(candidateJson));
process.stdout.write(`\n@@RESULT@@${JSON.stringify(result)}\n`);
