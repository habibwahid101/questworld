import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMemoryInvestmentStore } from "../lib/investments/memory-store.ts";
import {
  handleInvestmentApi,
  identityFromClaims,
  investmentCatalog,
  investmentFromStoredItem,
  type InvestmentStore,
} from "../lib/investments/service.ts";

const NOW = "2026-10-02T12:00:00.000Z";

function claims(userId: string) {
  return { sub: userId, email: "other@example.com" };
}

function ids(prefix: string) {
  let count = 0;
  return () => {
    count += 1;
    return `inv_${prefix}-${String(count).padStart(12, "0")}`;
  };
}

function fixedId(investmentId: string) {
  return () => investmentId;
}

async function post(
  store: InvestmentStore,
  userId: string,
  body: unknown,
  idempotencyKey: string,
  newInvestmentId = ids("00000000-0000-4000-8000"),
) {
  return handleInvestmentApi({
    method: "POST",
    path: "/investments",
    claims: claims(userId),
    body,
    idempotencyKey,
    store,
    now: () => NOW,
    newInvestmentId,
  });
}

test("identity always comes from the JWT sub", () => {
  assert.equal(identityFromClaims(undefined), null);
  assert.equal(identityFromClaims({ email: "a@example.com" }), null);
  assert.deepEqual(identityFromClaims({ sub: " member-1 ", email: "nope@example.com" }), { userId: "member-1" });
});

test("an unknown plan is rejected and client overrides are rejected", async () => {
  const store = createMemoryInvestmentStore();
  const unknown = await post(store, "member-1", { planId: "custom" }, "idem-unknown-1");
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.body.error, "unknown_plan");

  const overridden = await post(
    store,
    "member-1",
    { planId: "starter", amountMinor: 1, ownerSub: "other", status: "active", currency: "USD" },
    "idem-override-1",
  );
  assert.equal(overridden.statusCode, 400);
  assert.equal(overridden.body.error, "invalid_body");
  assert.deepEqual(await store.listByOwner("member-1"), []);
});

test("the amount is the server catalog minor-unit value and the status is awaiting deposit", async () => {
  const store = createMemoryInvestmentStore();
  const created = await post(store, "member-1", { planId: "starter" }, "idem-starter-1", fixedId("inv_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"));
  assert.equal(created.statusCode, 200);
  const investment = created.body.investment as { amountMinor: number; currency: string; scale: number; status: string; ownerSub: string; planName: string };
  assert.equal(investment.amountMinor, investmentCatalog.starter.amountMinor);
  assert.equal(investment.amountMinor, 100_000_000);
  assert.equal(investment.currency, "USDT");
  assert.equal(investment.scale, 6);
  assert.equal(investment.status, "awaiting_deposit");
  assert.equal(investment.ownerSub, "member-1");
  assert.equal(investment.planName, "Starter");
  assert.equal("monthlyRate" in (created.body.investment as object), false);

  for (const planId of ["growth", "professional", "premium"] as const) {
    const response = await post(store, "member-1", { planId }, `idem-${planId}-1`);
    const record = response.body.investment as { amountMinor: number; status: string };
    assert.equal(record.amountMinor, investmentCatalog[planId].amountMinor);
    assert.equal(record.status, "awaiting_deposit");
  }
});

test("the same idempotency key returns the same investment", async () => {
  const store = createMemoryInvestmentStore();
  const first = await post(store, "member-1", { planId: "growth" }, "idem-same-key", fixedId("inv_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"));
  const second = await post(store, "member-1", { planId: "premium" }, "idem-same-key", fixedId("inv_cccccccc-cccc-4ccc-8ccc-ccccccccccc1"));
  const left = first.body.investment as { investmentId: string; planId: string };
  const right = second.body.investment as { investmentId: string; planId: string };
  assert.equal(left.investmentId, right.investmentId);
  assert.equal(right.planId, "growth");
  assert.equal((await store.listByOwner("member-1")).length, 1);
});

