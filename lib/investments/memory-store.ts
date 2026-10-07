import type {
  CreateInvestmentResult,
  DepositReview,
  DepositReviewResult,
  DepositSubmission,
  DepositSubmissionResult,
  InvestmentActivation,
  InvestmentActivationResult,
  InvestmentRecord,
  InvestmentStore,
  ProfitEntry,
  CommissionEntry,
  WithdrawalRequest,
} from "./service.ts";

export function createMemoryInvestmentStore(seed: readonly InvestmentRecord[] = []): InvestmentStore {
  const investments = new Map<string, InvestmentRecord>();
  const profits = new Map<string, ProfitEntry>();
  const commissions = new Map<string, CommissionEntry>();
  const withdrawals = new Map<string, WithdrawalRequest>();
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
        ...(submission.depositProofKey ? { depositProofKey: submission.depositProofKey } : {}),
      });
      idempotency.set(requestKey, submission.investmentId);
      return { result: "submitted" };
    },
    async listPendingDeposits() {
      return [...investments.values()]
        .filter((record) => record.status === "pending_verification")
        .map((record) => structuredClone(record))
        .sort(
          (left, right) =>
            (right.submittedAt ?? right.createdAt).localeCompare(left.submittedAt ?? left.createdAt) ||
            left.investmentId.localeCompare(right.investmentId),
        );
    },
    async listVerifiedDeposits() {
      return [...investments.values()]
        .filter((record) => record.status === "deposit_verified")
        .map((record) => structuredClone(record))
        .sort(
          (left, right) =>
            (right.reviewedAt ?? right.createdAt).localeCompare(left.reviewedAt ?? left.createdAt) ||
            left.investmentId.localeCompare(right.investmentId),
        );
    },
    async reviewDeposit(review: DepositReview): Promise<DepositReviewResult> {
      const found = [...investments.entries()].find(([, record]) => record.investmentId === review.investmentId);
      if (!found) {
        return { result: "not-found" };
      }
      const [itemKey, current] = found;
      if (current.status !== "pending_verification") {
        return { result: "rejected" };
      }
      const record: InvestmentRecord = {
        ...current,
        status: review.decision,
        reviewedAt: review.reviewedAt,
        reviewedBy: review.reviewedBy,
        updatedAt: review.reviewedAt,
        statusChangedAt: review.reviewedAt,
      };
      investments.set(itemKey, record);
      return { result: "reviewed", record: structuredClone(record) };
    },
    async activateInvestment(activation: InvestmentActivation): Promise<InvestmentActivationResult> {
      const found = [...investments.entries()].find(([, record]) => record.investmentId === activation.investmentId);
      if (!found) {
        return { result: "not-found" };
      }
      const [itemKey, current] = found;
      if (current.status !== "deposit_verified") {
        return { result: "rejected" };
      }
      const record: InvestmentRecord = {
        ...current,
        status: "active",
        activatedAt: activation.activatedAt,
        activatedBy: activation.activatedBy,
        updatedAt: activation.activatedAt,
        statusChangedAt: activation.activatedAt,
      };
      investments.set(itemKey, record);
      return { result: "activated", record: structuredClone(record) };
    },
    async listActiveInvestments() {
      return [...investments.values()]
        .filter((record) => record.status === "active")
        .map((record) => structuredClone(record));
    },
    async putProfit(entry: ProfitEntry) {
      const key = `${entry.ownerSub}#${entry.investmentId}#${entry.period}`;
      if (profits.has(key)) {
        return "duplicate";
      }
      profits.set(key, structuredClone(entry));
      return "created";
    },
    async listProfits(ownerSub) {
      return [...profits.values()]
        .filter((entry) => entry.ownerSub === ownerSub)
        .map((entry) => structuredClone(entry))
        .sort(
          (left, right) => right.period.localeCompare(left.period) || left.investmentId.localeCompare(right.investmentId),
        );
    },
    async putCommission(entry: CommissionEntry) {
      const key = `${entry.recipientSub}#${entry.investmentId}#${entry.period}#${entry.generation}`;
      if (commissions.has(key)) {
        return "duplicate";
      }
      commissions.set(key, structuredClone(entry));
      return "created";
    },
    async listCommissions(recipientSub) {
      return [...commissions.values()]
        .filter((entry) => entry.recipientSub === recipientSub)
        .map((entry) => structuredClone(entry))
        .sort(
          (left, right) =>
            right.period.localeCompare(left.period) ||
            left.generation - right.generation ||
            left.investmentId.localeCompare(right.investmentId),
        );
    },
    async putWithdrawal(request: WithdrawalRequest) {
      const key = `${request.ownerSub}#${request.withdrawalId}`;
      if (withdrawals.has(key)) {
        return "duplicate";
      }
      withdrawals.set(key, structuredClone(request));
      return "created";
    },
    async listWithdrawals(ownerSub) {
      return [...withdrawals.values()]
        .filter((request) => request.ownerSub === ownerSub)
        .map((request) => structuredClone(request))
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) || left.withdrawalId.localeCompare(right.withdrawalId),
        );
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