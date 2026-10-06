import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const directory = path.join(process.cwd(), "..", "settle", "runs");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort().reverse();
  for (const file of files) {
    const run = JSON.parse(await readFile(path.join(directory, file), "utf8")) as Record<string, unknown>;
    if (run.status === "succeeded") return Response.json(run);
  }
  return Response.json({ status: "pending" });
}
