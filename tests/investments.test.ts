import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMemoryInvestmentStore } from "../lib/investments/memory-store.ts";
import {
  handleInvestmentApi,
  identityFromClaims,
  investmentCatalog,
  investmentFromStoredItem,
  isAdminClaims,
  postCommissionsForInvestment,
  postProfitForInvestment,
  previousUtcMonth,
  type InvestmentRecord,
  type InvestmentStore,
  type DepositProofStore,
  type ProfitEntry,
  type SponsorDirectory,
  type WithdrawalRequest,
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
  proofStore?: DepositProofStore,
) {
  return handleInvestmentApi({
    method: "POST",
    path: `/investments/${investmentId}/deposit`,
    claims: claims(userId),
    body,
    idempotencyKey,
    store,
    proofStore,
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

test("a deposit screenshot is stored privately and a missing one is allowed", async () => {
  const store = createMemoryInvestmentStore();
  await post(store, "member-1", { planId: "starter" }, "idem-proof-create", fixedId(OWNED_ID));
  const saved: string[] = [];
  const proofStore: DepositProofStore = {
    async put(input) {
      saved.push(`${input.ownerSub}/${input.investmentId}/${input.proof.contentType}/${input.proof.bytes.byteLength}`);
      return `deposit-proofs/${input.ownerSub}/${input.investmentId}/proof`;
    },
  };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
  const withProof = await deposit(
    store,
    "member-1",
    OWNED_ID,
    { reference: "TX123456", screenshot: { contentType: "image/png", dataBase64: png } },
    "deposit-proof",
    proofStore,
  );
  assert.equal(withProof.statusCode, 200);
  assert.equal((withProof.body.investment as { status: string }).status, "pending_verification");
  assert.equal((await store.getById("member-1", OWNED_ID))?.depositProofKey, "deposit-proofs/member-1/" + OWNED_ID + "/proof");
  assert.equal(saved.length, 1);

  await post(store, "member-1", { planId: "growth" }, "idem-proof-plain", fixedId(ACTIVE_ID));
  const plain = await deposit(store, "member-1", ACTIVE_ID, { reference: "TX654321" }, "deposit-plain");
  assert.equal(plain.statusCode, 200);
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.depositProofKey, undefined);
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.status, "pending_verification");

  const rejectedAddress = await deposit(store, "member-1", ACTIVE_ID, { reference: "TX654321", address: "invented" }, "deposit-address");
  assert.equal(rejectedAddress.statusCode, 400);
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.status, "pending_verification");
});

const PENDING_ID = "inv_33333333-3333-4333-8333-333333333333";
const REVIEWED_AT = "2026-10-06T06:00:00.000Z";

function pendingItem(investmentId: string, ownerSub: string, status: "pending_verification" | "awaiting_deposit" = "pending_verification") {
  return {
    investmentId,
    ownerSub,
    planId: "starter" as const,
    planName: "Starter",
    amountMinor: 100_000_000,
    currency: "USDT" as const,
    scale: 6 as const,
    status,
    createdAt: NOW,
    updatedAt: NOW,
    statusChangedAt: NOW,
    depositReference: "TX123456",
    submittedAt: "2026-10-05T15:09:35.467Z",
  };
}

function review(
  store: InvestmentStore,
  userId: string,
  investmentId: string,
  body: unknown,
  groups?: unknown,
) {
  return handleInvestmentApi({
    method: "POST",
    path: `/admin/deposits/${investmentId}/review`,
    claims: groups === undefined ? claims(userId) : { sub: userId, "cognito:groups": groups },
    body,
    store,
    now: () => REVIEWED_AT,
  });
}

