import { analyze } from "./engine.ts";

const input = process.argv[2];
if (!input) throw new Error("usage: bun engine/cli.ts <token>");
console.log(JSON.stringify(await analyze(input), null, 2));
