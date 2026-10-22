"use client";

import { traceLines, traceMember, type TraceMember } from "@/lib/admin/trace";

export function AdminTrace({
  members,
  ownerSub,
  recordedAt,
  plan,
  amount,
  status,
  reference,
  submittedAt,
  reviewedAt,
  activatedAt,
  nextDueAt,
}: {
  members: readonly TraceMember[] | null;
  ownerSub: string;
  recordedAt?: string;
  plan?: string;
  amount?: string;
  status?: string;
  reference?: string;
  submittedAt?: string;
  reviewedAt?: string;
  activatedAt?: string;
  nextDueAt?: string;
}) {
  const lines = traceLines({
    ownerSub,
    member: traceMember(members, ownerSub),
    recordedAt,
    plan,
    amount,
    status,
    reference,
    submittedAt,
    reviewedAt,
    activatedAt,
    nextDueAt,
  });
  return (
    <div style={{ marginTop: 10 }}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
