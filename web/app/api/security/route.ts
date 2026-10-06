import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { scan } from "../../../../security/scanner/scanner";
import { MAX_RUNNING_JOBS, runningJobs, startJob } from "../../../lib/security-jobs";
import { capabilities, checkoutProject, ensureClone, listProjects, parseTarget, pickProject, resolveRef, UserError } from "../../../lib/security-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function benchmark() {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "../security/bench/results.json"), "utf8"));
  } catch {
    return { targets: [] };
  }
}

export async function GET() {
  return Response.json({ capabilities: await capabilities(), benchmark: await benchmark() });
}

export async function POST(request: Request) {
  const started = Date.now();
  const body = await request.json().catch(() => ({})) as { repoUrl?: unknown; path?: unknown };
  const caps = await capabilities();
  if (!caps.git) return Response.json({ error: caps.reason, capabilities: caps }, { status: 501 });
  try {
    if (typeof body.repoUrl !== "string") throw new UserError("Enter a public GitHub URL.");
    const target = parseTarget(body.repoUrl, typeof body.path === "string" ? body.path : undefined);
    const resolved = await resolveRef(target);
    const t1 = Date.now();
    const clone = await ensureClone(target, resolved.sha, resolved.ref);
    const t2 = Date.now();
    const projects = await listProjects(clone.dir);
    const pick = pickProject(projects, resolved.subdir);
    const base = { repoUrl: `https://github.com/${target.owner}/${target.repo}`, sha: clone.sha, ref: resolved.ref ?? "HEAD" };
    if ("choose" in pick) {
      return Response.json({ ...base, needsProject: true, projects: pick.choose, capabilities: caps, timings: { totalMs: Date.now() - started } });
    }
    const projectDir = await checkoutProject(clone.dir, pick.project);
    const t3 = Date.now();
    const absolute = scan(projectDir);
    const candidates = absolute.map((c) => ({ ...c, file: relative(projectDir, c.file) || c.file }));
    const t4 = Date.now();
    const busy = runningJobs() >= MAX_RUNNING_JOBS;
    const confirmation = caps.full && candidates.length > 0 && !busy
      ? { available: true, jobId: (await startJob({ repoUrl: base.repoUrl, sha: clone.sha, project: pick.project }, projectDir, candidates, absolute)).id }
      : { available: false, reason: !caps.full ? caps.reason : busy ? "Exploit jobs are at capacity on this host. Try again when one finishes." : "The scanner found no candidates to confirm." };
    return Response.json({
      ...base,
      project: pick.project,
      projects,
      candidates,
      jobId: "jobId" in confirmation ? confirmation.jobId : null,
      confirmation,
      capabilities: caps,
      timings: { resolveMs: t1 - started, cloneMs: t2 - t1, checkoutMs: t3 - t2, scanMs: t4 - t3, totalMs: Date.now() - started, cached: clone.cached },
    });
  } catch (error) {
    if (error instanceof UserError) return Response.json({ error: error.message, ...error.extra }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : "Repository review failed" }, { status: 502 });
  }
}
