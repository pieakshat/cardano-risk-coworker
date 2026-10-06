import { loadJob } from "../../../../../lib/security-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await loadJob(id);
  if (!job) return Response.json({ error: "Unknown job." }, { status: 404 });
  return Response.json(job, { headers: { "cache-control": "no-store" } });
}