test("only an admin can list and review a pending deposit", async () => {
  const store = createMemoryInvestmentStore([
    pendingItem(PENDING_ID, "member-1"),
    pendingItem(ACTIVE_ID, "member-2", "awaiting_deposit"),
  ]);

  const memberList = await handleInvestmentApi({
    method: "GET",
    path: "/admin/deposits",
    claims: claims("member-1"),
    store,
  });
  const memberReview = await review(store, "member-1", PENDING_ID, { decision: "deposit_verified" });
  const otherGroup = await review(store, "member-9", PENDING_ID, { decision: "rejected" }, ["Members"]);
  assert.equal(memberList.statusCode, 403);
  assert.equal(memberReview.statusCode, 403);
  assert.equal(otherGroup.statusCode, 403);
  assert.equal((await store.getById("member-1", PENDING_ID))?.status, "pending_verification");

  const list = await handleInvestmentApi({
    method: "GET",
    path: "/admin/deposits",
    claims: { sub: "admin-1", "cognito:groups": "Admins" },
    store,
  });
  const visible = list.body.investments as Array<{ investmentId: string }>;
  assert.equal(list.statusCode, 200);
  assert.deepEqual(visible.map((item) => item.investmentId), [PENDING_ID]);

  const overridden = await review(store, "admin-1", PENDING_ID, {
    decision: "deposit_verified",
    status: "active",
    ownerSub: "admin-1",
    amountMinor: 1,
    planId: "premium",
  }, ["Admins"]);
  assert.equal(overridden.statusCode, 400);
  assert.equal((await store.getById("member-1", PENDING_ID))?.status, "pending_verification");

  const activeDecision = await review(store, "admin-1", PENDING_ID, { decision: "active" }, ["Admins"]);
  assert.equal(activeDecision.statusCode, 400);

  const verified = await review(store, "admin-1", PENDING_ID, { decision: "deposit_verified" }, ["Admins"]);
  assert.equal(verified.statusCode, 200);
  const saved = verified.body.investment as {
    status: string;
    reviewedBy: string;
    reviewedAt: string;
    amountMinor: number;
    planId: string;
    ownerSub: string;
  };
  assert.equal(saved.status, "deposit_verified");
  assert.equal(saved.reviewedBy, "admin-1");
  assert.equal(saved.reviewedAt, REVIEWED_AT);
  assert.equal(saved.amountMinor, 100_000_000);
  assert.equal(saved.planId, "starter");
  assert.equal(saved.ownerSub, "member-1");

  const second = await review(store, "admin-1", PENDING_ID, { decision: "rejected" }, ["Admins"]);
  assert.equal(second.statusCode, 409);
  assert.equal(second.body.error, "review_not_allowed");
  assert.equal((await store.getById("member-1", PENDING_ID))?.status, "deposit_verified");
});

test("a deposit that is not pending cannot be reviewed", async () => {
  const store = createMemoryInvestmentStore([pendingItem(ACTIVE_ID, "member-1", "awaiting_deposit")]);
  const rejected = await review(store, "admin-1", ACTIVE_ID, { decision: "rejected" }, ["Admins"]);
  assert.equal(rejected.statusCode, 409);
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.status, "awaiting_deposit");
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.reviewedBy, undefined);
});

test("the API Gateway bracketed Admins claim is accepted and a member claim is not", async () => {
  assert.equal(isAdminClaims({ sub: "admin-1", "cognito:groups": "[Admins]" }), true);
  assert.equal(isAdminClaims({ sub: "admin-1", "cognito:groups": '["Admins"]' }), true);
  assert.equal(isAdminClaims({ sub: "admin-1", "cognito:groups": "Members,Admins" }), true);
  assert.equal(isAdminClaims({ sub: "member-1", "cognito:groups": "[Members]" }), false);
  assert.equal(isAdminClaims({ sub: "member-1" }), false);

  const store = createMemoryInvestmentStore([pendingItem(PENDING_ID, "member-1")]);
  const admin = await handleInvestmentApi({
    method: "GET",
    path: "/admin/deposits",
    claims: { sub: "admin-1", "cognito:groups": "[Admins]" },
    store,
  });
  assert.equal(admin.statusCode, 200);
  const member = await handleInvestmentApi({
    method: "GET",
    path: "/admin/deposits",
    claims: { sub: "member-1", "cognito:groups": "[Members]" },
    store,
  });
  assert.equal(member.statusCode, 403);
  assert.equal((await store.getById("member-1", PENDING_ID))?.status, "pending_verification");
});

const VERIFIED_ID = "inv_44444444-4444-4444-8444-444444444444";
const ACTIVATED_AT = "2026-10-06T12:00:00.000Z";

function verifiedItem(investmentId: string, ownerSub: string) {
  return {
    ...pendingItem(investmentId, ownerSub),
    status: "deposit_verified" as const,
    reviewedAt: REVIEWED_AT,
    reviewedBy: "admin-1",
  };
}

function activate(store: InvestmentStore, userId: string, investmentId: string, body: unknown = {}, groups?: unknown) {
  return handleInvestmentApi({
    method: "POST",
    path: `/admin/deposits/${investmentId}/activate`,
    claims: groups === undefined ? claims(userId) : { sub: userId, "cognito:groups": groups },
    body,
    store,
    now: () => ACTIVATED_AT,
  });
}

