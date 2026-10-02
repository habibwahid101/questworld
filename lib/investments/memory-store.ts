import type { CreateInvestmentResult, InvestmentRecord, InvestmentStore } from "./service.ts";

export function createMemoryInvestmentStore(): InvestmentStore {
  const investments = new Map<string, InvestmentRecord>();
  const idempotency = new Map<string, string>();

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
