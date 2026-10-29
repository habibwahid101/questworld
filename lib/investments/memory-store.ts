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
  CycleAdvance,
  CycleAdvanceResult,
  DepositAddress,
  WithdrawalRequest,
  WithdrawalReview,
  WithdrawalReviewResult,
} from "./service.ts";
import { addReturnCycle } from "./service.ts";

export function createMemoryInvestmentStore(seed: readonly InvestmentRecord[] = []): InvestmentStore {
  const investments = new Map<string, InvestmentRecord>();
  const profits = new Map<string, ProfitEntry>();
  const commissions = new Map<string, CommissionEntry>();
  const withdrawals = new Map<string, WithdrawalRequest>();
  const idempotency = new Map<string, string>();
  let depositAddress: DepositAddress | null = null;
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
    async listAllInvestments() {
      return [...investments.values()]
        .map((record) => structuredClone(record))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.investmentId.localeCompare(right.investmentId));
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
      const confirming = review.decision === "deposit_verified";
      const record: InvestmentRecord = {
        ...current,
        status: confirming ? "active" : review.decision,
        reviewedAt: review.reviewedAt,
        reviewedBy: review.reviewedBy,
        updatedAt: review.reviewedAt,
        statusChangedAt: review.reviewedAt,
      };
      if (confirming) {
        record.activatedAt = review.reviewedAt;
        record.activatedBy = review.reviewedBy;
        record.nextDueAt = addReturnCycle(review.reviewedAt);
        record.paymentsPosted = 0;
      }
      if (review.decision === "rejected" && review.rejectionReason) {
        record.rejectionReason = review.rejectionReason;
      } else {
        delete record.rejectionReason;
      }
      investments.set(itemKey, record);
      return { result: "reviewed", record: structuredClone(record) };
    },
    async findByInvestmentId(investmentId) {
      const matches = [...investments.values()].filter((record) => record.investmentId === investmentId);
      return matches.length === 1 ? structuredClone(matches[0]) : null;
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
        nextDueAt: addReturnCycle(activation.activatedAt),
        paymentsPosted: 0,
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
    async advanceCycle(advance: CycleAdvance): Promise<CycleAdvanceResult> {
      const found = [...investments.entries()].find(([, record]) => record.ownerSub === advance.ownerSub && record.investmentId === advance.investmentId);
      if (!found) {
        return "conflict";
      }
      const [itemKey, current] = found;
      if (current.status !== "active" || current.nextDueAt !== advance.dueAt || (current.paymentsPosted ?? 0) + 1 !== advance.paymentNumber) {
        return "conflict";
      }
      if (advance.paymentNumber === 12) {
        const completed: InvestmentRecord = {
          ...current,
          status: "completed",
          paymentsPosted: 12,
          updatedAt: advance.postedAt,
          statusChangedAt: advance.postedAt,
        };
        delete completed.nextDueAt;
        investments.set(itemKey, completed);
        return "completed";
      }
      investments.set(itemKey, {
        ...current,
        paymentsPosted: advance.paymentNumber,
        nextDueAt: addReturnCycle(advance.dueAt),
        updatedAt: advance.postedAt,
      });
      return "advanced";
    },
    async putProfit(entry: ProfitEntry) {
      const key = `${entry.ownerSub}#${entry.investmentId}#${entry.paymentNumber}`;
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
    async listAllProfits() {
      return [...profits.values()]
        .map((entry) => structuredClone(entry))
        .sort((left, right) => right.period.localeCompare(left.period) || left.investmentId.localeCompare(right.investmentId));
    },
    async putCommission(entry: CommissionEntry) {
      const key = `${entry.recipientSub}#${entry.investmentId}#${entry.paymentNumber}#${entry.generation}`;
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
    async listAllCommissions() {
      return [...commissions.values()]
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
    async listAllWithdrawals() {
      return [...withdrawals.values()]
        .map((request) => structuredClone(request))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.withdrawalId.localeCompare(right.withdrawalId));
    },
    async reviewWithdrawal(review: WithdrawalReview): Promise<WithdrawalReviewResult> {
      const found = [...withdrawals.entries()].find(([, request]) => request.withdrawalId === review.withdrawalId);
      if (!found) {
        return { result: "not-found" };
      }
      const [key, current] = found;
      if (current.status !== "pending_review") {
        return { result: "rejected" };
      }
      const request: WithdrawalRequest = {
        ...current,
        status: review.decision,
        updatedAt: review.reviewedAt,
        reviewedAt: review.reviewedAt,
        reviewedBy: review.reviewedBy,
      };
      withdrawals.set(key, request);
      return { result: "reviewed", request: structuredClone(request) };
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
    async getDepositAddress() {
      return depositAddress ? structuredClone(depositAddress) : null;
    },
    async saveDepositAddress(record) {
      depositAddress = structuredClone(record);
    },
  };
}