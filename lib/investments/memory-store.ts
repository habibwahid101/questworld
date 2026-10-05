import type {
  CreateInvestmentResult,
  DepositSubmission,
  DepositSubmissionResult,
  InvestmentRecord,
  InvestmentStore,
} from "./service.ts";

export function createMemoryInvestmentStore(seed: readonly InvestmentRecord[] = []): InvestmentStore {
  const investments = new Map<string, InvestmentRecord>();
  const idempotency = new Map<string, string>();
  for (const record of seed) {
    investments.set(`${record.ownerSub}#${record.investmentId}`, structuredClone(record));
  }

  return {
    async create(record, idempotencyKey): Promise<CreateInvestmentResult> {
      const requestKey = `${record.ownerSub}#${idempotencyKey}`;
      const existingId = idempotency.get(requestKey);
      if (existingId) {
        return { result: "exists", investmentId: existingId };
      }
      const itemKey = `${record.ownerSub}#${record.investmentId}`;
      if (investments.has(itemKey)) {
        return { result: "id-taken" };
      }
      investments.set(itemKey, structuredClone(record));
      idempotency.set(requestKey, record.investmentId);
      return { result: "created" };
    },
    async submitDeposit(submission: DepositSubmission): Promise<DepositSubmissionResult> {
      const requestKey = `${submission.ownerSub}#deposit#${submission.idempotencyKey}`;
      const existingId = idempotency.get(requestKey);
      if (existingId) {
        return existingId === submission.investmentId ? { result: "exists" } : { result: "rejected" };
      }
      const itemKey = `${submission.ownerSub}#${submission.investmentId}`;
      const current = investments.get(itemKey);
      if (!current) {
        return { result: "not-found" };
      }
      if (current.status !== "awaiting_deposit") {
        return { result: "rejected" };
      }
      investments.set(itemKey, {
        ...current,
        status: "pending_verification",
        depositReference: submission.depositReference,
        submittedAt: submission.submittedAt,
        updatedAt: submission.submittedAt,
        statusChangedAt: submission.submittedAt,
      });
      idempotency.set(requestKey, submission.investmentId);
      return { result: "submitted" };
    },
    async getById(ownerSub, investmentId) {
      const found = investments.get(`${ownerSub}#${investmentId}`);
      return found ? structuredClone(found) : null;
    },
    async listByOwner(ownerSub) {
      return [...investments.values()]
        .filter((record) => record.ownerSub === ownerSub)
        .map((record) => structuredClone(record))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.investmentId.localeCompare(right.investmentId));
    },
  };
}