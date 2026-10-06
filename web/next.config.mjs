import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["engine", "memo"],
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/analyze": ["../engine/fixtures/**", "../engine/cache/**"],
    "/api/security": ["../security/bench/results.json"],
  },
};

export default nextConfig;
