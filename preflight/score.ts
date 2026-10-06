/**
 * evidenceScore starts at 100 and subtracts the following explicit penalties.
 *
 * | rule                         | penalty | effect                         |
 * |------------------------------|---------|--------------------------------|
 * | counterparty-first-seen      | 10      | condition if age is under 24h  |
 * | counterparty-tx-count        | 10      | condition if fewer than 3 txs  |
 * | script-unknown-protocol      | 10      | condition for valuable script  |
 * | asset-mint-open              | 40      | blocking                       |
 * | amount-over-cap              | 40      | blocking                       |
 * | resource-not-https           | 40      | blocking                       |
 * | timeout-insane               | 10      | condition                      |
 */
const PENALTIES: Record<string, number> = {
  "counterparty-first-seen": 10,
  "counterparty-tx-count": 10,
  "script-unknown-protocol": 10,
  "asset-mint-open": 40,
  "amount-over-cap": 40,
  "resource-not-https": 40,
  "timeout-insane": 10,
};

export function evidenceScore(ruleIds: string[]): number {
  const penalty = [...new Set(ruleIds)].reduce((total, id) => total + (PENALTIES[id] ?? 0), 0);
  return Math.max(0, 100 - penalty);
}

export function decision(blockingReasons: string[], conditions: string[]): "INTERACT" | "INTERACT_WITH_CONDITIONS" | "DO_NOT_INTERACT" {
  if (blockingReasons.length) return "DO_NOT_INTERACT";
  return conditions.length ? "INTERACT_WITH_CONDITIONS" : "INTERACT";
}
