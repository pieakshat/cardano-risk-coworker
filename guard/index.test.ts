import { describe, expect, test } from "bun:test";
import { decideVerdict, RefusedPayment, type RiskVerdict } from "./index.ts";

const denied: RiskVerdict = { decision: "DO_NOT_INTERACT", blockingReasons: ["asset-mint-open"], conditions: ["counterparty-tx-count"] };

describe("Risk Desk policy", () => {
  test("always refuses DO_NOT_INTERACT", () => {
    expect(decideVerdict(denied, { interactWithConditions: "allow" })).toBe(false);
    expect(() => { throw new RefusedPayment(denied, denied.blockingReasons!); }).toThrow("asset-mint-open");
  });

  test("INTERACT always pays", () => {
    expect(decideVerdict({ decision: "INTERACT" })).toBe(true);
  });

  test("conditions follow caller policy", () => {
    const verdict: RiskVerdict = { decision: "INTERACT WITH CONDITIONS", conditions: ["new-counterparty"] };
    expect(decideVerdict(verdict)).toBe(false);
    expect(decideVerdict(verdict, { interactWithConditions: "allow" })).toBe(true);
    expect(decideVerdict(verdict, { interactWithConditions: () => false })).toBe(false);
  });
});
