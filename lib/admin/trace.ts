import { formatRecordedAt } from "../investments/history.ts";

export type TraceMember = {
  userId: string;
  name: string;
  email: string;
};

export function traceMember(members: readonly TraceMember[] | null | undefined, ownerSub: string): { name: string; email: string } | null {
  const found = members?.find((member) => member.userId === ownerSub);
  if (!found || found.name.trim().length === 0 || found.email.trim().length === 0) {
    return null;
  }
  return { name: found.name, email: found.email };
}

export function traceLines(input: {
  ownerSub: string;
  member: { name: string; email: string } | null;
  recordedAt?: string;
  plan?: string;
  amount?: string;
  status?: string;
  reference?: string;
  submittedAt?: string;
  reviewedAt?: string;
  activatedAt?: string;
  nextDueAt?: string;
}): string[] {
  const lines = [input.member ? `Who ${input.member.name} ${input.member.email}` : `Who ${input.ownerSub}`];
  if (input.recordedAt) {
    lines.push(`Recorded ${formatRecordedAt(input.recordedAt)}`);
  }
  if (input.plan) {
    lines.push(`Plan ${input.plan}`);
  }
  if (input.amount) {
    lines.push(`Amount ${input.amount}`);
  }
  if (input.status) {
    lines.push(`Status ${input.status}`);
  }
  if (input.reference) {
    lines.push(`Reference ${input.reference}`);
  }
  if (input.submittedAt) {
    lines.push(`Submitted ${formatRecordedAt(input.submittedAt)}`);
  }
  if (input.reviewedAt) {
    lines.push(`Reviewed ${formatRecordedAt(input.reviewedAt)}`);
  }
  if (input.activatedAt) {
    lines.push(`Activated ${formatRecordedAt(input.activatedAt)}`);
  }
  if (input.nextDueAt) {
    lines.push(`Next due ${formatRecordedAt(input.nextDueAt)}`);
  }
  return lines;
}
