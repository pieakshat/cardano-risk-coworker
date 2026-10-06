import type { RiskReport } from "../engine/types.ts";

export type Network = "mainnet" | "preprod";
export type SubjectKind = "token" | "script" | "x402_payment";

export type PaymentInput = {
  type: "x402_payment";
  network: `cardano:${Network}`;
  payTo: string;
  asset?: string;
  amount: string;
  resource?: string;
  maxAmount: string;
  maxTimeoutSeconds?: number;
  terms?: Record<string, unknown>;
};

export type PreflightInput =
  | { type: "token"; network: Network; input: string }
  | { type: "script"; network: Network; input: string }
  | PaymentInput;

export type Evidence = { rule: string; value: string; source: string };
export type Assessment = {
  decision: "INTERACT" | "INTERACT_WITH_CONDITIONS" | "DO_NOT_INTERACT";
  evidenceScore: number;
  blockingReasons: string[];
  conditions: string[];
  evidence: Evidence[];
  subject: {
    kind: SubjectKind;
    network: Network;
    payTo?: string;
    asset?: string;
    amount?: string;
    resource?: string;
  };
  checkedAt: string;
  termsHash?: string;
};

export type PreflightDeps = {
  fetcher?: typeof fetch;
  fixtureDir?: string;
  now?: () => string;
};

export type PaymentFacts = {
  addressInfo: any;
  txs: any[];
  utxos: any[];
  script?: any;
  asset?: any;
  assetPolicy?: any;
};

export type DelegatedReport = RiskReport;
