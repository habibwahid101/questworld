/**
 * Investment records.
 * Cognito `sub` is the owner. The client cannot choose it, the amount, or the status.
 * Creating a record does not take payment. Submitting a deposit reference only marks
 * that owned awaiting-deposit record as pending verification.
 * An admin review can only mark that pending record as deposit verified or rejected.
 * An admin activation can only mark that verified record as active.
 * A scheduled job can append one 8 percent profit entry for an active investment.
 * That entry does not change the investment amount or status.
 */

export const INVESTMENT_CURRENCY = "USDT";
export const INVESTMENT_SCALE = 6;
export const CREATABLE_INVESTMENT_STATUS = "awaiting_deposit";
export const MONTHLY_PROFIT_RATE_BPS = 800;

const MICRO_USDT = 1_000_000;
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const investmentCatalog = {
  starter: { planId: "starter", planName: "Starter", amountMinor: 100 * MICRO_USDT },
  growth: { planId: "growth", planName: "Growth", amountMinor: 1_000 * MICRO_USDT },
  professional: { planId: "professional", planName: "Professional", amountMinor: 10_000 * MICRO_USDT },
  premium: { planId: "premium", planName: "Premium", amountMinor: 100_000 * MICRO_USDT },
} as const;

export type PlanId = keyof typeof investmentCatalog;
export type InvestmentStatus = "awaiting_deposit" | "pending_verification" | "deposit_verified" | "rejected" | "active";
export const REVIEW_DECISIONS = ["deposit_verified", "rejected"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export type InvestmentRecord = {
  investmentId: string;
  ownerSub: string;
  planId: PlanId;
  planName: string;
  amountMinor: number;
  currency: typeof INVESTMENT_CURRENCY;
  scale: typeof INVESTMENT_SCALE;
  status: InvestmentStatus;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string;
  depositReference?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  activatedAt?: string;
  activatedBy?: string;
};

export type InvestmentIdentity = {
  userId: string;
};

export type ProfitEntry = {
  investmentId: string;
  ownerSub: string;
  period: string;
  rateBps: typeof MONTHLY_PROFIT_RATE_BPS;
  profitMinor: number;
  principalMinor: number;
  currency: typeof INVESTMENT_CURRENCY;
  scale: typeof INVESTMENT_SCALE;
  planId: PlanId;
  planName: string;
  postedAt: string;
};

export type ProfitPostResult = { result: "posted"; entry: ProfitEntry } | { result: "duplicate" } | { result: "skipped" };

export type CreateInvestmentResult =
  | { result: "created" }
  | { result: "exists"; investmentId: string }
  | { result: "id-taken" };

export type DepositSubmission = {
  ownerSub: string;
  investmentId: string;
  depositReference: string;
  submittedAt: string;
  idempotencyKey: string;
};

export type DepositSubmissionResult = { result: "submitted" } | { result: "exists" } | { result: "not-found" } | { result: "rejected" };

export type DepositReview = {
  investmentId: string;
  decision: ReviewDecision;
  reviewedAt: string;
  reviewedBy: string;
};

export type DepositReviewResult =
  | { result: "reviewed"; record: InvestmentRecord }
  | { result: "not-found" }
  | { result: "rejected" };

export type InvestmentActivation = {
  investmentId: string;
  activatedAt: string;
  activatedBy: string;
};

export type InvestmentActivationResult =
  | { result: "activated"; record: InvestmentRecord }
  | { result: "not-found" }
  | { result: "rejected" };

export type InvestmentStore = {
  create(record: InvestmentRecord, idempotencyKey: string): Promise<CreateInvestmentResult>;
  submitDeposit(submission: DepositSubmission): Promise<DepositSubmissionResult>;
  listPendingDeposits(): Promise<InvestmentRecord[]>;
  listVerifiedDeposits(): Promise<InvestmentRecord[]>;
  reviewDeposit(review: DepositReview): Promise<DepositReviewResult>;
  activateInvestment(activation: InvestmentActivation): Promise<InvestmentActivationResult>;
  listActiveInvestments(): Promise<InvestmentRecord[]>;
  putProfit(entry: ProfitEntry): Promise<"created" | "duplicate">;
  listProfits(ownerSub: string): Promise<ProfitEntry[]>;
  getById(ownerSub: string, investmentId: string): Promise<InvestmentRecord | null>;
  listByOwner(ownerSub: string): Promise<InvestmentRecord[]>;
};

export class InvestmentRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "InvestmentRequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const INVESTMENT_ID_PATTERN =
  /^inv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DEPOSIT_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{3,119}$/;

export function readStoredInvestmentStatus(value: unknown): InvestmentStatus {
  if (
    value === "awaiting_deposit" ||
    value === "pending_verification" ||
    value === "deposit_verified" ||
    value === "rejected" ||
    value === "active"
  ) {
    return value;
  }
  throw new InvestmentRequestError(500, "invalid_stored_status", "That investment record is not valid.");
}

export function investmentFromStoredItem(item: Record<string, unknown>): InvestmentRecord {
  return {
    investmentId: String(item.investmentId),
    ownerSub: String(item.ownerSub),
    planId: item.planId as InvestmentRecord["planId"],
    planName: String(item.planName),
    amountMinor: Number(item.amountMinor),
    currency: INVESTMENT_CURRENCY,
    scale: INVESTMENT_SCALE,
    status: readStoredInvestmentStatus(item.status),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
    statusChangedAt: String(item.statusChangedAt),
    ...storedDepositFields(item),
    ...storedReviewFields(item),
    ...storedActivationFields(item),
  };
}

export function identityFromClaims(
  claims: Record<string, unknown> | undefined,
): InvestmentIdentity | null {
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  return userId ? { userId } : null;
}

const ADMIN_GROUP = "Admins";

export function isAdminClaims(claims: Record<string, unknown> | undefined): boolean {
  return adminGroups(claims?.["cognito:groups"]).includes(ADMIN_GROUP);
}

function adminGroups(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => adminGroups(entry));
  }
  if (typeof value !== "string") {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return adminGroups(parsed);
      }
    } catch {
      // The HTTP API JWT authorizer sends one group as "[Admins]", which is not JSON.
    }
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
      .filter((entry) => entry.length > 0);
  }
  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function createInvestmentId(random: () => string = () => crypto.randomUUID()): string {
  return `inv_${random()}`;
}

