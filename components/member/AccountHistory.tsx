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
import { depositFlow, formatRecordedAt, transactionHistory, type HistoryLine } from "@/lib/investments/history";
import { adminTableRow, investmentColumns } from "@/lib/admin/table";
import { formatUsdtAmount, type CommissionEntry, type InvestmentRecord, type ProfitEntry, type WithdrawalRequest } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

type HistoryData = {
  investments: InvestmentRecord[];
  profits: ProfitEntry[];
  commissions: CommissionEntry[];
  withdrawals: WithdrawalRequest[];
};

const empty: HistoryData = { investments: [], profits: [], commissions: [], withdrawals: [] };

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

  return (
    <div className="stack">
      <Card>
        <h1>{title}</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Date, time, and flow come only from stored records. Nothing here is invented, and nothing is paid out.
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      <HistorySection id="investment-history" heading="Investment history" empty="No stored investments." loading={data === null}>
        {data?.investments.map((investment) => (
          <Card key={investment.investmentId}>
            <p className="eyebrow">{investment.planName}</p>
            <h2>{formatUsdtAmount(investment.amountMinor, investment.scale)}</h2>
            <p style={{ marginTop: 10 }}>{investment.depositReference ? `Reference ${investment.depositReference}` : "No reference stored"}</p>
            <FlowLines lines={depositFlow(investment)} />
          </Card>
        ))}
      </HistorySection>
      <HistorySection id="return-history" heading="Return history" empty="No stored returns." loading={data === null}>
        {data?.profits.map((entry) => (
          <Card key={`${entry.investmentId}-${entry.paymentNumber}`}>
            <p className="eyebrow">{entry.planName}</p>
            <h2>{formatUsdtAmount(entry.profitMinor, entry.scale)}</h2>
            <p style={{ marginTop: 10 }}>Payment {entry.paymentNumber} of 12</p>
            <p>Posted {formatRecordedAt(entry.postedAt)}</p>
          </Card>
        ))}
      </HistorySection>
      <HistorySection id="commission-history" heading="Commission history" empty="No stored commissions." loading={data === null}>
        {data?.commissions.map((entry) => (
          <Card key={`${entry.investmentId}-${entry.period}-${entry.generation}`}>
            <p className="eyebrow">{entry.generation === 1 ? "Direct sponsor" : "Second generation"}</p>
            <h2>{formatUsdtAmount(entry.commissionMinor, entry.scale)}</h2>
            <p style={{ marginTop: 10 }}>{entry.planName}</p>
            <p>Posted {formatRecordedAt(entry.postedAt)}</p>
          </Card>
        ))}
      </HistorySection>
      <HistorySection id="withdrawal-history" heading="Withdrawal history" empty="No stored withdrawal requests." loading={data === null}>
        {data?.withdrawals.map((request) => (
          <Card key={request.withdrawalId}>
            <p className="eyebrow">{request.status}</p>
            <h2>{formatUsdtAmount(request.amountMinor, request.scale)}</h2>
            <FlowLines lines={[{ at: request.createdAt, flow: `Requested as ${request.status}` }]} />
          </Card>
        ))}
      </HistorySection>
    </div>
  );
}

function HistorySection({
  id,
  heading,
  empty,
  loading,
  children,
}: {
  id?: string;
  heading: string;
  empty: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : children ? [children] : [];
  return (
    <>
      <Card>
        <h2 id={id}>{heading}</h2>
      </Card>
      {loading ? (
        <Card>
          <p>Loading stored records…</p>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <p>{empty}</p>
        </Card>
      ) : (
        items
      )}
    </>
  );
}

function FlowLines({ lines }: { lines: HistoryLine[] }) {
  return (
    <div style={{ marginTop: 10 }}>
      {lines.map((line) => (
        <p key={`${line.at}:${line.flow}`}>
          {line.flow}. Date and time {formatRecordedAt(line.at)}
        </p>
      ))}
    </div>
  );
}
