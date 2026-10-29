import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { depositFlow, transactionHistory } from "../lib/investments/history.ts";
import { traceLines, traceMember } from "../lib/admin/trace.ts";
import { adminTableRow, filterAdminRows, profitColumns, withdrawalColumns } from "../lib/admin/table.ts";
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

  const historyPage = readFileSync(new URL("../components/member/AccountHistory.tsx", import.meta.url), "utf8");
  assert.match(historyPage, /Investment history/);
  assert.match(historyPage, /Return history/);
  assert.match(historyPage, /Commission history/);
  assert.match(historyPage, /Withdrawal history/);
  assert.doesNotMatch(historyPage, /Deposit history|Profit history|Transaction history/);
  assert.ok(historyPage.indexOf("Investment history") < historyPage.indexOf("Return history"));
  assert.ok(historyPage.indexOf("Return history") < historyPage.indexOf("Commission history"));
  assert.ok(historyPage.indexOf("Commission history") < historyPage.indexOf("Withdrawal history"));
  assert.match(historyPage, /id="investment-history"/);
  assert.match(historyPage, /id="return-history"/);
  assert.match(historyPage, /id="commission-history"/);
  assert.match(historyPage, /id="withdrawal-history"/);
  assert.match(historyPage, /<table>/);
  assert.match(historyPage, /Date & Time/);
  assert.match(historyPage, /From investment/);
  assert.match(historyPage, /Awaiting deposit/);
  assert.match(historyPage, /Deposit submitted/);
  assert.match(historyPage, /Deposit verified/);
  assert.doesNotMatch(historyPage, /<Card key=/);
  assert.ok(historyPage.indexOf('["Date & Time", "Plan", "Amount", "Status", "Reference"]') < historyPage.indexOf('["Date & Time", "Period", "Amount", "Status"]'));
  assert.ok(historyPage.indexOf('["Date & Time", "Period", "Amount", "Status"]') < historyPage.indexOf('["Date & Time", "Generation", "Amount", "From investment"]'));
  assert.ok(historyPage.indexOf('["Date & Time", "Generation", "Amount", "From investment"]') < historyPage.indexOf('["Date & Time", "Amount", "Status"]'));
  const historyCss = readFileSync(new URL("../components/member/AccountHistory.module.css", import.meta.url), "utf8");
  assert.match(historyCss, /overflow-x:\s*auto/);
  assert.match(historyCss, /display:\s*table/);
  assert.doesNotMatch(historyCss, /display:\s*block/);
  const nav = readFileSync(new URL("../constants/site.ts", import.meta.url), "utf8");
  const memberNav = nav.slice(nav.indexOf("export const memberNav"), nav.indexOf("export const adminNav"));
  assert.doesNotMatch(memberNav, /Profit History|\/profit-history/);
  assert.match(memberNav, /Transactions/);

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
  const missing = adminTableRow({ id: "row-1", ownerSub: "missing-sub", members: [], plan: "Starter", amount: "100 USDT", status: "Active" });
  assert.equal(missing.whoName, "");
  assert.equal(missing.whoEmail, "");
  assert.equal(missing.ownerSub, "missing-sub");
  assert.equal(missing.recorded, "");
  assert.equal(missing.submitted, "");
  assert.equal(missing.paymentsPosted, "");
  const named = adminTableRow({
    id: "row-2",
    ownerSub: "user-1",
    members: [{ userId: "user-1", name: "Ada", email: "ada@example.com" }],
    plan: "Starter",
    amount: "100 USDT",
    status: "Active",
    reference: "REF-1",
    paymentsPosted: 2,
  });
  assert.equal(named.whoName, "Ada");
  assert.equal(named.whoEmail, "ada@example.com");
  assert.equal(named.paymentsPosted, "2");
  assert.deepEqual(filterAdminRows([named, missing], "ada@example.com").map((row) => row.id), ["row-2"]);
  assert.deepEqual(filterAdminRows([named, missing], "starter").map((row) => row.id), ["row-2", "row-1"]);
  assert.deepEqual(filterAdminRows([named], "missing-sub"), []);
  assert.deepEqual(profitColumns, ["who", "recorded", "plan", "amount", "status"]);
  assert.deepEqual(withdrawalColumns, ["who", "recorded", "amount", "status", "reviewed"]);
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
    assert.match(source, /AdminRecordTable/);
    assert.match(source, /useStoredMembers/);
    assert.match(source, /adminTableRow/);
    assert.doesNotMatch(source, /Unknown member|name: "Member"/);
  }
  const table = readFileSync(new URL("../components/admin/AdminRecordTable.tsx", import.meta.url), "utf8");
  const tableCss = readFileSync(new URL("../components/admin/AdminRecordTable.module.css", import.meta.url), "utf8");
  const users = readFileSync(new URL("../components/admin/AdminUsersPanel.tsx", import.meta.url), "utf8");
  assert.match(table, /filterAdminRows/);
  assert.match(table, /Search/);
  assert.match(tableCss, /overflow-x:\s*auto/);
  assert.match(tableCss, /min-width:\s*720px/);
  assert.doesNotMatch(tableCss, /display:\s*block/);
  assert.match(users, /<table>/);
  assert.match(users, /Grant admin/);
  assert.match(users, /Remove admin/);
  assert.doesNotMatch(users, /<Card key=/);
  const profits = readFileSync(new URL("../components/admin/AdminProfitsPanel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(profits, /reviewAdminWithdrawal|activateVerifiedInvestment|reviewPendingDeposit/);
});