export function formatUsdtAmount(amountMinor: number, scale = INVESTMENT_SCALE): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    return "USDT";
  }
  const factor = 10 ** scale;
  const whole = Math.trunc(amountMinor / factor);
  const fraction = amountMinor % factor;
  const wholeText = whole.toLocaleString("en-US");
  if (fraction === 0) {
    return `${wholeText} USDT`;
  }
  const fractionText = String(fraction).padStart(scale, "0").replace(/0+$/, "");
  return `${wholeText}.${fractionText} USDT`;
}

export function monthlyProfitMinor(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new InvestmentRequestError(500, "invalid_profit_amount", "That investment amount cannot earn profit.");
  }
  const profitMinor = Math.floor((amountMinor * MONTHLY_PROFIT_RATE_BPS) / 10_000);
  if (!Number.isSafeInteger(profitMinor) || profitMinor < 0) {
    throw new InvestmentRequestError(500, "invalid_profit_amount", "That investment amount cannot earn profit.");
  }
  return profitMinor;
}

export function previousUtcMonth(isoTime: string): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    throw new InvestmentRequestError(500, "invalid_profit_period", "The profit period is not valid.");
  }
  const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function postProfitForInvestment(input: {
  record: InvestmentRecord;
  period: string;
  postedAt: string;
  store: InvestmentStore;
}): Promise<ProfitPostResult> {
  assertProfitPeriod(input.period);
  if (input.record.status !== "active") {
    return { result: "skipped" };
  }
  const entry: ProfitEntry = {
    investmentId: input.record.investmentId,
    ownerSub: input.record.ownerSub,
    period: input.period,
    rateBps: MONTHLY_PROFIT_RATE_BPS,
    profitMinor: monthlyProfitMinor(input.record.amountMinor),
    principalMinor: input.record.amountMinor,
    currency: INVESTMENT_CURRENCY,
    scale: INVESTMENT_SCALE,
    planId: input.record.planId,
    planName: input.record.planName,
    postedAt: input.postedAt,
  };
  const saved = await input.store.putProfit(entry);
  if (saved === "duplicate") {
    return { result: "duplicate" };
  }
  return { result: "posted", entry };
}

