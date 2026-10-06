import { blake2b } from "@noble/hashes/blake2.js";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export function canonicalJson(value: unknown): string { return canonical(value); }
export function termsHash(value: unknown): string { return Buffer.from(blake2b(new TextEncoder().encode(canonical(value)), { dkLen: 32 })).toString("hex"); }