test("only an admin can activate a verified deposit once", async () => {
  const store = createMemoryInvestmentStore([
    verifiedItem(VERIFIED_ID, "member-1"),
    pendingItem(PENDING_ID, "member-2"),
  ]);

  const member = await activate(store, "member-1", VERIFIED_ID, {});
  const otherGroup = await activate(store, "member-9", VERIFIED_ID, {}, ["Members"]);
  assert.equal(member.statusCode, 403);
  assert.equal(otherGroup.statusCode, 403);
  assert.equal((await store.getById("member-1", VERIFIED_ID))?.status, "deposit_verified");

  const pending = await activate(store, "admin-1", PENDING_ID, {}, "[Admins]");
  assert.equal(pending.statusCode, 409);
  assert.equal((await store.getById("member-2", PENDING_ID))?.status, "pending_verification");

  const overridden = await activate(store, "admin-1", VERIFIED_ID, { status: "active", ownerSub: "admin-1", amountMinor: 1, planId: "premium" }, "[Admins]");
  assert.equal(overridden.statusCode, 400);
  assert.equal((await store.getById("member-1", VERIFIED_ID))?.status, "deposit_verified");

  const list = await handleInvestmentApi({
    method: "GET",
    path: "/admin/deposits",
    claims: { sub: "admin-1", "cognito:groups": "[Admins]" },
    store,
  });
  const verified = list.body.verified as Array<{ investmentId: string }>;
  assert.deepEqual(verified.map((item) => item.investmentId), [VERIFIED_ID]);

  const activated = await activate(store, "admin-1", VERIFIED_ID, {}, "[Admins]");
  assert.equal(activated.statusCode, 200);
  const saved = activated.body.investment as {
    status: string;
    activatedBy: string;
    activatedAt: string;
    amountMinor: number;
    planId: string;
    ownerSub: string;
  };
  assert.equal(saved.status, "active");
  assert.equal(saved.activatedBy, "admin-1");
  assert.equal(saved.activatedAt, ACTIVATED_AT);
  assert.equal(saved.amountMinor, 100_000_000);
  assert.equal(saved.planId, "starter");
  assert.equal(saved.ownerSub, "member-1");

  const second = await activate(store, "admin-1", VERIFIED_ID, {}, "[Admins]");
  assert.equal(second.statusCode, 409);
  assert.equal(second.body.error, "activation_not_allowed");
  assert.equal((await store.getById("member-1", VERIFIED_ID))?.status, "active");
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

test("the investment Lambda reads member profiles only to resolve sponsors", () => {
  const source = readFileSync(new URL("../infrastructure/lib/api-stack.ts", import.meta.url), "utf8");
  const investmentPolicy = source.slice(source.indexOf("investmentsFn.addToRolePolicy"));
  assert.match(investmentPolicy, /dynamodb:GetItem/);
  assert.match(investmentPolicy, /dynamodb:PutItem/);
  assert.match(investmentPolicy, /dynamodb:Query/);
  assert.match(investmentPolicy, /dynamodb:UpdateItem/);
  assert.match(investmentPolicy, /dynamodb:Scan/);
  assert.match(investmentPolicy, /resources: \[investmentsTable\.tableArn\]/);
  const membersRead = investmentPolicy.slice(investmentPolicy.lastIndexOf("investmentsFn.addToRolePolicy"));
  assert.match(membersRead, /actions: \["dynamodb:GetItem"\]/);
  assert.match(membersRead, /resources: \[table\.tableArn\]/);
  assert.doesNotMatch(membersRead, /dynamodb:PutItem/);
  assert.doesNotMatch(membersRead, /dynamodb:UpdateItem/);
  assert.doesNotMatch(membersRead, /dynamodb:Query/);
  assert.doesNotMatch(membersRead, /dynamodb:Scan/);
  assert.doesNotMatch(membersRead, /dynamodb:\*/);
  assert.doesNotMatch(membersRead, /dynamodb:DeleteItem/);
});

test("monthly profit posts once for an active investment and only the owner can read it", async () => {
  const active: InvestmentRecord = {
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
  };
  const waiting: InvestmentRecord = { ...active, investmentId: PENDING_ID, status: "deposit_verified" };
  const store = createMemoryInvestmentStore([active, waiting]);
  const period = "2026-10";
  const postedAt = "2026-11-01T01:00:00.000Z";
  assert.equal(previousUtcMonth(postedAt), period);
  assert.equal(previousUtcMonth("2026-01-01T01:00:00.000Z"), "2025-12");

  const skipped = await postProfitForInvestment({
    record: waiting,
    period,
    postedAt,
    store,
  });
  assert.equal(skipped.result, "skipped");
  assert.equal((await store.listProfits("member-1")).length, 0);

  const posted = await postProfitForInvestment({ record: active, period, postedAt, store });
  assert.equal(posted.result, "posted");
  if (posted.result !== "posted") {
    return;
  }
  assert.equal(posted.entry.profitMinor, 8_000_000);
  assert.equal(posted.entry.rateBps, 800);
  assert.equal(posted.entry.period, period);
  assert.equal(posted.entry.principalMinor, 100_000_000);
  const unchanged = await store.getById("member-1", ACTIVE_ID);
  assert.equal(unchanged?.status, "active");
  assert.equal(unchanged?.amountMinor, 100_000_000);

  const duplicate = await postProfitForInvestment({ record: active, period, postedAt, store });
  assert.equal(duplicate.result, "duplicate");
  assert.equal((await store.listProfits("member-1")).length, 1);

  const owner = await handleInvestmentApi({ method: "GET", path: "/profits", claims: claims("member-1"), store });
  const profits = owner.body.profits as Array<{ investmentId: string; profitMinor: number }>;
  assert.equal(owner.statusCode, 200);
  assert.deepEqual(
    profits.map((entry) => entry.investmentId),
    [ACTIVE_ID],
  );
  assert.equal(profits[0]?.profitMinor, 8_000_000);

  const other = await handleInvestmentApi({
    method: "GET",
    path: "/profits",
    claims: claims("member-2"),
    body: { ownerSub: "member-1" },
    store,
  });
  assert.equal(other.statusCode, 200);
  assert.deepEqual(other.body.profits, []);
});

test("a member can request posted profit and cannot read another member's request", async () => {
  const active: InvestmentRecord = {
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
  };
  const profit: ProfitEntry = {
    investmentId: ACTIVE_ID,
    ownerSub: "member-1",
    period: "2026-10",
    rateBps: 800,
    profitMinor: 8_000_000,
    principalMinor: 100_000_000,
    currency: "USDT",
    scale: 6,
    planId: "starter",
    planName: "Starter",
    postedAt: "2026-11-01T01:00:00.000Z",
  };
  const approved: WithdrawalRequest = {
    withdrawalId: "wd_11111111-1111-4111-8111-111111111111",
    ownerSub: "member-1",
    amountMinor: 1_000_000,
    currency: "USDT",
    scale: 6,
    status: "approved",
    createdAt: NOW,
    updatedAt: NOW,
  };
  const store = createMemoryInvestmentStore([active]);
  assert.equal(await store.putProfit(profit), "created");
  assert.equal(await store.putWithdrawal(approved), "created");

  const listed = await handleInvestmentApi({ method: "GET", path: "/withdrawals", claims: claims("member-1"), store });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.availableMinor, 7_000_000);

  const zero = await handleInvestmentApi({
    method: "POST",
    path: "/withdrawals",
    claims: claims("member-1"),
    body: { amountMinor: 0 },
    store,
    now: () => "2026-11-02T00:00:00.000Z",
  });
  assert.equal(zero.statusCode, 400);

  const above = await handleInvestmentApi({
    method: "POST",
    path: "/withdrawals",
    claims: claims("member-1"),
    body: { amountMinor: 7_000_001 },
    store,
  });
  assert.equal(above.statusCode, 409);
  assert.equal(above.body.error, "withdrawal_above_available");

  const otherOwner = await handleInvestmentApi({
    method: "POST",
    path: "/withdrawals",
    claims: claims("member-2"),
    body: { amountMinor: 7_000_000, ownerSub: "member-1" },
    store,
  });
  assert.equal(otherOwner.statusCode, 400);
  const otherAvailable = await handleInvestmentApi({
    method: "POST",
    path: "/withdrawals",
    claims: claims("member-2"),
    body: { amountMinor: 7_000_000 },
    store,
  });
  assert.equal(otherAvailable.statusCode, 409);

  const requested = await handleInvestmentApi({
    method: "POST",
    path: "/withdrawals",
    claims: claims("member-1"),
    body: { amountMinor: 7_000_000 },
    store,
    now: () => "2026-11-02T00:00:00.000Z",
    newWithdrawalId: () => "wd_22222222-2222-4222-8222-222222222222",
  });
  assert.equal(requested.statusCode, 200);
  const withdrawal = requested.body.withdrawal as WithdrawalRequest;
  assert.equal(withdrawal.status, "pending_review");
  assert.equal(withdrawal.ownerSub, "member-1");
  assert.equal(withdrawal.amountMinor, 7_000_000);
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.status, "active");
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.amountMinor, 100_000_000);
  assert.equal((await store.listProfits("member-1"))[0]?.profitMinor, 8_000_000);

  const ownerList = await handleInvestmentApi({ method: "GET", path: "/withdrawals", claims: claims("member-1"), store });
  const ownerRequests = ownerList.body.withdrawals as Array<{ withdrawalId: string }>;
  assert.deepEqual(
    ownerRequests.map((request) => request.withdrawalId).sort(),
    [approved.withdrawalId, withdrawal.withdrawalId].sort(),
  );
  const foreignList = await handleInvestmentApi({
    method: "GET",
    path: "/withdrawals",
    claims: claims("member-2"),
    body: { ownerSub: "member-1" },
    store,
  });
  assert.deepEqual(foreignList.body.withdrawals, []);
  assert.equal(foreignList.body.availableMinor, 0);
});

