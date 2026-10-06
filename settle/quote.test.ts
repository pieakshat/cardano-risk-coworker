import { expect, test } from "bun:test";
import { amountInForExactOut, quotePriceImpact } from "./quote.ts";

test("Minswap exact-out math includes the 30 bps fee", () => {
  const withFee = amountInForExactOut(1_000_000n, 382_842_147_814n, 238_601_000_979n);
  const withoutFee = amountInForExactOut(1_000_000n, 382_842_147_814n, 238_601_000_979n, 0n);
  expect(withFee).toBeGreaterThan(withoutFee);
  expect(quotePriceImpact(withFee, 1_000_000n, 382_842_147_814n, 238_601_000_979n)).toBeGreaterThan(0);
});
