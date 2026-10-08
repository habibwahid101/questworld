import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clearPendingReferral, PENDING_REFERRAL_KEY } from "../lib/auth/referral.ts";
import { isMemberApiConfigured, readMemberApiUrl } from "../lib/members/config.ts";
import { createMemoryMemberStore } from "../lib/members/memory-store.ts";
import {
  createReferralCode,
  handleMemberApi,
  identityFromClaims,
  memberReferralUrl,
  type MemberStore,
} from "../lib/members/service.ts";

const NOW = "2026-10-01T18:00:00.000Z";

function claims(userId: string, email = `${userId}@example.com`, name = "Member Name") {
  return { sub: userId, email, name };
}

async function initialize(
  store: MemberStore,
  userId: string,
  body: unknown,
  newReferralCode?: () => string,
) {
  return handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims(userId),
    body,
    store,
    now: () => NOW,
    newReferralCode,
  });
}

test("identity comes from the verified token claims, not a body user id", () => {
  assert.equal(identityFromClaims(undefined), null);
  assert.equal(identityFromClaims({ email: "a@example.com" }), null);
  assert.deepEqual(identityFromClaims({ sub: "sub-1", email: "A@Example.com", name: "Ada" }), {
    userId: "sub-1",
    email: "a@example.com",
    name: "Ada",
  });
});

test("referral codes are public, fixed format, and not derived from email", () => {
  const code = createReferralCode(() => 0);
  assert.equal(code, "QWAAAAAAAA");
  assert.equal(code.includes("example.com"), false);
  assert.equal(memberReferralUrl("https://main.d1xja8a1py5jgx.amplifyapp.com/", code), `https://main.d1xja8a1py5jgx.amplifyapp.com/register?ref=${code}`);
});

test("first initialize creates a member and a second call is idempotent", async () => {
  const store = createMemoryMemberStore();
  let generated = 0;
  const first = await initialize(store, "user-a", {}, () => {
    generated += 1;
    return "QWMEMBER01";
  });
  const second = await initialize(store, "user-a", { referralCode: "QWOTHER01" }, () => {
    generated += 1;
    return "QWCHANGED1";
  });
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal((first.body.member as { referralCode: string }).referralCode, "QWMEMBER01");
  assert.equal((second.body.member as { referralCode: string }).referralCode, "QWMEMBER01");
  assert.equal(generated, 1);
  assert.equal("sponsorUserId" in (first.body.member as object), false);
});

test("a valid sponsor is stored and cannot be changed", async () => {
  const store = createMemoryMemberStore();
  await initialize(store, "sponsor", {}, () => "QWSPONSOR1");
  const created = await initialize(store, "member-b", { referralCode: "qwsponsor1" }, () => "QWMEMBER02");
  const changed = await initialize(store, "member-b", { referralCode: "QWNOBODY01" }, () => "QWMEMBER03");
  const sponsor = await store.getByUserId("member-b");
  assert.equal(created.statusCode, 200);
  assert.equal(sponsor?.sponsorUserId, "sponsor");
  assert.equal(sponsor?.sponsorReferralCode, "QWSPONSOR1");
  assert.equal((changed.body.member as { sponsorReferralCode: string | null }).sponsorReferralCode, "QWSPONSOR1");
});

test("invalid codes and self-referral do not create a member", async () => {
  const store = createMemoryMemberStore();
  const invalid = await initialize(store, "user-c", { referralCode: "missing1" }, () => "QWMEMBER04");
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.error, "invalid_referral");
  assert.equal(await store.getByUserId("user-c"), null);

  const selfStore: MemberStore = {
    ...createMemoryMemberStore(),
    async getUserIdByReferralCode(code) {
      return code === "QWSELFCODE" ? "user-d" : null;
    },
  };
  const self = await initialize(selfStore, "user-d", { referralCode: "QWSELFCODE" }, () => "QWMEMBER05");
  assert.equal(self.statusCode, 400);
  assert.equal(self.body.error, "self_referral");
});

test("the client cannot assign a sponsor user id or another member's referral code", async () => {
  const store = createMemoryMemberStore();
  const created = await initialize(
    store,
    "user-e",
    { referralCode: "", sponsorUserId: "attacker", referralCodeOwner: "attacker" },
    () => "QWMEMBER06",
  );
  const saved = await store.getByUserId("user-e");
  assert.equal(created.statusCode, 200);
  assert.equal(saved?.sponsorUserId, null);
  assert.equal(saved?.referralCode, "QWMEMBER06");
});

