import type { CommissionEntry, InvestmentRecord, ProfitEntry, WithdrawalRequest } from "./service.ts";

export type HistoryLine = {
  at: string;
  flow: string;
};

export function formatRecordedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export function depositFlow(record: InvestmentRecord): HistoryLine[] {
  const lines: HistoryLine[] = [{ at: record.createdAt, flow: "Recorded as awaiting deposit" }];
  if (record.submittedAt) {
    lines.push({ at: record.submittedAt, flow: "Deposit reference submitted" });
  }
  if (record.reviewedAt) {
    lines.push({
      at: record.reviewedAt,
      flow: record.status === "rejected" ? "Deposit rejected" : "Deposit verified",
    });
  }
  if (record.activatedAt) {
    lines.push({ at: record.activatedAt, flow: "Investment activated" });
  }
  return lines;
}

export type TransactionHistoryItem = {
  id: string;
  title: string;
  at: string;
  flow: string;
};

export function transactionHistory(input: {
  investments: readonly InvestmentRecord[];
  profits: readonly ProfitEntry[];
  commissions: readonly CommissionEntry[];
  withdrawals: readonly WithdrawalRequest[];
}): TransactionHistoryItem[] {
  const items: TransactionHistoryItem[] = [
    ...input.investments.map((record) => ({
      id: `investment:${record.investmentId}`,
      title: record.planName,
      at: record.statusChangedAt || record.createdAt,
      flow: record.status,
    })),
    ...input.profits.map((entry) => ({
      id: `profit:${entry.investmentId}:${entry.period}`,
      title: entry.planName,
      at: entry.postedAt,
      flow: "Profit posted",
    })),
    ...input.commissions.map((entry) => ({
      id: `commission:${entry.investmentId}:${entry.period}:${entry.generation}`,
      title: entry.planName,
      at: entry.postedAt,
      flow: `Generation ${entry.generation} commission posted`,
    })),
    ...input.withdrawals.map((request) => ({
      id: `withdrawal:${request.withdrawalId}`,
      title: "Withdrawal",
      at: request.createdAt,
      flow: request.status,
    })),
  ];
  return items.sort((left, right) => right.at.localeCompare(left.at) || left.id.localeCompare(right.id));
}
