import { formatRecordedAt } from "../investments/history.ts";
import { traceMember, type TraceMember } from "./trace.ts";

export const adminTableColumns = [
  "who",
  "recorded",
  "plan",
  "amount",
  "status",
  "reference",
  "submitted",
  "reviewed",
  "activated",
  "nextDue",
  "paymentsPosted",
] as const;

export type AdminTableColumn = (typeof adminTableColumns)[number];

export const adminTableLabels: Record<AdminTableColumn, string> = {
  who: "Who",
  recorded: "Recorded",
  plan: "Plan",
  amount: "Amount",
  status: "Status",
  reference: "Reference",
  submitted: "Submitted",
  reviewed: "Reviewed",
  activated: "Activated",
  nextDue: "Next due",
  paymentsPosted: "Payments posted",
};

export type AdminTableRow = {
  id: string;
  ownerSub: string;
  whoName: string;
  whoEmail: string;
  recorded: string;
  plan: string;
  amount: string;
  status: string;
  reference: string;
  submitted: string;
  reviewed: string;
  activated: string;
  nextDue: string;
  paymentsPosted: string;
};

export function adminTableRow(input: {
  id: string;
  ownerSub: string;
  members: readonly TraceMember[] | null | undefined;
  recordedAt?: string;
  plan?: string;
  amount?: string;
  status?: string;
  reference?: string;
  submittedAt?: string;
  reviewedAt?: string;
  activatedAt?: string;
  nextDueAt?: string;
  paymentsPosted?: number;
}): AdminTableRow {
  const member = traceMember(input.members, input.ownerSub);
  return {
    id: input.id,
    ownerSub: input.ownerSub,
    whoName: member?.name ?? "",
    whoEmail: member?.email ?? "",
    recorded: input.recordedAt ? formatRecordedAt(input.recordedAt) : "",
    plan: input.plan ?? "",
    amount: input.amount ?? "",
    status: input.status ?? "",
    reference: input.reference ?? "",
    submitted: input.submittedAt ? formatRecordedAt(input.submittedAt) : "",
    reviewed: input.reviewedAt ? formatRecordedAt(input.reviewedAt) : "",
    activated: input.activatedAt ? formatRecordedAt(input.activatedAt) : "",
    nextDue: input.nextDueAt ? formatRecordedAt(input.nextDueAt) : "",
    paymentsPosted: typeof input.paymentsPosted === "number" ? String(input.paymentsPosted) : "",
  };
}

export const investmentColumns: readonly AdminTableColumn[] = adminTableColumns;

export const profitColumns: readonly AdminTableColumn[] = ["who", "recorded", "plan", "amount", "status"];

export const withdrawalColumns: readonly AdminTableColumn[] = ["who", "recorded", "amount", "status", "reviewed"];

export function filterAdminRows(rows: readonly AdminTableRow[], query: string): AdminTableRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...rows];
  }
  return rows.filter((row) =>
    [row.whoName, row.whoEmail, row.plan, row.amount, row.status, row.reference].some((value) => value.toLowerCase().includes(needle)),
  );
}