test("profile edits change only name, phone, and country", async () => {
  const store = createMemoryMemberStore();
  await initialize(store, "user-f", {}, () => "QWMEMBER07");
  const blocked = await handleMemberApi({
    method: "PATCH",
    path: "/me",
    claims: claims("user-f"),
    body: { referralCode: "QWHACKED01", sponsorUserId: "other", createdAt: "2000-01-01T00:00:00.000Z" },
    store,
    now: () => "2026-10-02T00:00:00.000Z",
  });
  assert.equal(blocked.statusCode, 400);
  const edited = await handleMemberApi({
    method: "PATCH",
    path: "/me",
    claims: claims("user-f"),
    body: {
      name: "Updated Name",
      phone: " 555 ",
      country: "Bangladesh",
      referralCode: "QWHACKED01",
      email: "other@example.com",
    },
    store,
    now: () => "2026-10-02T00:00:00.000Z",
  });
  const saved = await store.getByUserId("user-f");
  assert.equal(edited.statusCode, 200);
  assert.equal(saved?.name, "Updated Name");
  assert.equal(saved?.phone, "555");
  assert.equal(saved?.country, "Bangladesh");
  assert.equal(saved?.referralCode, "QWMEMBER07");
  assert.equal(saved?.email, "user-f@example.com");
  assert.equal(saved?.createdAt, NOW);
});

test("missing authentication is rejected", async () => {
  const store = createMemoryMemberStore();
  const denied = await handleMemberApi({
    method: "GET",
    path: "/me",
    store,
  });
  assert.equal(denied.statusCode, 401);
  assert.equal(await store.getByUserId("anyone"), null);
});

test("pending referral storage is cleared only by the success helper", () => {
  const saved = new Map<string, string>([[PENDING_REFERRAL_KEY, "QWKEEP"]]);
  const storage = {
    removeItem(key: string) {
      saved.delete(key);
    },
  };
  assert.equal(saved.get(PENDING_REFERRAL_KEY), "QWKEEP");
  clearPendingReferral(storage);
  assert.equal(saved.has(PENDING_REFERRAL_KEY), false);
  assert.equal(isMemberApiConfigured(readMemberApiUrl("")), false);
  assert.equal(isMemberApiConfigured(readMemberApiUrl("https://example.execute-api.ap-south-1.amazonaws.com")), true);
});

test("a taken generated code is retried without giving two members the same code", async () => {
  const store = createMemoryMemberStore();
  await initialize(store, "owner", {}, () => "QWTAKEN001");
  const codes = ["QWTAKEN001", "QWFREE0001"];
  const created = await initialize(store, "next-user", {}, () => codes.shift() ?? "QWFAIL0001");
  assert.equal(created.statusCode, 200);
  assert.equal((created.body.member as { referralCode: string }).referralCode, "QWFREE0001");
  assert.equal(await store.getUserIdByReferralCode("QWTAKEN001"), "owner");
  assert.equal(await store.getUserIdByReferralCode("QWFREE0001"), "next-user");
});

test("an admin can list stored members and a member cannot", async () => {
  const store = createMemoryMemberStore();
  await initialize(store, "sponsor", {}, () => "QWSPONSOR1");
  await initialize(store, "member-b", { referralCode: "QWSPONSOR1" }, () => "QWMEMBER02");
  const adminIds = async () => ["sponsor"];

  const listed = await handleMemberApi({
    method: "GET",
    path: "/admin/members",
    claims: { sub: "sponsor", email: "sponsor@example.com", "cognito:groups": "[Admins]" },
    store,
    adminUserIds: adminIds,
  });
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(listed.body.members, [
    {
      name: "Member Name",
      email: "member-b@example.com",
      role: "Member",
      referralCode: "QWMEMBER02",
      sponsorReferralCode: "QWSPONSOR1",
    },
    {
      name: "Member Name",
      email: "sponsor@example.com",
      role: "Admin",
      referralCode: "QWSPONSOR1",
      sponsorReferralCode: null,
    },
  ]);

  const denied = await handleMemberApi({
    method: "GET",
    path: "/admin/members",
    claims: { sub: "member-b", email: "member-b@example.com", "cognito:groups": "[Members]" },
    store,
    adminUserIds: adminIds,
  });
  assert.equal(denied.statusCode, 403);

  const empty = await handleMemberApi({
    method: "GET",
    path: "/admin/members",
    claims: { sub: "sponsor", email: "sponsor@example.com", "cognito:groups": "[Admins]" },
    store: createMemoryMemberStore(),
    adminUserIds: async () => [],
  });
  assert.deepEqual(empty.body.members, []);
});

test("the member list read scans only the members table and does not delete", () => {
  const source = readFileSync(new URL("../infrastructure/lib/api-stack.ts", import.meta.url), "utf8");
  const membersPolicy = source.slice(source.indexOf("const membersFn"), source.indexOf("const authorizer"));
  assert.match(source, /path: "\/admin\/members"/);
  assert.match(membersPolicy, /dynamodb:Scan/);
  assert.match(membersPolicy, /cognito-idp:ListUsersInGroup/);
  assert.match(membersPolicy, /resources: \[table\.tableArn\]/);
  assert.doesNotMatch(membersPolicy, /dynamodb:DeleteItem/);
  assert.doesNotMatch(membersPolicy, /new dynamodb\.Table/);
});
