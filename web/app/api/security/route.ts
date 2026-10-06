import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { scan } from "../../../../security/scanner/scanner";

function command(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), { cwd, stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`git exited ${code}`)));
  });
}

export async function POST(request: Request) {
  const body = await request.json() as { repoUrl?: string };
  const repoUrl = body.repoUrl?.trim() ?? "";
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(repoUrl)) {
    return Response.json({ error: "Enter a public GitHub repository URL." }, { status: 400 });
  }
  const work = await mkdtemp(join(tmpdir(), "cardano-security-"));
  try {
    await command(["git", "clone", "--depth", "1", repoUrl, work]);
    const candidates = scan(work);
    return Response.json({
      repoUrl,
      candidates,
      confirmed: [],
      needsReview: candidates,
      note: "Static candidates are separated from confirmed findings. Confirmed items below come from the exploit-test benchmark.",
      benchmark: JSON.parse(await readFile(join(process.cwd(), "../security/bench/results.json"), "utf8")),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Repository review failed" }, { status: 502 });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