export async function postMonthlyProfits(input: {
  store: InvestmentStore;
  period: string;
  postedAt: string;
}): Promise<{ posted: number; duplicate: number; skipped: number }> {
  assertProfitPeriod(input.period);
  const active = await input.store.listActiveInvestments();
  const summary = { posted: 0, duplicate: 0, skipped: 0 };
  for (const record of active) {
    const outcome = await postProfitForInvestment({
      record,
      period: input.period,
      postedAt: input.postedAt,
      store: input.store,
    });
    summary[outcome.result === "posted" ? "posted" : outcome.result === "duplicate" ? "duplicate" : "skipped"] += 1;
  }
  return summary;
}

export function profitFromStoredItem(item: Record<string, unknown>): ProfitEntry {
  const period = typeof item.period === "string" ? item.period : "";
  assertProfitPeriod(period);
  if (item.rateBps !== MONTHLY_PROFIT_RATE_BPS) {
    throw new InvestmentRequestError(500, "invalid_stored_profit", "That profit record is not valid.");
  }
  const principalMinor = Number(item.principalMinor);
  const profitMinor = Number(item.profitMinor);
  if (profitMinor !== monthlyProfitMinor(principalMinor)) {
    throw new InvestmentRequestError(500, "invalid_stored_profit", "That profit record is not valid.");
  }
  const planId = item.planId as PlanId;
  if (!investmentCatalog[planId] || item.currency !== INVESTMENT_CURRENCY || item.scale !== INVESTMENT_SCALE) {
    throw new InvestmentRequestError(500, "invalid_stored_profit", "That profit record is not valid.");
  }
  if (typeof item.investmentId !== "string" || typeof item.ownerSub !== "string" || typeof item.postedAt !== "string") {
    throw new InvestmentRequestError(500, "invalid_stored_profit", "That profit record is not valid.");
  }
  return {
    investmentId: item.investmentId,
    ownerSub: item.ownerSub,
    period,
    rateBps: MONTHLY_PROFIT_RATE_BPS,
    profitMinor,
    principalMinor,
    currency: INVESTMENT_CURRENCY,
    scale: INVESTMENT_SCALE,
    planId,
    planName: String(item.planName),
    postedAt: item.postedAt,
  };
}

function assertProfitPeriod(period: string): void {
  if (!PERIOD_PATTERN.test(period)) {
    throw new InvestmentRequestError(500, "invalid_profit_period", "The profit period is not valid.");
  }
}

export async function handleInvestmentApi(input: {
  method: string;
  path: string;
  claims?: Record<string, unknown>;
  body?: unknown;
  idempotencyKey?: string;
  store: InvestmentStore;
  now?: () => string;
  newInvestmentId?: () => string;
}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const identity = identityFromClaims(input.claims);
  if (!identity) {
    return errorBody(401, "unauthorized", "Sign in to continue.");
  }

  const method = input.method.toUpperCase();
  const path = normalizePath(input.path);
  const now = input.now ?? (() => new Date().toISOString());
  const newInvestmentId = input.newInvestmentId ?? createInvestmentId;

  try {
    if (method === "GET" && path === "/profits") {
      const profits = await input.store.listProfits(identity.userId);
      return { statusCode: 200, body: { profits } };
    }
    if (path === "/admin/deposits" || path.startsWith("/admin/deposits/")) {
      if (!isAdminClaims(input.claims)) {
        return errorBody(403, "forbidden", "Admin access is required.");
      }
      if (method === "GET" && path === "/admin/deposits") {
        const [investments, verified] = await Promise.all([
          input.store.listPendingDeposits(),
          input.store.listVerifiedDeposits(),
        ]);
        return { statusCode: 200, body: { investments, verified } };
      }
      const reviewInvestmentId = reviewIdFromPath(path);
      if (method === "POST" && reviewInvestmentId) {
        const record = await reviewDeposit({
          investmentId: reviewInvestmentId,
          body: input.body,
          reviewedBy: identity.userId,
          store: input.store,
          now,
        });
        return { statusCode: 200, body: { investment: record } };
      }
      const activationInvestmentId = activationIdFromPath(path);
      if (method === "POST" && activationInvestmentId) {
        const record = await activateInvestment({
          investmentId: activationInvestmentId,
          body: input.body,
          activatedBy: identity.userId,
          store: input.store,
          now,
        });
        return { statusCode: 200, body: { investment: record } };
      }
      return errorBody(404, "not_found", "That investment request does not exist.");
    }

    if (method === "POST" && path === "/investments") {
      const record = await createInvestment({
        ownerSub: identity.userId,
        body: input.body,
        idempotencyKey: input.idempotencyKey,
        store: input.store,
        now,
        newInvestmentId,
      });
      return { statusCode: 200, body: { investment: record } };
    }

    if (method === "GET" && path === "/investments") {
      const investments = await input.store.listByOwner(identity.userId);
      return { statusCode: 200, body: { investments } };
    }

    const investmentId = investmentIdFromPath(path);
    if (method === "GET" && investmentId) {
      const record = await input.store.getById(identity.userId, investmentId);
      if (!record) {
        return errorBody(404, "investment_not_found", "That investment was not found.");
      }
      return { statusCode: 200, body: { investment: record } };
    }

    const depositInvestmentId = depositIdFromPath(path);
    if (method === "POST" && depositInvestmentId) {
      const record = await submitDeposit({
        ownerSub: identity.userId,
        investmentId: depositInvestmentId,
        body: input.body,
        idempotencyKey: input.idempotencyKey,
        store: input.store,
        now,
      });
      return { statusCode: 200, body: { investment: record } };
    }

    return errorBody(404, "not_found", "That investment request does not exist.");
  } catch (caught) {
    if (caught instanceof InvestmentRequestError) {
      return errorBody(caught.statusCode, caught.code, caught.message);
    }
    return errorBody(500, "investment_request_failed", "Could not complete that investment request.");
  }
}

