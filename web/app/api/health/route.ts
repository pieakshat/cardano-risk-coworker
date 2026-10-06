import { access } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED = ["KAIOS_KEY", "BLOCKFROST_API_KEY_MAINNET", "OPENROUTER_API_KEY", "MODEL"] as const;

export async function GET() {
  const env = Object.fromEntries(REQUIRED.map((name) => [name, Boolean(process.env[name])]));
  const fixtures = await access(join(process.cwd(), "../engine/fixtures/min-asset_info.json")).then(() => true, () => false);
  return Response.json({ ok: true, engineBundled: fixtures, env });
}
