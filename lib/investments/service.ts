/**
 * Investment records for Step 05.
 * Cognito `sub` is the owner. The client cannot choose it, the amount, or the status.
 * Creating a record does not take payment or activate the investment.
 */

export const INVESTMENT_CURRENCY = "USDT";
export const INVESTMENT_SCALE = 6;
export const CREATABLE_INVESTMENT_STATUS = "awaiting_deposit";

const MICRO_USDT = 1_000_000;

export const investmentCatalog = {
  starter: { planId: "starter", planName: "Starter", amountMinor: 100 * MICRO_USDT },
  growth: { planId: "growth", planName: "Growth", amountMinor: 1_000 * MICRO_USDT },
  professional: { planId: "professional", planName: "Professional", amountMinor: 10_000 * MICRO_USDT },
  premium: { planId: "premium", planName: "Premium", amountMinor: 100_000 * MICRO_USDT },
} as const;

export type PlanId = keyof typeof investmentCatalog;
export type InvestmentStatus = "awaiting_deposit" | "pending_verification" | "active";

export type InvestmentRecord = {
  investmentId: string;
  ownerSub: string;
  planId: PlanId;
  planName: string;
  amountMinor: number;
  currency: typeof INVESTMENT_CURRENCY;
  scale: typeof INVESTMENT_SCALE;
  status: typeof CREATABLE_INVESTMENT_STATUS;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string;
};

export type InvestmentIdentity = {
  userId: string;
};

export type CreateInvestmentResult =
  | { result: "created" }
  | { result: "exists"; investmentId: string }
  | { result: "id-taken" };

export type InvestmentStore = {
  create(record: InvestmentRecord, idempotencyKey: string): Promise<CreateInvestmentResult>;
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

export function identityFromClaims(
  claims: Record<string, unknown> | undefined,
): InvestmentIdentity | null {
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  return userId ? { userId } : null;
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