async function createInvestment(input: {
  ownerSub: string;
  body: unknown;
  idempotencyKey: string | undefined;
  store: InvestmentStore;
  now: () => string;
  newInvestmentId: () => string;
}): Promise<InvestmentRecord> {
  const plan = planFromBody(input.body);
  const idempotencyKey = readIdempotencyKey(input.idempotencyKey);
  const timestamp = input.now();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const investmentId = input.newInvestmentId();
    if (!INVESTMENT_ID_PATTERN.test(investmentId)) {
      throw new InvestmentRequestError(500, "id_generation_failed", "Could not create an investment.");
    }
    const record: InvestmentRecord = {
      investmentId,
      ownerSub: input.ownerSub,
      planId: plan.planId,
      planName: plan.planName,
      amountMinor: plan.amountMinor,
      currency: INVESTMENT_CURRENCY,
      scale: INVESTMENT_SCALE,
      status: CREATABLE_INVESTMENT_STATUS,
      createdAt: timestamp,
      updatedAt: timestamp,
      statusChangedAt: timestamp,
    };
    const outcome = await input.store.create(record, idempotencyKey);
    if (outcome.result === "created") {
      return record;
    }
    if (outcome.result === "exists") {
      const existing = await input.store.getById(input.ownerSub, outcome.investmentId);
      if (!existing || existing.ownerSub !== input.ownerSub) {
        throw new InvestmentRequestError(500, "idempotency_failed", "Could not reuse that investment request.");
      }
      return existing;
    }
  }

  throw new InvestmentRequestError(500, "id_generation_failed", "Could not create an investment.");
}

async function submitDeposit(input: {
  ownerSub: string;
  investmentId: string;
  body: unknown;
  idempotencyKey: string | undefined;
  store: InvestmentStore;
  now: () => string;
}): Promise<InvestmentRecord> {
  const depositReference = referenceFromBody(input.body);
  const idempotencyKey = readIdempotencyKey(input.idempotencyKey);
  const outcome = await input.store.submitDeposit({
    ownerSub: input.ownerSub,
    investmentId: input.investmentId,
    depositReference,
    submittedAt: input.now(),
    idempotencyKey,
  });
  if (outcome.result === "not-found") {
    throw new InvestmentRequestError(404, "investment_not_found", "That investment was not found.");
  }
  if (outcome.result === "rejected") {
    throw new InvestmentRequestError(409, "deposit_not_allowed", "This investment is not awaiting a deposit reference.");
  }
  const saved = await input.store.getById(input.ownerSub, input.investmentId);
  if (!saved || saved.ownerSub !== input.ownerSub || saved.status !== "pending_verification") {
    throw new InvestmentRequestError(500, "deposit_failed", "Could not save that deposit reference.");
  }
  return saved;
}

