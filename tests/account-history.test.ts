import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { depositFlow, transactionHistory } from "../lib/investments/history.ts";
import { traceLines, traceMember } from "../lib/admin/trace.ts";
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
  assert.equal(history[0]?.ownerSub, "user-1");
  assert.equal(transactionHistory({ investments: [], profits: [], commissions: [], withdrawals: [] }).length, 0);
  assert.equal(traceMember([{ userId: "user-1", name: "Ada", email: "ada@example.com" }], "user-1")?.email, "ada@example.com");
  assert.equal(traceMember([{ userId: "user-1", name: "Ada", email: "ada@example.com" }], "missing"), null);
  assert.equal(traceMember([{ userId: "user-1", name: " ", email: "ada@example.com" }], "user-1"), null);
  assert.deepEqual(traceLines({ ownerSub: "missing-sub", member: null, plan: "Starter", amount: "100 USDT", status: "Active", reference: "REF-1" }), [
    "Who missing-sub",
    "Plan Starter",
    "Amount 100 USDT",
    "Status Active",
    "Reference REF-1",
  ]);
  assert.equal(traceLines({ ownerSub: "user-1", member: { name: "Ada", email: "ada@example.com" } })[0], "Who Ada ada@example.com");
  const panels = [
    "../components/admin/AdminInvestmentsPanel.tsx",
    "../components/admin/AdminDepositsPanel.tsx",
    "../components/admin/AdminProfitsPanel.tsx",
    "../components/admin/AdminCommissionsPanel.tsx",
    "../components/admin/AdminWithdrawalsPanel.tsx",
    "../components/member/AccountHistory.tsx",
  ];
  for (const panel of panels) {
    const source = readFileSync(new URL(panel, import.meta.url), "utf8");
    assert.match(source, /AdminTrace/);
    assert.match(source, /useStoredMembers/);
    assert.doesNotMatch(source, /Unknown member|name: "Member"/);
  }
  const profits = readFileSync(new URL("../components/admin/AdminProfitsPanel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(profits, /reviewAdminWithdrawal|activateVerifiedInvestment|reviewPendingDeposit/);
});