test("a different idempotency key can create another investment in the same plan", async () => {
  const store = createMemoryInvestmentStore();
  const first = await post(store, "member-1", { planId: "starter" }, "idem-plan-one");
  const second = await post(store, "member-1", { planId: "starter" }, "idem-plan-two");
  const left = first.body.investment as { investmentId: string };
  const right = second.body.investment as { investmentId: string };
  assert.notEqual(left.investmentId, right.investmentId);
  assert.equal((await store.listByOwner("member-1")).length, 2);
});

test("a list returns only the caller's investments and a foreign lookup is 404", async () => {
  const store = createMemoryInvestmentStore();
  const created = await post(store, "member-1", { planId: "professional" }, "idem-owner-1", fixedId("inv_dddddddd-dddd-4ddd-8ddd-ddddddddddd1"));
  const investmentId = (created.body.investment as { investmentId: string }).investmentId;
  await post(store, "member-2", { planId: "starter" }, "idem-owner-2");

  const list = await handleInvestmentApi({
    method: "GET",
    path: "/investments",
    claims: claims("member-2"),
    store,
  });
  const records = list.body.investments as Array<{ ownerSub: string }>;
  assert.equal(records.length, 1);
  assert.equal(records[0]?.ownerSub, "member-2");

  const foreign = await handleInvestmentApi({
    method: "GET",
    path: `/investments/${investmentId}`,
    claims: claims("member-2"),
    store,
  });
  assert.equal(foreign.statusCode, 404);

  const own = await handleInvestmentApi({
    method: "GET",
    path: `/investments/${investmentId}`,
    claims: claims("member-1"),
    store,
  });
  assert.equal(own.statusCode, 200);
});

test("stored statuses are returned as stored and an invalid status is not rewritten", () => {
  const base = {
    investmentId: "inv_ffffffff-ffff-4fff-8fff-fffffffffff1",
    ownerSub: "member-1",
    planId: "starter",
    planName: "Starter",
    amountMinor: 100_000_000,
    currency: "USDT",
    scale: 6,
    createdAt: NOW,
    updatedAt: NOW,
    statusChangedAt: NOW,
  };
  assert.equal(investmentFromStoredItem({ ...base, status: "pending_verification" }).status, "pending_verification");
  assert.equal(investmentFromStoredItem({ ...base, status: "active" }).status, "active");
  assert.throws(() => investmentFromStoredItem({ ...base, status: "cancelled" }), /not valid/);
  assert.throws(() => investmentFromStoredItem({ ...base, status: "awaiting_deposit " }), /not valid/);
});

test("no status transition endpoint exists", async () => {
  const store = createMemoryInvestmentStore();
  const created = await post(store, "member-1", { planId: "starter" }, "idem-transition-1", fixedId("inv_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"));
  const investmentId = (created.body.investment as { investmentId: string }).investmentId;
  const transition = await handleInvestmentApi({
    method: "POST",
    path: `/investments/${investmentId}/activate`,
    claims: claims("member-1"),
    body: { status: "active" },
    store,
  });
  const patch = await handleInvestmentApi({
    method: "PATCH",
    path: `/investments/${investmentId}`,
    claims: claims("member-1"),
    body: { status: "active" },
    store,
  });
  assert.equal(transition.statusCode, 404);
  assert.equal(patch.statusCode, 404);
  const saved = await store.getById("member-1", investmentId);
  assert.equal(saved?.status, "awaiting_deposit");
});

const OWNED_ID = "inv_11111111-1111-4111-8111-111111111111";
const ACTIVE_ID = "inv_22222222-2222-4222-8222-222222222222";
const SUBMITTED_AT = "2026-10-05T15:09:35.467Z";

function deposit(
  store: InvestmentStore,
  userId: string,
  investmentId: string,
  body: unknown,
  idempotencyKey = "deposit-key-1",
) {
  return handleInvestmentApi({
    method: "POST",
    path: `/investments/${investmentId}/deposit`,
    claims: claims(userId),
    body,
    idempotencyKey,
    store,
    now: () => SUBMITTED_AT,
  });
}

