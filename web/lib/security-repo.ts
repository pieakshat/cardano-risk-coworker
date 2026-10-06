import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CACHE_ROOT = "/tmp/aiken-review";
const SAFE = /^[\w.-]+$/;
const SAFE_PATH = /^[\w.\-/ ]*$/;

export class UserError extends Error {
  constructor(message: string, readonly status = 400, readonly extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export type Target = { owner: string; repo: string; treeRest: string; subdir: string };

/** Accepts repo root, /tree/<ref>/<subdir>, git@ and scheme-less forms; `path` adds or overrides the subdir. */
export function parseTarget(repoUrl: string, path?: string): Target {
  const raw = repoUrl.trim();
  const match = raw.match(/^(?:https?:\/\/(?:www\.)?|git@)?github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(.*))?$/);
  if (!match) throw new UserError("Enter a public GitHub URL such as https://github.com/owner/repo or .../tree/main/subdir.");
  const [, owner, repo, rest = ""] = match;
  if (!SAFE.test(owner) || !SAFE.test(repo) || owner.startsWith(".") || repo.startsWith(".")) throw new UserError("Invalid repository name.");
  const clean = rest.split(/[?#]/)[0].replace(/\/+$/, "");
  let treeRest = "";
  if (clean) {
    const tree = clean.match(/^tree\/(.+)$/);
    if (!tree) throw new UserError("Use the repository root or a /tree/<branch>/<folder> URL.");
    treeRest = tree[1];
  }
  const subdir = normalizeSubdir(path ?? "");
  return { owner, repo, treeRest, subdir };
}

export function normalizeSubdir(value: string): string {
  const cleaned = value.trim().replace(/^\/+|\/+$/g, "");
  if (!SAFE_PATH.test(cleaned) || cleaned.split("/").some((part) => part === ".." || part === ".")) throw new UserError("Invalid path.");
  return cleaned;
}

function run(args: string[], opts: { cwd?: string; timeoutMs?: number; maxBytes?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo" },
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs ?? 120_000);
    child.stdout.on("data", (chunk) => { if (out.length < (opts.maxBytes ?? 8_000_000)) out += chunk; });
    child.stderr.on("data", (chunk) => { if (err.length < 20_000) err += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${args.slice(0, 3).join(" ")} exited ${code}: ${err.trim().split("\n").slice(-2).join(" ")}`));
    });
  });
}

type Refs = { head: string; heads: Map<string, string>; tags: Map<string, string> };

async function lsRemote(url: string): Promise<Refs> {
  let text: string;
  try {
    text = await run(["git", "ls-remote", url], { timeoutMs: 30_000 });
  } catch {
    throw new UserError("Repository not found or not public.", 404);
  }
  const refs: Refs = { head: "", heads: new Map(), tags: new Map() };
  for (const line of text.split("\n")) {
    const [sha, name] = line.split("\t");
    if (!sha || !name) continue;
    if (name === "HEAD") refs.head = sha;
    else if (name.startsWith("refs/heads/")) refs.heads.set(name.slice(11), sha);
    else if (name.startsWith("refs/tags/")) {
      const peeled = name.endsWith("^{}");
      const tag = name.slice(10, peeled ? -3 : undefined);
      if (peeled || !refs.tags.has(tag)) refs.tags.set(tag, sha);
    }
  }
  if (!refs.head) throw new UserError("Repository has no HEAD.", 404);
  return refs;
}

/** Resolves the requested ref (default HEAD) to a commit sha and the folder implied by a /tree/ URL. */
export async function resolveRef(target: Target): Promise<{ sha: string; ref?: string; subdir: string }> {
  const refs = await lsRemote(`https://github.com/${target.owner}/${target.repo}.git`);
  if (!target.treeRest) return { sha: refs.head, subdir: target.subdir };
  const parts = target.treeRest.split("/");
  for (let n = parts.length; n >= 1; n--) {
    const name = parts.slice(0, n).join("/");
    const sha = refs.heads.get(name) ?? refs.tags.get(name);
    if (sha) return { sha, ref: name, subdir: target.subdir || normalizeSubdir(parts.slice(n).join("/")) };
  }
  throw new UserError(`Branch or tag not found in ${target.treeRest}.`, 404);
}

// ponytail: in-process mutex per cache dir; a second server process would need a lockfile.
const locks: Map<string, Promise<unknown>> = ((globalThis as Record<string, unknown>).__aikenLocks ??= new Map()) as Map<string, Promise<unknown>>;
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(key, next);
  try { return await next; } finally { if (locks.get(key) === next) locks.delete(key); }
}

export type Clone = { dir: string; sha: string; cached: boolean };

export async function ensureClone(target: Target, sha: string, ref?: string): Promise<Clone> {
  const dir = join(CACHE_ROOT, `${target.owner}__${target.repo}@${sha}`);
  return withLock(dir, async () => {
    if (existsSync(join(dir, ".git"))) return { dir, sha, cached: true };
    await mkdir(CACHE_ROOT, { recursive: true });
    const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
    const url = `https://github.com/${target.owner}/${target.repo}.git`;
    try {
      await run(["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse", ...(ref ? ["--branch", ref] : []), url, tmp], { timeoutMs: 180_000 });
    } catch (error) {
      await rm(tmp, { recursive: true, force: true });
      throw error;
    }
    const head = (await run(["git", "rev-parse", "HEAD"], { cwd: tmp })).trim();
    const finalDir = head === sha ? dir : join(CACHE_ROOT, `${target.owner}__${target.repo}@${head}`);
    if (existsSync(join(finalDir, ".git"))) await rm(tmp, { recursive: true, force: true });
    else await rename(tmp, finalDir);
    return { dir: finalDir, sha: head, cached: false };
  });
}

/** Every aiken.toml in the commit, read from the tree objects only (no file contents fetched). */
export async function listProjects(cloneDir: string): Promise<string[]> {
  const out = await run(["git", "ls-tree", "-r", "--name-only", "HEAD"], { cwd: cloneDir });
  return out.split("\n")
    .filter((line) => line === "aiken.toml" || line.endsWith("/aiken.toml"))
    .map((line) => (line === "aiken.toml" ? "" : dirname(line)))
    .sort();
}

export type Pick = { project: string } | { choose: string[] };

export function pickProject(projects: string[], subdir: string): Pick {
  if (projects.length === 0) throw new UserError("No aiken.toml found in this repository, so there is no Aiken project to review.", 422);
  if (!subdir) return projects.length === 1 ? { project: projects[0] } : { choose: projects };
  if (projects.includes(subdir)) return { project: subdir };
  const under = projects.filter((p) => p.startsWith(`${subdir}/`));
  if (under.length === 1) return { project: under[0] };
  if (under.length > 1) return { choose: under };
  const ancestors = projects.filter((p) => p === "" || subdir.startsWith(`${p}/`)).sort((a, b) => b.length - a.length);
  if (ancestors.length) return { project: ancestors[0] };
  throw new UserError(`No Aiken project (aiken.toml) at or under ${subdir}.`, 422, { projects });
}

/** Materialises one project's files in the sparse checkout and returns its absolute path. */
export async function checkoutProject(cloneDir: string, project: string): Promise<string> {
  return withLock(cloneDir, async () => {
    const abs = project ? join(cloneDir, project) : cloneDir;
    if (existsSync(join(abs, "aiken.toml")) && (project === "" || existsSync(join(abs, "validators")) || existsSync(join(abs, "lib")))) return abs;
    await run(project ? ["git", "sparse-checkout", "add", "--", project] : ["git", "sparse-checkout", "disable"], { cwd: cloneDir, timeoutMs: 180_000 });
    if (!existsSync(join(abs, "aiken.toml"))) throw new UserError(`Checkout of ${project || "."} produced no aiken.toml.`, 502);
    return abs;
  });
}

async function which(bin: string): Promise<string | null> {
  try { return (await run(["/bin/sh", "-c", `command -v ${bin}`], { timeoutMs: 5000 })).trim() || null; } catch { return null; }
}

export type Capabilities = {
  full: boolean;
  serverless: boolean;
  git: boolean;
  aiken: boolean;
  bun: boolean;
  model: boolean;
  reason: string;
};

let cachedCaps: Promise<Capabilities> | undefined;

/** Reports whether the host can run the full review (clone, scan, exploit jobs). Presence only; never reads secret values. */
export function capabilities(): Promise<Capabilities> {
  cachedCaps ??= (async () => {
    const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
    const git = !serverless && Boolean(await which("git"));
    const aikenBin = process.env.AIKEN_BIN ?? `${process.env.HOME ?? homedir()}/.aiken/bin/aiken`;
    const aiken = !serverless && existsSync(aikenBin);
    const bun = !serverless && Boolean(await which("bun") ?? (existsSync(bunPath()) ? bunPath() : null));
    const model = Boolean(process.env.OPENROUTER_API_KEY);
    const full = git && aiken && bun && model;
    const reason = serverless
      ? "Live repository review runs on self-hosted instances, where git and the Aiken compiler are installed. This deployment shows the recorded benchmark."
      : !git ? "git is not installed on this host."
      : !aiken ? "The Aiken compiler is not installed on this host, so findings cannot be confirmed."
      : !bun ? "bun is not installed on this host, so exploit jobs cannot run."
      : !model ? "No model key is configured on this host, so exploit tests cannot be generated."
      : "";
    return { full, serverless, git, aiken, bun, model, reason };
  })();
  return cachedCaps;
}

export function bunPath(): string {
  return process.env.BUN_BIN ?? `${process.env.BUN_INSTALL ?? `${process.env.HOME ?? homedir()}/.bun`}/bin/bun`;
}
