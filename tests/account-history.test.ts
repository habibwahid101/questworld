import assert from "node:assert/strict";
import test from "node:test";
import { depositFlow, transactionHistory } from "../lib/investments/history.ts";
import type { InvestmentRecord } from "../lib/investments/service.ts";

function investment(overrides: Partial<InvestmentRecord> = {}): InvestmentRecord {
  return {
    investmentId: "inv_1",
    ownerSub: "user-1",
    planId: "starter",
    planName: "Starter",
    amountMinor: 100_000_000,
    currency: "USDT",
    scale: 6,
    status: "awaiting_deposit",
    createdAt: "2026-10-02T13:48:39.172Z",
    updatedAt: "2026-10-02T13:48:39.172Z",
    statusChangedAt: "2026-10-02T13:48:39.172Z",
    ...overrides,
  };
}

test("deposit and transaction history use stored records only", () => {
  assert.deepEqual(depositFlow(investment()), [
    { at: "2026-10-02T13:48:39.172Z", flow: "Recorded as awaiting deposit" },
  ]);

  const active = investment({
    status: "active",
    submittedAt: "2026-10-03T01:00:00.000Z",
    reviewedAt: "2026-10-04T01:00:00.000Z",
    activatedAt: "2026-10-06T11:42:38.368Z",
    depositReference: "QW-STEP06-HABIB-100",
  });
  assert.deepEqual(depositFlow(active).map((line) => line.at), [
    "2026-10-02T13:48:39.172Z",
    "2026-10-03T01:00:00.000Z",
    "2026-10-04T01:00:00.000Z",
    "2026-10-06T11:42:38.368Z",
  ]);

  const history = transactionHistory({
    investments: [active],
    profits: [],
    commissions: [],
    withdrawals: [],
  });
  assert.equal(history.length, 1);
  assert.equal(history[0]?.flow, "active");
  assert.equal(transactionHistory({ investments: [], profits: [], commissions: [], withdrawals: [] }).length, 0);
});