test("only the owner can submit one deposit reference for an awaiting-deposit investment", async () => {
  const store = createMemoryInvestmentStore();
  await post(store, "member-1", { planId: "starter" }, "idem-deposit-create", fixedId(OWNED_ID));

  const overridden = await deposit(store, "member-1", OWNED_ID, {
    reference: "TX123456",
    status: "active",
    ownerSub: "member-2",
    amountMinor: 1,
  });
  assert.equal(overridden.statusCode, 400);
  assert.equal((await store.getById("member-1", OWNED_ID))?.status, "awaiting_deposit");

  const foreign = await deposit(store, "member-2", OWNED_ID, { reference: "TX123456" }, "deposit-foreign");
  assert.equal(foreign.statusCode, 404);
  assert.equal((await store.getById("member-1", OWNED_ID))?.status, "awaiting_deposit");

  const submitted = await deposit(store, "member-1", OWNED_ID, { reference: " TX123456 " });
  assert.equal(submitted.statusCode, 200);
  const investment = submitted.body.investment as {
    status: string;
    depositReference: string;
    submittedAt: string;
    amountMinor: number;
    planId: string;
    ownerSub: string;
  };
  assert.equal(investment.status, "pending_verification");
  assert.equal(investment.depositReference, "TX123456");
  assert.equal(investment.submittedAt, SUBMITTED_AT);
  assert.equal(investment.amountMinor, 100_000_000);
  assert.equal(investment.planId, "starter");
  assert.equal(investment.ownerSub, "member-1");

  const duplicate = await deposit(store, "member-1", OWNED_ID, { reference: "TX999999" }, "deposit-key-2");
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.body.error, "deposit_not_allowed");
  assert.equal((await store.getById("member-1", OWNED_ID))?.depositReference, "TX123456");
});

test("the same deposit idempotency key returns the original submission", async () => {
  const store = createMemoryInvestmentStore();
  await post(store, "member-1", { planId: "starter" }, "idem-deposit-replay", fixedId(OWNED_ID));
  const first = await deposit(store, "member-1", OWNED_ID, { reference: "TX123456" }, "deposit-replay");
  const second = await deposit(store, "member-1", OWNED_ID, { reference: "TX999999" }, "deposit-replay");
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  const replay = second.body.investment as { depositReference: string; status: string };
  assert.equal(replay.depositReference, "TX123456");
  assert.equal(replay.status, "pending_verification");
  assert.equal((await store.listByOwner("member-1")).length, 1);
});

test("an investment that is not awaiting deposit cannot receive a reference", async () => {
  const store = createMemoryInvestmentStore([
    {
      investmentId: ACTIVE_ID,
      ownerSub: "member-1",
      planId: "starter",
      planName: "Starter",
      amountMinor: 100_000_000,
      currency: "USDT",
      scale: 6,
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
      statusChangedAt: NOW,
    },
  ]);
  const rejected = await deposit(store, "member-1", ACTIVE_ID, { reference: "TX123456" }, "deposit-active");
  assert.equal(rejected.statusCode, 409);
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.status, "active");
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.depositReference, undefined);
});

test("a body user id is ignored because a missing token is unauthorized", async () => {
  const store = createMemoryInvestmentStore();
  const response = await handleInvestmentApi({
    method: "POST",
    path: "/investments",
    body: { planId: "starter", sub: "member-1", ownerSub: "member-1" },
    idempotencyKey: "idem-no-token",
    store,
  });
  assert.equal(response.statusCode, 401);
});

test("the investment Lambda policy does not include the members table", () => {
  const source = readFileSync(new URL("../infrastructure/lib/api-stack.ts", import.meta.url), "utf8");
  const investmentPolicy = source.slice(source.indexOf("investmentsFn.addToRolePolicy"));
  assert.match(investmentPolicy, /dynamodb:GetItem/);
  assert.match(investmentPolicy, /dynamodb:PutItem/);
  assert.match(investmentPolicy, /dynamodb:Query/);
  assert.match(investmentPolicy, /dynamodb:UpdateItem/);
  assert.match(investmentPolicy, /resources: \[investmentsTable\.tableArn\]/);
  assert.doesNotMatch(investmentPolicy, /resources: \[table\.tableArn\]/);
  assert.doesNotMatch(investmentPolicy, /questworld-members/);
  assert.doesNotMatch(investmentPolicy, /dynamodb:\*/);
  assert.doesNotMatch(investmentPolicy, /dynamodb:Scan/);
  assert.doesNotMatch(investmentPolicy, /dynamodb:DeleteItem/);
});
