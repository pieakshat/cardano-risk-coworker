import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { createPayment } from "./payment.ts";
import { env, loadEnv } from "./config.ts";

loadEnv();
const jobs = new Map<string, { repoUrl: string; payment: Record<string, unknown> }>();

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  let value: Record<string, unknown>;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>; }
  catch { throw new Error("request body must be valid JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("request body must be a JSON object");
  if (!value.repoUrl && !value.repo) throw new Error("repoUrl is required");
  return value;
}

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method === "GET" && request.url === "/health") {
    response.end(JSON.stringify({ ok: true, service: "aiken-security-reviewer" }));
    return;
  }
  if (request.method !== "POST" || request.url !== "/hire") {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }
  try {
    const input = await body(request);
    const serialized = JSON.stringify(input);
    const payment = await createPayment(serialized);
    const jobId = randomUUID();
    jobs.set(jobId, { repoUrl: String(input.repoUrl ?? input.repo), payment });
    const data = payment.data && typeof payment.data === "object" ? payment.data as Record<string, unknown> : payment;
    response.end(JSON.stringify({ jobId, paymentId: data.blockchainIdentifier ?? null, masumiPayment: payment.data ?? payment }));
  } catch (error) {
    response.statusCode = 503;
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "hire failed" }));
  }
});

server.listen(Number(env("PORT", "4412")), "127.0.0.1");