async function reviewDeposit(input: {
  investmentId: string;
  body: unknown;
  reviewedBy: string;
  store: InvestmentStore;
  now: () => string;
}): Promise<InvestmentRecord> {
  const decision = decisionFromBody(input.body);
  const outcome = await input.store.reviewDeposit({
    investmentId: input.investmentId,
    decision,
    reviewedAt: input.now(),
    reviewedBy: input.reviewedBy,
  });
  if (outcome.result === "not-found") {
    throw new InvestmentRequestError(404, "investment_not_found", "That investment was not found.");
  }
  if (outcome.result === "rejected") {
    throw new InvestmentRequestError(409, "review_not_allowed", "Only a pending deposit can be reviewed.");
  }
  const saved = outcome.record;
  if (saved.status !== decision || saved.reviewedBy !== input.reviewedBy || saved.ownerSub.length === 0) {
    throw new InvestmentRequestError(500, "review_failed", "Could not save that review.");
  }
  return saved;
}

async function activateInvestment(input: {
  investmentId: string;
  body: unknown;
  activatedBy: string;
  store: InvestmentStore;
  now: () => string;
}): Promise<InvestmentRecord> {
  assertNoActivationOverrides(input.body);
  const outcome = await input.store.activateInvestment({
    investmentId: input.investmentId,
    activatedAt: input.now(),
    activatedBy: input.activatedBy,
  });
  if (outcome.result === "not-found") {
    throw new InvestmentRequestError(404, "investment_not_found", "That investment was not found.");
  }
  if (outcome.result === "rejected") {
    throw new InvestmentRequestError(409, "activation_not_allowed", "Only a verified deposit can be activated.");
  }
  const saved = outcome.record;
  if (saved.status !== "active" || saved.activatedBy !== input.activatedBy || saved.ownerSub.length === 0) {
    throw new InvestmentRequestError(500, "activation_failed", "Could not activate that investment.");
  }
  return saved;
}

function assertNoActivationOverrides(body: unknown): void {
  if (body === undefined || body === null) {
    return;
  }
  if (typeof body !== "object" || Array.isArray(body) || Object.keys(body).length > 0) {
    throw new InvestmentRequestError(400, "invalid_body", "The server chooses the activation.");
  }
}

function decisionFromBody(body: unknown): ReviewDecision {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InvestmentRequestError(400, "invalid_body", "Choose verify or reject.");
  }
  const source = body as Record<string, unknown>;
  const extra = Object.keys(source).filter((key) => key !== "decision");
  if (extra.length > 0) {
    throw new InvestmentRequestError(400, "invalid_body", "Only the review decision can be submitted.");
  }
  if (source.decision !== "deposit_verified" && source.decision !== "rejected") {
    throw new InvestmentRequestError(400, "invalid_decision", "Choose verify or reject.");
  }
  return source.decision;
}

function referenceFromBody(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InvestmentRequestError(400, "invalid_body", "Enter the deposit reference.");
  }
  const source = body as Record<string, unknown>;
  const extra = Object.keys(source).filter((key) => key !== "reference");
  if (extra.length > 0) {
    throw new InvestmentRequestError(400, "invalid_body", "Only the deposit reference can be submitted.");
  }
  if (typeof source.reference !== "string" || !DEPOSIT_REFERENCE_PATTERN.test(source.reference.trim())) {
    throw new InvestmentRequestError(400, "invalid_reference", "Enter the deposit reference from your transfer.");
  }
  return source.reference.trim();
}

function planFromBody(body: unknown): (typeof investmentCatalog)[PlanId] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InvestmentRequestError(400, "invalid_body", "Choose a plan.");
  }
  const source = body as Record<string, unknown>;
  const extra = Object.keys(source).filter((key) => key !== "planId");
  if (extra.length > 0) {
    throw new InvestmentRequestError(400, "invalid_body", "Only a plan can be submitted.");
  }
  if (typeof source.planId !== "string" || !(source.planId in investmentCatalog)) {
    throw new InvestmentRequestError(400, "unknown_plan", "Choose one of the listed plans.");
  }
  return investmentCatalog[source.planId as PlanId];
}

