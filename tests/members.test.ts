import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clearPendingReferral, PENDING_REFERRAL_KEY } from "../lib/auth/referral.ts";
import { isMemberApiConfigured, readMemberApiUrl } from "../lib/members/config.ts";
import { createMemoryMemberStore } from "../lib/members/memory-store.ts";
import { verifyTransactionPassword } from "../lib/members/transaction-password.ts";
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

test("signup stores both names and the mobile number without changing an existing profile", async () => {
  const store = createMemoryMemberStore();
  const created = await initialize(
    store,
    "user-new",
    { firstName: "Ada", lastName: "Lovelace", phone: "+1 555 0100", referralCode: "QWNOBODY01" },
    () => "QWNEW00001",
  );
  assert.equal(created.statusCode, 400);

  const saved = await initialize(
    store,
    "user-new",
    { firstName: "Ada", lastName: "Lovelace", phone: "+1 555 0100" },
    () => "QWNEW00001",
  );
  assert.equal(saved.statusCode, 200);
  const member = saved.body.member as {
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    referralCode: string;
  };
  assert.equal(member.name, "Ada Lovelace");
  assert.equal(member.firstName, "Ada");
  assert.equal(member.lastName, "Lovelace");
  assert.equal(member.phone, "+1 555 0100");
  assert.equal(member.referralCode, "QWNEW00001");

  const again = await initialize(
    store,
    "user-new",
    { firstName: "Other", lastName: "Person", phone: "+44 7700 900123" },
    () => "QWCHANGED1",
  );
  assert.equal(again.statusCode, 200);
  const kept = again.body.member as { firstName: string; phone: string; referralCode: string };
  assert.equal(kept.firstName, "Ada");
  assert.equal(kept.phone, "+1 555 0100");
  assert.equal(kept.referralCode, "QWNEW00001");
});

test("account forms show password eyes and do not store the password", () => {
  const register = readFileSync(new URL("../components/auth/RegisterForm.tsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("../components/auth/LoginForm.tsx", import.meta.url), "utf8");
  const reset = readFileSync(new URL("../components/auth/ResetPasswordForm.tsx", import.meta.url), "utf8");
  const pending = readFileSync(new URL("../lib/auth/signup-profile.ts", import.meta.url), "utf8");
  const registerOrder = ["firstName", "lastName", "email", "phone", "password", "confirmPassword", "referralCode"];
  let cursor = 0;
  for (const field of registerOrder) {
    const next = register.indexOf(`name="${field}"`, cursor);
    assert.ok(next > cursor, field);
    cursor = next;
  }
  assert.match(register, /password !== confirmPassword/);
  assert.match(login, /PasswordField/);
  assert.match(register, /PasswordField/);
  assert.match(reset, /PasswordField/);
  assert.match(readFileSync(new URL("../components/auth/PasswordField.tsx", import.meta.url), "utf8"), /Show password/);
  assert.doesNotMatch(pending, /password/);
});

test("a transaction password is stored only as a hash and does not change the login profile", async () => {
  const store = createMemoryMemberStore();
  await initialize(store, "user-pass", {}, () => "QWMEMBER08");
  const password = "Withdraw1!";
  const saved = await handleMemberApi({
    method: "PATCH",
    path: "/me",
    claims: claims("user-pass"),
    body: { transactionPassword: password },
    store,
    now: () => "2026-10-03T00:00:00.000Z",
  });
  assert.equal(saved.statusCode, 200);
  const body = JSON.stringify(saved.body);
  assert.equal(body.includes(password), false);
  assert.equal(body.includes("transactionPasswordHash"), false);
  assert.equal((saved.body.member as { transactionPasswordSet: boolean }).transactionPasswordSet, true);
  const record = await store.getByUserId("user-pass");
  assert.notEqual(record?.transactionPasswordHash, password);
  assert.equal(record?.transactionPasswordHash?.includes(password), false);
  assert.equal(verifyTransactionPassword(password, record?.transactionPasswordHash ?? ""), true);
  assert.equal(record?.name, "Member Name");

  const rejected = await handleMemberApi({
    method: "PATCH",
    path: "/me",
    claims: claims("user-pass"),
    body: { transactionPassword: "OtherPass1!" },
    store,
    now: () => "2026-10-04T00:00:00.000Z",
  });
  assert.equal(rejected.statusCode, 403);
  assert.equal((await store.getByUserId("user-pass"))?.transactionPasswordHash, record?.transactionPasswordHash);

  const renamed = await handleMemberApi({
    method: "PATCH",
    path: "/me",
    claims: claims("user-pass"),
    body: { name: "New Name" },
    store,
    now: () => "2026-10-05T00:00:00.000Z",
  });
  assert.equal(renamed.statusCode, 200);
  assert.equal((await store.getByUserId("user-pass"))?.name, "New Name");
  assert.equal((await store.getByUserId("user-pass"))?.transactionPasswordHash, record?.transactionPasswordHash);

  const login = readFileSync(new URL("../components/auth/LoginForm.tsx", import.meta.url), "utf8");
  const register = readFileSync(new URL("../components/auth/RegisterForm.tsx", import.meta.url), "utf8");
  const fields = readFileSync(new URL("../components/auth/AuthFields.module.css", import.meta.url), "utf8");
  const profile = readFileSync(new URL("../components/member/ProfilePanel.tsx", import.meta.url), "utf8");
  const withdraw = readFileSync(new URL("../components/member/WithdrawPanel.tsx", import.meta.url), "utf8");
  assert.match(login, /fields/);
  assert.match(register, /fields/);
  assert.match(fields, /#1347b8/);
  assert.match(profile, /Change login password/);
  assert.match(profile, /Transaction password/);
  assert.match(withdraw, /transactionPassword/);
  assert.doesNotMatch(withdraw, /Pay out/);
});
