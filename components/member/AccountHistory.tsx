"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { AdminRecordTable } from "@/components/admin/AdminRecordTable";
import { useStoredMembers } from "@/components/admin/useStoredMembers";
import {
  InvestmentClientError,
  listAdminCommissions,
  listAdminInvestments,
  listAdminProfits,
  listAdminWithdrawals,
  listCurrentCommissions,
  listCurrentInvestments,
  listCurrentProfits,
  listCurrentWithdrawals,
} from "@/lib/investments/client";
import { formatRecordedAt, transactionHistory } from "@/lib/investments/history";
import { adminTableRow, investmentColumns } from "@/lib/admin/table";
import {
  formatUsdtAmount,
  type CommissionEntry,
  type InvestmentRecord,
  type InvestmentStatus,
  type ProfitEntry,
  type WithdrawalRequest,
  type WithdrawalStatus,
} from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";
import styles from "./AccountHistory.module.css";

type HistoryData = {
  investments: InvestmentRecord[];
  profits: ProfitEntry[];
  commissions: CommissionEntry[];
  withdrawals: WithdrawalRequest[];
};

const empty: HistoryData = { investments: [], profits: [], commissions: [], withdrawals: [] };

const investmentStatusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Deposit submitted",
  deposit_verified: "Deposit verified",
  active: "Active",
  rejected: "Rejected",
  completed: "Completed",
};

const withdrawalStatusLabel: Record<WithdrawalStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function MemberAccountHistory() {
  return <AccountHistory title="Transactions" audience="member" />;
}

export function AdminAccountHistory() {
  return <AccountHistory title="Transactions" audience="admin" />;
}

function AccountHistory({ title, audience }: { title: string; audience: "member" | "admin" }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const members = useStoredMembers(audience === "admin");

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    const load = audience === "admin"
      ? Promise.all([listAdminInvestments(), listAdminProfits(), listAdminCommissions(), listAdminWithdrawals()])
      : Promise.all([
          listCurrentInvestments(),
          listCurrentProfits(),
          listCurrentCommissions(),
          listCurrentWithdrawals().then((result) => result.withdrawals),
        ]);
    void load
      .then(([investments, profits, commissions, withdrawals]) => {
        if (active) {
          setData({ investments, profits, commissions, withdrawals });
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not load stored history.");
        setMessage(error.message);
        setData(empty);
      });
    return () => {
      active = false;
    };
  }, [audience]);

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>{title}</h1>
        <p className="lead">Stored history is not connected in this build yet.</p>
      </Card>
    );
  }

  const transactions = data ? transactionHistory(data) : [];

  if (audience === "admin") {
    return (
      <div className="stack">
        <Card>
          <h1>{title}</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            Date, time, and flow come only from stored records. Nothing here is invented, and nothing is paid out.
          </p>
          {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
        </Card>
        <AdminRecordTable
          columns={investmentColumns}
          loading={data === null}
          empty="No stored transactions."
          rows={transactions.map((item) =>
            adminTableRow({
              id: item.id,
              ownerSub: item.ownerSub,
              members,
              recordedAt: item.at,
              plan: item.planName,
              amount: formatUsdtAmount(item.amountMinor, item.scale),
              status: item.flow,
              reference: item.reference,
              submittedAt: item.submittedAt,
              reviewedAt: item.reviewedAt,
              activatedAt: item.activatedAt,
              nextDueAt: item.nextDueAt,
              paymentsPosted: item.paymentsPosted,
            }),
          )}
        />
      </div>
    );
  }

  const loading = data === null;

  return (
    <div className="stack">
      <Card>
        <h1>{title}</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Date, time, and flow come only from stored records. Nothing here is invented, and nothing is paid out.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <HistoryTable
        id="investment-history"
        heading="Investment history"
        columns={["Date & Time", "Plan", "Amount", "Status", "Reference"]}
        empty="No stored investments."
        loading={loading}
        rows={(data?.investments ?? []).map((investment) => ({
          key: investment.investmentId,
          cells: [
            formatRecordedAt(investmentRecordedAt(investment)),
            investment.planName,
            formatUsdtAmount(investment.amountMinor, investment.scale),
            investmentStatusLabel[investment.status],
            investment.depositReference?.trim() || "—",
          ],
        }))}
      />
      <HistoryTable
        id="return-history"
        heading="Return history"
        columns={["Date & Time", "Period", "Amount", "Status"]}
        empty="No stored returns."
        loading={loading}
        rows={(data?.profits ?? []).map((entry) => ({
          key: `${entry.investmentId}-${entry.paymentNumber}`,
          cells: [
            formatRecordedAt(entry.postedAt),
            formatRecordedAt(entry.period),
            formatUsdtAmount(entry.profitMinor, entry.scale),
            "Posted",
          ],
        }))}
      />
      <HistoryTable
        id="commission-history"
        heading="Commission history"
        columns={["Date & Time", "Generation", "Amount", "From investment"]}
        empty="No stored commissions."
        loading={loading}
        rows={(data?.commissions ?? []).map((entry) => ({
          key: `${entry.investmentId}-${entry.period}-${entry.generation}`,
          cells: [
            formatRecordedAt(entry.postedAt),
            entry.generation === 1 ? "Direct sponsor" : "Second generation",
            formatUsdtAmount(entry.commissionMinor, entry.scale),
            entry.planName,
          ],
        }))}
      />
      <HistoryTable
        id="withdrawal-history"
        heading="Withdrawal history"
        columns={["Date & Time", "Amount", "Status"]}
        empty="No stored withdrawal requests."
        loading={loading}
        rows={(data?.withdrawals ?? []).map((request) => ({
          key: request.withdrawalId,
          cells: [
            formatRecordedAt(request.createdAt),
            formatUsdtAmount(request.amountMinor, request.scale),
            withdrawalStatusLabel[request.status],
          ],
        }))}
      />
    </div>
  );
}

function investmentRecordedAt(record: InvestmentRecord): string {
  if (record.status === "pending_verification") {
    return record.submittedAt || record.statusChangedAt || record.createdAt;
  }
  if (record.status === "deposit_verified" || record.status === "rejected") {
    return record.reviewedAt || record.statusChangedAt || record.createdAt;
  }
  if (record.status === "active") {
    return record.activatedAt || record.statusChangedAt || record.createdAt;
  }
  return record.statusChangedAt || record.createdAt;
}

function HistoryTable({
  id,
  heading,
  columns,
  empty,
  loading,
  rows,
}: {
  id: string;
  heading: string;
  columns: readonly string[];
  empty: string;
  loading: boolean;
  rows: readonly { key: string; cells: readonly string[] }[];
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id}>{heading}</h2>
      <div className={styles.scroll}>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length}>Loading stored records…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, index) => (
                    <td key={columns[index]}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