test("monthly commissions post generation 1 and 2 once and skip a missing sponsor", async () => {
  const investor: InvestmentRecord = {
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
  };
  const alone: InvestmentRecord = { ...investor, investmentId: PENDING_ID, ownerSub: "member-4" };
  const store = createMemoryInvestmentStore([investor, alone]);
  const sponsors: SponsorDirectory = {
    async sponsorOf(userId: string) {
      if (userId === "member-1") {
        return "member-2";
      }
      if (userId === "member-2") {
        return "member-3";
      }
      if (userId === "member-5") {
        return "member-6";
      }
      return null;
    },
  };
  const period = "2026-10";
  const postedAt = "2026-11-01T01:00:00.000Z";

  const profit = await postProfitForInvestment({ record: investor, period, postedAt, store });
  assert.equal(profit.result, "posted");
  if (profit.result === "posted") {
    assert.equal(profit.entry.rateBps, 800);
    assert.equal(profit.entry.profitMinor, 8_000_000);
  }

  const posted = await postCommissionsForInvestment({ record: investor, period, postedAt, store, sponsors });
  assert.deepEqual(
    posted.map((entry) => entry.result),
    ["posted", "posted"],
  );
  const generation1 = (await store.listCommissions("member-2"))[0];
  const generation2 = (await store.listCommissions("member-3"))[0];
  assert.equal(generation1?.generation, 1);
  assert.equal(generation1?.rateBps, 300);
  assert.equal(generation1?.commissionMinor, 3_000_000);
  assert.equal(generation2?.generation, 2);
  assert.equal(generation2?.rateBps, 100);
  assert.equal(generation2?.commissionMinor, 1_000_000);
  assert.equal((await store.listCommissions("member-1")).length, 0);
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.status, "active");
  assert.equal((await store.getById("member-1", ACTIVE_ID))?.amountMinor, 100_000_000);

  const missing = await postCommissionsForInvestment({ record: alone, period, postedAt, store, sponsors });
  assert.deepEqual(
    missing.map((entry) => entry.result),
    ["skipped", "skipped"],
  );
  assert.equal((await store.listCommissions("member-4")).length, 0);

  const directOnly: InvestmentRecord = { ...investor, investmentId: VERIFIED_ID, ownerSub: "member-5" };
  const partial = await postCommissionsForInvestment({ record: directOnly, period, postedAt, store, sponsors });
  assert.deepEqual(
    partial.map((entry) => entry.result),
    ["posted", "skipped"],
  );
  assert.equal((await store.listCommissions("member-6"))[0]?.generation, 1);
  assert.equal((await store.listCommissions("member-6"))[0]?.rateBps, 300);

  const duplicate = await postCommissionsForInvestment({ record: investor, period, postedAt, store, sponsors });
  assert.deepEqual(
    duplicate.map((entry) => entry.result),
    ["duplicate", "duplicate"],
  );
  assert.equal((await store.listCommissions("member-2")).length, 1);
  assert.equal((await store.listCommissions("member-3")).length, 1);

  const sponsor = await handleInvestmentApi({ method: "GET", path: "/commissions", claims: claims("member-2"), store });
  const sponsorRows = sponsor.body.commissions as Array<{ generation: number; recipientSub: string }>;
  assert.equal(sponsor.statusCode, 200);
  assert.deepEqual(
    sponsorRows.map((entry) => entry.generation),
    [1],
  );
  const other = await handleInvestmentApi({
    method: "GET",
    path: "/commissions",
    claims: claims("member-1"),
    body: { ownerSub: "member-2" },
    store,
  });
  assert.deepEqual(other.body.commissions, []);
});