function readIdempotencyKey(value: string | undefined): string {
  const key = value?.trim() ?? "";
  if (!IDEMPOTENCY_PATTERN.test(key)) {
    throw new InvestmentRequestError(
      400,
      "invalid_idempotency_key",
      "Submit the investment again from the investments page.",
    );
  }
  return key;
}

function reviewIdFromPath(path: string): string | null {
  const match = path.match(/^\/admin\/deposits\/([^/]+)\/review$/);
  if (!match?.[1] || !INVESTMENT_ID_PATTERN.test(match[1])) {
    return null;
  }
  return match[1];
}

function activationIdFromPath(path: string): string | null {
  const match = path.match(/^\/admin\/deposits\/([^/]+)\/activate$/);
  if (!match?.[1] || !INVESTMENT_ID_PATTERN.test(match[1])) {
    return null;
  }
  return match[1];
}

function storedActivationFields(item: Record<string, unknown>): Pick<InvestmentRecord, "activatedAt" | "activatedBy"> {
  const fields: Pick<InvestmentRecord, "activatedAt" | "activatedBy"> = {};
  if (item.activatedAt !== undefined) {
    if (typeof item.activatedAt !== "string" || item.activatedAt.trim() === "") {
      throw new InvestmentRequestError(500, "invalid_stored_activation", "That investment record is not valid.");
    }
    fields.activatedAt = item.activatedAt;
  }
  if (item.activatedBy !== undefined) {
    if (typeof item.activatedBy !== "string" || item.activatedBy.trim() === "") {
      throw new InvestmentRequestError(500, "invalid_stored_activation", "That investment record is not valid.");
    }
    fields.activatedBy = item.activatedBy;
  }
  return fields;
}

function storedReviewFields(item: Record<string, unknown>): Pick<InvestmentRecord, "reviewedAt" | "reviewedBy"> {
  const fields: Pick<InvestmentRecord, "reviewedAt" | "reviewedBy"> = {};
  if (item.reviewedAt !== undefined) {
    if (typeof item.reviewedAt !== "string" || item.reviewedAt.trim() === "") {
      throw new InvestmentRequestError(500, "invalid_stored_review", "That investment record is not valid.");
    }
    fields.reviewedAt = item.reviewedAt;
  }
  if (item.reviewedBy !== undefined) {
    if (typeof item.reviewedBy !== "string" || item.reviewedBy.trim() === "") {
      throw new InvestmentRequestError(500, "invalid_stored_review", "That investment record is not valid.");
    }
    fields.reviewedBy = item.reviewedBy;
  }
  return fields;
}

function depositIdFromPath(path: string): string | null {
  const match = path.match(/^\/investments\/([^/]+)\/deposit$/);
  if (!match?.[1] || !INVESTMENT_ID_PATTERN.test(match[1])) {
    return null;
  }
  return match[1];
}

function storedDepositFields(item: Record<string, unknown>): Pick<InvestmentRecord, "depositReference" | "submittedAt"> {
  const fields: Pick<InvestmentRecord, "depositReference" | "submittedAt"> = {};
  if (item.depositReference !== undefined) {
    if (typeof item.depositReference !== "string" || item.depositReference.trim() === "") {
      throw new InvestmentRequestError(500, "invalid_stored_deposit", "That investment record is not valid.");
    }
    fields.depositReference = item.depositReference;
  }
  if (item.submittedAt !== undefined) {
    if (typeof item.submittedAt !== "string" || item.submittedAt.trim() === "") {
      throw new InvestmentRequestError(500, "invalid_stored_deposit", "That investment record is not valid.");
    }
    fields.submittedAt = item.submittedAt;
  }
  return fields;
}

function investmentIdFromPath(path: string): string | null {
  const match = path.match(/^\/investments\/([^/]+)$/);
  if (!match?.[1] || !INVESTMENT_ID_PATTERN.test(match[1])) {
    return null;
  }
  return match[1];
}

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "/";
  const trimmed = withoutQuery.replace(/\/+$/, "");
  return trimmed || "/";
}

function errorBody(statusCode: number, code: string, message: string): {
  statusCode: number;
  body: Record<string, unknown>;
} {
  return { statusCode, body: { error: code, message } };
}
