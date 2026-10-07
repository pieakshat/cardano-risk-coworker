import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["engine", "memo"],
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/analyze": ["../engine/fixtures/**", "../engine/cache/**", "../engine/known-scripts.json"],
    "/api/security": ["../security/bench/results.json"],
  },
  // preflight/ lives outside web/ and Vercel installs only web/node_modules, so imports from there resolve here too.
  webpack(config) {
    config.resolve.modules = [...(config.resolve.modules ?? ["node_modules"]), path.join(repoRoot, "web", "node_modules")];
    return config;
  },
};

export default nextConfig;
