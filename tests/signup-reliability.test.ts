import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";
import { canInitializeSubmittedAccount, readyAccountStillValid } from "../lib/auth/signup-session.ts";
import { createMemoryMemberStore, memberRegistrationConflict } from "../lib/members/memory-store.ts";
import { handleMemberApi, registrationPhoneKey, type MemberCompletion, type MemberRecord, type MemberStore } from "../lib/members/service.ts";

register("./resolve-ts-extension.mjs", import.meta.url);

const NOW = "2026-11-12T00:00:00.000Z";
const PHONE = "+1 555 0100";
const OTHER_PHONE = "+44 7700 900123";

type DynamoModule = {
  createDynamoMemberStore: (tableName: string, client: { send: (command: unknown) => Promise<unknown> }) => MemberStore;
};

type CommandInput = {
  Key?: { pk?: string; sk?: string };
  FilterExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
  UpdateExpression?: string;
  ConditionExpression?: string;
  TransactItems?: Array<Record<string, TransactEntry>>;
  Item?: Record<string, unknown>;
};

type TransactEntry = {
  Item?: Record<string, unknown>;
  Key?: { pk: string; sk: string };
  ConditionExpression?: string;
  UpdateExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
};

function record(overrides: Partial<MemberRecord> & Pick<MemberRecord, "userId" | "email" | "referralCode">): MemberRecord {
  return {
    name: "Member Name",
    firstName: null,
    lastName: null,
    phone: null,
    country: null,
    sponsorUserId: null,
    sponsorReferralCode: null,
    transactionPasswordHash: null,
    profilePhotoKey: null,
    createdAt: NOW,
    updatedAt: NOW,
    status: "active",
    ...overrides,
  };
}

function completion(member: MemberRecord, overrides: Partial<MemberCompletion> = {}): MemberCompletion {
  return {
    firstName: null,
    lastName: null,
    name: null,
    phone: null,
    country: null,
    transactionPasswordHash: null,
    ensurePhone: member.phone,
    updatedAt: "2026-11-12T01:00:00.000Z",
    email: member.email,
    referralCode: member.referralCode,
    sponsorUserId: member.sponsorUserId,
    sponsorReferralCode: member.sponsorReferralCode,
    ...overrides,
  };
}

async function initialize(store: MemberStore, userId: string, body: unknown, email = `${userId}@example.com`, name = "Member Name") {
  return handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: name ? { sub: userId, email, name } : { sub: userId, email },
    body,
    store,
    now: () => NOW,
    newReferralCode: () => `QW${userId.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8)}`,
  });
}

test("an existing phone index owned by another member is not a successful completion when fill.phone is null", async () => {
  const store = createMemoryMemberStore();
  assert.equal((await initialize(store, "owner", { firstName: "Ada", lastName: "Lovelace", phone: PHONE })).statusCode, 200);
  assert.equal((await initialize(store, "partial", { firstName: "Lin", lastName: "Us", phone: OTHER_PHONE })).statusCode, 200);
  await store.updateProfile("partial", { phone: PHONE, updatedAt: NOW });
  const before = await store.getByUserId("partial");
  assert.equal(before?.phone, PHONE);
  assert.equal(await store.getPhoneOwner("1 (555) 0100"), "owner");

  const response = await initialize(store, "partial", {
    firstName: "Grace",
    lastName: "Hopper",
    phone: PHONE,
    country: "Japan",
    transactionPassword: "withdrawpass",
  });
  assert.notEqual(response.statusCode, 200);
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error, "phone_taken");
  const after = await store.getByUserId("partial");
  assert.deepEqual(after, before);
  assert.equal(await store.getPhoneOwner(PHONE), "owner");
  assert.equal(await store.getPhoneOwner(OTHER_PHONE), "partial");
});

test("memory phone collisions are reported even when the email also conflicts, and a failed completion rolls back", async () => {
  const store = createMemoryMemberStore();
  const owner = record({ userId: "owner", email: "ada@example.com", referralCode: "QWOWNER001", phone: PHONE, name: "Ada" });
  assert.equal(await store.createMember(owner), "created");
  const duplicate = record({
    userId: "next",
    email: " Ada@Example.com ",
    referralCode: "QWNEXT0001",
    phone: "1 (555) 0100",
    name: "Grace",
  });
  assert.equal(await store.createMember(duplicate), "phone-taken");
  assert.equal(await store.getByUserId("next"), null);
  assert.equal(await store.getUserIdByReferralCode("QWNEXT0001"), null);
  assert.equal(await store.getPhoneOwner(PHONE), "owner");
  assert.deepEqual(await store.getByUserId("owner"), owner);

  assert.equal(
    memberRegistrationConflict(
      [{ ...owner, phone: OTHER_PHONE }],
      new Map([[registrationPhoneKey(PHONE), "index-owner"]]),
      "next",
      owner.email,
      PHONE,
    ),
    "phone",
  );

  await store.updateProfile("owner", { phone: OTHER_PHONE, updatedAt: NOW });
  assert.equal((await store.getByUserId("owner"))?.phone, OTHER_PHONE);
  assert.equal(await store.getPhoneOwner(PHONE), "owner");
  const blocked = await initialize(store, "later", { firstName: "Lin", lastName: "Us", phone: "+1 555 0100" }, "later@example.com");
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.body.error, "phone_taken");
  assert.equal(await store.getByUserId("later"), null);
  assert.equal(await store.getPhoneOwner(PHONE), "owner");

  const partial = record({ userId: "partial", email: "partial@example.com", referralCode: "QWPART0001", name: "Fallback" });
  assert.equal(await store.createMember(partial), "created");
  const before = await store.getByUserId("partial");
  const rolled = await store.completeMember(
    "partial",
    completion(partial, { firstName: "Lin", phone: PHONE, ensurePhone: null, name: "Should Not Apply" }),
  );
  assert.equal(rolled.result, "phone-taken");
  assert.deepEqual(await store.getByUserId("partial"), before);
  assert.equal(await store.getPhoneOwner(PHONE), "owner");
});

test("a phone index already owned by the same member is idempotent and does not change the profile", async () => {
  const store = createMemoryMemberStore();
  const member = record({
    userId: "same",
    email: "same@example.com",
    referralCode: "QWSAME0001",
    phone: PHONE,
    name: "Fallback",
    firstName: "Ada",
    country: "Bangladesh",
  });
  assert.equal(await store.createMember(member), "created");
  const before = await store.getByUserId("same");
  const again = await store.completeMember("same", completion(member, { ensurePhone: "1 (555) 0100", firstName: "Grace", name: "Other" }));
  assert.equal(again.result, "updated");
  assert.deepEqual(await store.getByUserId("same"), before);
  assert.equal(await store.getPhoneOwner("+1-555-0100"), "same");
  assert.equal((await store.listMembers()).length, 1);
});

test("blank sponsor fields do not block completion or count as success when a different sponsor is stored", async () => {
  const store = createMemoryMemberStore();
  const member = record({
    userId: "blank-sponsor",
    email: "blank@example.com",
    referralCode: "QWBLANK01",
    sponsorUserId: "",
    sponsorReferralCode: "",
    name: "Fallback",
  });
  assert.equal(await store.createMember(member), "created");
  const saved = await store.completeMember(
    member.userId,
    completion(member, { sponsorUserId: null, sponsorReferralCode: null, firstName: "Ada", lastName: "Lovelace", phone: OTHER_PHONE }),
  );
  assert.equal(saved.result, "updated");
  const stored = await store.getByUserId(member.userId);
  assert.equal(stored?.firstName, "Ada");
  assert.equal(stored?.phone, OTHER_PHONE);
  assert.equal(stored?.name, "Fallback");
  assert.equal(stored?.sponsorUserId, "");
  assert.equal(stored?.sponsorReferralCode, "");
  assert.equal(await store.getPhoneOwner(OTHER_PHONE), member.userId);

  const mismatch = await store.completeMember(
    member.userId,
    completion({ ...member, firstName: "Ada", phone: OTHER_PHONE }, { sponsorUserId: "other-sponsor", lastName: "Hopper" }),
  );
  assert.equal(mismatch.result, "conflict");
  assert.equal((await store.getByUserId(member.userId))?.lastName, "Lovelace");
  assert.equal((await store.getByUserId(member.userId))?.sponsorUserId, "");
});

test("completion preserves a nonblank display name and fills each blank field independently", async () => {
  const store = createMemoryMemberStore();
  const created = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "fallback", email: "Ada@Example.com" },
    body: {},
    store,
    now: () => NOW,
    newReferralCode: () => "QWFALLBACK",
  });
  assert.equal(created.statusCode, 200);
  assert.equal((await store.getByUserId("fallback"))?.name, "ada");
  assert.equal((await store.getByUserId("fallback"))?.email, "ada@example.com");

  const filled = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "fallback", email: "ada@example.com", name: "Ignored Claim" },
    body: { firstName: "Ada", lastName: "Lovelace", phone: PHONE, country: "Bangladesh", transactionPassword: "withdrawpass" },
    store,
    now: () => NOW,
    newReferralCode: () => "QWHACKED01",
  });
  assert.equal(filled.statusCode, 200);
  const saved = await store.getByUserId("fallback");
  assert.equal(saved?.name, "ada");
  assert.equal(saved?.firstName, "Ada");
  assert.equal(saved?.lastName, "Lovelace");
  assert.equal(saved?.phone, PHONE);
  assert.equal(saved?.country, "Bangladesh");
  assert.equal(saved?.referralCode, "QWFALLBACK");
  assert.equal(await store.getPhoneOwner(PHONE), "fallback");

  const partial = record({
    userId: "partial-name",
    email: "partial-name@example.com",
    referralCode: "QWPARTNM1",
    name: "Cognito User",
    firstName: "Ada",
    country: "Bangladesh",
    transactionPasswordHash: "hash-v1",
  });
  assert.equal(await store.createMember(partial), "created");
  const response = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: partial.userId, email: partial.email, name: "Cognito User" },
    body: { firstName: "Grace", lastName: "Hopper", phone: OTHER_PHONE, country: "Japan", transactionPassword: "withdrawpass" },
    store,
    now: () => NOW,
    newReferralCode: () => "QWCHANGED1",
  });
  assert.equal(response.statusCode, 200);
  const kept = await store.getByUserId(partial.userId);
  assert.equal(kept?.name, "Cognito User");
  assert.equal(kept?.firstName, "Ada");
  assert.equal(kept?.lastName, "Hopper");
  assert.equal(kept?.phone, OTHER_PHONE);
  assert.equal(kept?.country, "Bangladesh");
  assert.equal(kept?.transactionPasswordHash, "hash-v1");
  assert.equal(kept?.email, partial.email);
  assert.equal(kept?.referralCode, partial.referralCode);
});

test("a conflicting completion is not retried as success, and transient conflicts retry only up to the bound", async () => {
  const conflicting = createMemoryMemberStore();
  assert.equal((await initialize(conflicting, "partial", {})).statusCode, 200);
  const before = await conflicting.getByUserId("partial");
  let conflictCalls = 0;
  const conflictStore: MemberStore = {
    ...conflicting,
    async completeMember() {
      conflictCalls += 1;
      return { result: "conflict", member: before };
    },
  };
  const conflicted = await initialize(conflictStore, "partial", { firstName: "Ada", lastName: "Lovelace", phone: PHONE });
  assert.notEqual(conflicted.statusCode, 200);
  assert.equal(conflicted.statusCode, 409);
  assert.equal(conflicted.body.error, "profile_conflict");
  assert.equal(conflictCalls, 1);
  assert.deepEqual(await conflicting.getByUserId("partial"), before);

  const transient = createMemoryMemberStore();
  assert.equal((await initialize(transient, "partial", {})).statusCode, 200);
  const transientBefore = await transient.getByUserId("partial");
  let transientCalls = 0;
  const transientStore: MemberStore = {
    ...transient,
    async completeMember() {
      transientCalls += 1;
      return { result: "transient", member: transientBefore };
    },
  };
  const failed = await initialize(transientStore, "partial", { firstName: "Ada", lastName: "Lovelace", phone: PHONE });
  assert.notEqual(failed.statusCode, 200);
  assert.equal(failed.statusCode, 409);
  assert.equal(failed.body.error, "profile_conflict");
  assert.equal(transientCalls, 3);
  assert.deepEqual(await transient.getByUserId("partial"), transientBefore);
  assert.equal(await transient.getPhoneOwner(PHONE), null);
});

test("concurrent completion by the same member succeeds only after the saved profile and phone index are verified", async () => {
  const store = createMemoryMemberStore();
  assert.equal((await initialize(store, "partial", {})).statusCode, 200);
  const original = store.completeMember.bind(store);
  let calls = 0;
  const racing: MemberStore = {
    ...store,
    async completeMember(userId, fill) {
      calls += 1;
      await original(userId, fill);
      return { result: "transient", member: null };
    },
  };
  const response = await initialize(racing, "partial", {
    firstName: "Ada",
    lastName: "Lovelace",
    phone: PHONE,
    country: "Bangladesh",
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls, 1);
  const saved = await store.getByUserId("partial");
  assert.equal(saved?.firstName, "Ada");
  assert.equal(saved?.phone, PHONE);
  assert.equal(saved?.name, "Member Name");
  assert.equal(await store.getPhoneOwner(PHONE), "partial");

  const lying = createMemoryMemberStore();
  assert.equal((await initialize(lying, "partial", {})).statusCode, 200);
  const untouched = await lying.getByUserId("partial");
  const dishonest: MemberStore = {
    ...lying,
    async completeMember() {
      return {
        result: "updated",
        member: record({
          userId: "partial",
          email: "partial@example.com",
          referralCode: untouched?.referralCode ?? "QWPARTIAL",
          firstName: "Ada",
          phone: PHONE,
          name: "Ada Lovelace",
        }),
      };
    },
  };
  const rejected = await initialize(dishonest, "partial", { firstName: "Ada", lastName: "Lovelace", phone: PHONE });
  assert.notEqual(rejected.statusCode, 200);
  assert.equal(rejected.statusCode, 409);
  assert.deepEqual(await lying.getByUserId("partial"), untouched);
  assert.equal(await lying.getPhoneOwner(PHONE), null);
});

test("email or password changes invalidate readiness and a different Cognito sub cannot receive the submitted registration", async () => {
  const ready = { email: "ada@example.com", password: "Secret1!", sub: "sub-a" };
  const principal = { sub: "sub-a", email: "ada@example.com" };
  assert.equal(readyAccountStillValid(ready, { email: " ADA@Example.com ", password: "Secret1!" }, principal), true);
  assert.equal(readyAccountStillValid(ready, { email: "other@example.com", password: "Secret1!" }, principal), false);
  assert.equal(readyAccountStillValid(ready, { email: "ada@example.com", password: "Secret2!" }, principal), false);
  assert.equal(readyAccountStillValid(ready, { email: "ada@example.com", password: "Secret1!" }, { sub: "sub-b", email: "ada@example.com" }), false);
  assert.equal(readyAccountStillValid(ready, { email: "ada@example.com", password: "Secret1!" }, null), false);
  assert.equal(canInitializeSubmittedAccount(ready, principal, "ada@example.com"), true);
  assert.equal(canInitializeSubmittedAccount(ready, { sub: "sub-b", email: "ada@example.com" }, "ada@example.com"), false);
  assert.equal(canInitializeSubmittedAccount(ready, { sub: "sub-a", email: "other@example.com" }, "ada@example.com"), false);
  assert.equal(canInitializeSubmittedAccount(ready, null, "ada@example.com"), false);

  const session = readFileSync(new URL("../lib/auth/signup-session.ts", import.meta.url), "utf8");
  const register = readFileSync(new URL("../components/auth/RegisterForm.tsx", import.meta.url), "utf8");
  const submit = register.slice(register.indexOf("async function onSubmit"));
  assert.doesNotMatch(session, /localStorage|sessionStorage|console\./);
  assert.doesNotMatch(submit, /localStorage\.setItem|sessionStorage\.setItem|console\.(log|debug|info|warn|error)\(/);
  assert.ok(submit.indexOf("readyAccountStillValid") < submit.indexOf("await registerAccount("));
  assert.ok(submit.indexOf("await logoutAccount()") < submit.indexOf("await registerAccount("));
  assert.ok(submit.indexOf("canInitializeSubmittedAccount") < submit.indexOf("await initializeCurrentMember"));
  assert.ok(submit.indexOf("readyAccount.current = { email: normalizedEmail, password, sub: signedInPrincipal.sub }") < submit.indexOf("await initializeCurrentMember"));
  const caught = submit.slice(submit.lastIndexOf("} catch (caught)"));
  assert.doesNotMatch(caught, /readyAccount\.current = null/);

  const store = createMemoryMemberStore();
  assert.equal((await initialize(store, "user-a", { firstName: "Ada", lastName: "Lovelace", phone: PHONE }, "ada@example.com", "Ada")).statusCode, 200);
  const intruder = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "user-b", email: "other@example.com", name: "Other Person" },
    body: { userId: "user-a", email: "ada@example.com", firstName: "Stolen", lastName: "Identity", phone: OTHER_PHONE },
    store,
    now: () => NOW,
    newReferralCode: () => "QWINTRUDE",
  });
  assert.equal(intruder.statusCode, 200);
  assert.equal((await store.getByUserId("user-a"))?.email, "ada@example.com");
  assert.equal((await store.getByUserId("user-a"))?.firstName, "Ada");
  assert.equal((await store.getByUserId("user-a"))?.phone, PHONE);
  const other = await store.getByUserId("user-b");
  assert.equal(other?.email, "other@example.com");
  assert.equal(other?.firstName, "Stolen");
  assert.notEqual(other?.userId, "user-a");
  assert.equal(await store.getPhoneOwner(PHONE), "user-a");
  assert.equal(await store.getPhoneOwner(OTHER_PHONE), "user-b");
});

test("DynamoDB transaction cancellation is classified without reporting a false success", async () => {
  const { createDynamoMemberStore } = await loadDynamo();
  const profile = record({ userId: "partial", email: "partial@example.com", referralCode: "QWPART0001", phone: PHONE, name: "Fallback" });
  const table = new Map<string, Record<string, unknown>>([[`USER#${profile.userId}\0PROFILE`, profileItem(profile)]]);
  table.set(`PHONE#${registrationPhoneKey(PHONE)}\0UNIQUE`, { pk: `PHONE#${registrationPhoneKey(PHONE)}`, sk: "UNIQUE", userId: "other-member" });
  let writes = 0;
  const store = createDynamoMemberStore("Members", {
    async send(command: unknown) {
      const current = command as { constructor: { name: string }; input: CommandInput };
      if (current.constructor.name === "GetCommand") {
        const key = current.input.Key;
        return { Item: key?.pk && key.sk ? table.get(`${key.pk}\0${key.sk}`) : undefined };
      }
      if (current.constructor.name === "TransactWriteCommand") {
        writes += 1;
        const count = current.input.TransactItems?.length ?? 0;
        throw canceled(Array.from({ length: count }, (_, index) => (index === count - 1 ? "ConditionalCheckFailed" : "None")));
      }
      throw new Error(`unexpected ${current.constructor.name}`);
    },
  });
  const phoneTaken = await store.completeMember(profile.userId, completion(profile, { firstName: "Ada", ensurePhone: PHONE }));
  assert.equal(phoneTaken.result, "phone-taken");
  assert.notEqual(phoneTaken.result, "updated");
  assert.equal(table.get(`PHONE#${registrationPhoneKey(PHONE)}\0UNIQUE`)?.userId, "other-member");
  assert.equal(table.get(`USER#${profile.userId}\0PROFILE`)?.firstName, undefined);

  const response = await initialize(store, "partial", { firstName: "Ada", lastName: "Lovelace", phone: PHONE, country: "Japan" }, profile.email, "Fallback");
  assert.notEqual(response.statusCode, 200);
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error, "phone_taken");
  assert.equal(table.get(`USER#${profile.userId}\0PROFILE`)?.firstName, undefined);
  assert.ok(writes >= 1);

  const transientStore = createDynamoMemberStore("Members", {
    async send(command: unknown) {
      const current = command as { constructor: { name: string }; input: CommandInput };
      if (current.constructor.name === "GetCommand") {
        const key = current.input.Key;
        if (key?.pk?.startsWith("PHONE#")) {
          return {};
        }
        return { Item: key?.pk && key.sk ? table.get(`${key.pk}\0${key.sk}`) : undefined };
      }
      if (current.constructor.name === "TransactWriteCommand") {
        throw canceled((current.input.TransactItems ?? []).map(() => "TransactionConflict"));
      }
      throw new Error(`unexpected ${current.constructor.name}`);
    },
  });
  const transient = await transientStore.completeMember(profile.userId, completion(profile, { ensurePhone: PHONE }));
  assert.equal(transient.result, "transient");
  assert.notEqual(transient.result, "updated");

  const conditionalStore = createDynamoMemberStore("Members", {
    async send(command: unknown) {
      const current = command as { constructor: { name: string }; input: CommandInput };
      if (current.constructor.name === "GetCommand") {
        const key = current.input.Key;
        return { Item: key?.pk && key.sk ? table.get(`${key.pk}\0${key.sk}`) : undefined };
      }
      if (current.constructor.name === "TransactWriteCommand") {
        const count = current.input.TransactItems?.length ?? 0;
        throw canceled(Array.from({ length: count }, (_, index) => (index === 0 ? "ConditionalCheckFailed" : "None")));
      }
      throw new Error(`unexpected ${current.constructor.name}`);
    },
  });
  const conditional = await conditionalStore.completeMember(profile.userId, completion(profile, { firstName: "Ada" }));
  assert.equal(conditional.result, "conflict");
  assert.notEqual(conditional.result, "updated");
  assert.notEqual(conditional.result, "transient");
});

test("a mocked DynamoDB transaction persists completion atomically and retries transient conflicts only while unverified", async () => {
  const { createDynamoMemberStore } = await loadDynamo();
  const fake = createEvaluatingClient();
  const store = createDynamoMemberStore("Members", fake);
  const created = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "fallback", email: "Ada@Example.com" },
    body: {},
    store,
    now: () => NOW,
    newReferralCode: () => "QWFALLBACK",
  });
  assert.equal(created.statusCode, 200);
  assert.ok(fake.commands.includes("TransactWriteCommand"));
  assert.equal(fake.commands.includes("PutCommand"), false);

  const filled = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "fallback", email: "ada@example.com", name: "ada" },
    body: { firstName: "Ada", lastName: "Lovelace", phone: PHONE, country: "Bangladesh" },
    store,
    now: () => NOW,
    newReferralCode: () => "QWHACKED01",
  });
  assert.equal(filled.statusCode, 200);
  assert.equal((await store.getByUserId("fallback"))?.name, "ada");
  assert.equal((await store.getByUserId("fallback"))?.firstName, "Ada");
  assert.equal((await store.getByUserId("fallback"))?.phone, PHONE);
  assert.equal(await store.getPhoneOwner("1 (555) 0100"), "fallback");
  assert.equal((await store.getByUserId("fallback"))?.sponsorUserId, null);

  const owner = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "owner", email: "owner@example.com", name: "Owner" },
    body: { firstName: "Owen", lastName: "Owner", phone: OTHER_PHONE },
    store,
    now: () => NOW,
    newReferralCode: () => "QWOWNER001",
  });
  assert.equal(owner.statusCode, 200);
  const partial = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "partial", email: "partial@example.com", name: "Fallback" },
    body: {},
    store,
    now: () => NOW,
    newReferralCode: () => "QWPART0001",
  });
  assert.equal(partial.statusCode, 200);
  const before = await store.getByUserId("partial");
  const blocked = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "partial", email: "partial@example.com", name: "Fallback" },
    body: { firstName: "Lin", lastName: "Us", phone: OTHER_PHONE, country: "Japan" },
    store,
    now: () => NOW,
    newReferralCode: () => "QWHACKED01",
  });
  assert.notEqual(blocked.statusCode, 200);
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.body.error, "phone_taken");
  assert.deepEqual(await store.getByUserId("partial"), before);
  assert.equal(await store.getPhoneOwner(OTHER_PHONE), "owner");

  const both = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "both", email: "owner@example.com", name: "Both" },
    body: { firstName: "Both", lastName: "Conflicts", phone: OTHER_PHONE },
    store,
    now: () => NOW,
    newReferralCode: () => "QWBOTH0001",
  });
  assert.equal(both.statusCode, 409);
  assert.equal(both.body.error, "phone_taken");
  assert.equal(await store.getByUserId("both"), null);

  const blankSponsor = profileItem(record({ userId: "blank", email: "blank@example.com", referralCode: "QWBLANK01", name: "Fallback", sponsorUserId: "" }));
  blankSponsor.sponsorUserId = "";
  fake.table.set("USER#blank\0PROFILE", blankSponsor);
  fake.table.set("EMAIL#blank@example.com\0UNIQUE", { pk: "EMAIL#blank@example.com", sk: "UNIQUE", userId: "blank" });
  fake.table.set("REFERRAL#QWBLANK01\0OWNER", { pk: "REFERRAL#QWBLANK01", sk: "OWNER", userId: "blank" });
  const repaired = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "blank", email: "blank@example.com", name: "Fallback" },
    body: { firstName: "Ada", lastName: "Lovelace", phone: "+1 555 0199" },
    store,
    now: () => NOW,
    newReferralCode: () => "QWHACKED01",
  });
  assert.equal(repaired.statusCode, 200);
  assert.equal((await store.getByUserId("blank"))?.firstName, "Ada");
  assert.equal((await store.getByUserId("blank"))?.name, "Fallback");
  assert.equal((await store.getByUserId("blank"))?.sponsorUserId, null);
  assert.equal(await store.getPhoneOwner("+1 555 0199"), "blank");

  let conflicts = 0;
  const retrying = createDynamoMemberStore("Members", {
    async send(command: unknown) {
      const current = command as { constructor: { name: string }; input: CommandInput };
      if (current.constructor.name === "TransactWriteCommand") {
        conflicts += 1;
        if (conflicts < 3) {
          throw canceled((current.input.TransactItems ?? []).map(() => "TransactionConflict"));
        }
        return fake.send(command);
      }
      if (current.constructor.name === "GetCommand" || current.constructor.name === "ScanCommand") {
        return fake.send(command);
      }
      throw new Error(`unexpected ${current.constructor.name}`);
    },
  });
  const retryUser = record({ userId: "retry", email: "retry@example.com", referralCode: "QWRETRY001", name: "Fallback" });
  fake.table.set("USER#retry\0PROFILE", profileItem(retryUser));
  const retried = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "retry", email: "retry@example.com", name: "Fallback" },
    body: { firstName: "Ada", lastName: "Lovelace", phone: "+1 555 0188" },
    store: retrying,
    now: () => NOW,
    newReferralCode: () => "QWHACKED01",
  });
  assert.equal(retried.statusCode, 200);
  assert.equal(conflicts, 3);
  assert.equal((await retrying.getByUserId("retry"))?.firstName, "Ada");
  assert.equal(await retrying.getPhoneOwner("+1 555 0188"), "retry");

  let exhausted = 0;
  const failing = createDynamoMemberStore("Members", {
    async send(command: unknown) {
      const current = command as { constructor: { name: string }; input: CommandInput };
      if (current.constructor.name === "GetCommand") {
        const key = current.input.Key;
        if (key?.pk === "USER#stuck\0PROFILE" || key?.pk === "USER#stuck") {
          return { Item: profileItem(record({ userId: "stuck", email: "stuck@example.com", referralCode: "QWSTUCK001", name: "Fallback" })) };
        }
        return {};
      }
      if (current.constructor.name === "TransactWriteCommand") {
        exhausted += 1;
        throw canceled((current.input.TransactItems ?? []).map(() => "TransactionConflict"));
      }
      throw new Error(`unexpected ${current.constructor.name}`);
    },
  });
  const stuck = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: { sub: "stuck", email: "stuck@example.com", name: "Fallback" },
    body: { firstName: "Ada", lastName: "Lovelace", phone: "+1 555 0171" },
    store: failing,
    now: () => NOW,
    newReferralCode: () => "QWHACKED01",
  });
  assert.notEqual(stuck.statusCode, 200);
  assert.equal(stuck.statusCode, 409);
  assert.equal(stuck.body.error, "profile_conflict");
  assert.equal(exhausted, 3);
});

async function loadDynamo(): Promise<DynamoModule> {
  const imported: unknown = await import("../infrastructure/lambda/members/index.ts");
  return imported as DynamoModule;
}

function profileItem(member: MemberRecord): Record<string, unknown> {
  const item: Record<string, unknown> = { pk: `USER#${member.userId}`, sk: "PROFILE" };
  for (const [key, value] of Object.entries(member)) {
    if (value !== null && value !== undefined && value !== "") {
      item[key] = value;
    }
  }
  return item;
}

function canceled(reasons: string[]): Error {
  const error = new Error("Transaction cancelled");
  error.name = "TransactionCanceledException";
  Object.assign(error, { CancellationReasons: reasons.map((Code) => ({ Code })) });
  return error;
}

function createEvaluatingClient() {
  const table = new Map<string, Record<string, unknown>>();
  const commands: string[] = [];
  return {
    table,
    commands,
    async send(command: unknown) {
      const current = command as { constructor: { name: string }; input: CommandInput };
      commands.push(current.constructor.name);
      if (current.constructor.name === "GetCommand") {
        const key = current.input.Key;
        const item = key?.pk && key.sk ? table.get(`${key.pk}\0${key.sk}`) : undefined;
        return { Item: item ? { ...item } : undefined };
      }
      if (current.constructor.name === "ScanCommand") {
        const items = [...table.values()].filter((item) => {
          if (current.input.FilterExpression === "sk = :profile") {
            return item.sk === current.input.ExpressionAttributeValues?.[":profile"];
          }
          if (current.input.FilterExpression === "sk = :profile AND begins_with(pk, :user)") {
            return item.sk === current.input.ExpressionAttributeValues?.[":profile"] && String(item.pk).startsWith(String(current.input.ExpressionAttributeValues?.[":user"]));
          }
          return false;
        });
        return { Items: items.map((item) => ({ ...item })), ScannedCount: items.length };
      }
      if (current.constructor.name === "TransactWriteCommand") {
        const entries = current.input.TransactItems ?? [];
        const reasons = entries.map((entry) => (conditionPasses(entry, table) ? "None" : "ConditionalCheckFailed"));
        if (reasons.some((reason) => reason !== "None")) {
          throw canceled(reasons);
        }
        const next = new Map(table);
        for (const entry of entries) {
          applyEntry(entry, next);
        }
        table.clear();
        for (const [key, item] of next) {
          table.set(key, item);
        }
        return {};
      }
      throw new Error(`unexpected ${current.constructor.name}`);
    },
  };
}

function conditionPasses(entry: Record<string, TransactEntry>, table: Map<string, Record<string, unknown>>): boolean {
  const operation = entry.Put ?? entry.Update ?? entry.ConditionCheck;
  if (!operation?.ConditionExpression) {
    return false;
  }
  const key = operation.Key ?? { pk: String(operation.Item?.pk), sk: String(operation.Item?.sk) };
  const item = table.get(`${key.pk}\0${key.sk}`);
  return evaluateCondition(operation.ConditionExpression, item, operation.ExpressionAttributeNames, operation.ExpressionAttributeValues);
}

function applyEntry(entry: Record<string, TransactEntry>, table: Map<string, Record<string, unknown>>): void {
  if (entry.Put?.Item) {
    table.set(`${String(entry.Put.Item.pk)}\0${String(entry.Put.Item.sk)}`, { ...entry.Put.Item });
    return;
  }
  if (!entry.Update?.UpdateExpression || !entry.Update.Key) {
    return;
  }
  const key = `${entry.Update.Key.pk}\0${entry.Update.Key.sk}`;
  const item = { ...(table.get(key) ?? {}) };
  const assignment = entry.Update.UpdateExpression.replace(/^SET\s+/, "");
  for (const part of assignment.split(",")) {
    const [rawPath, rawValue] = part.split("=").map((piece) => piece.trim());
    if (!rawPath || !rawValue) {
      continue;
    }
    const path = rawPath.startsWith("#") ? entry.Update.ExpressionAttributeNames?.[rawPath] ?? rawPath : rawPath;
    item[path] = entry.Update.ExpressionAttributeValues?.[rawValue];
  }
  table.set(key, item);
}

function evaluateCondition(
  expression: string,
  item: Record<string, unknown> | undefined,
  names: Record<string, string> | undefined,
  values: Record<string, unknown> | undefined,
): boolean {
  const tokens = expression.match(/attribute_not_exists|attribute_exists|attribute_type|AND|OR|\(|\)|,|=|#[A-Za-z0-9]+|:[A-Za-z0-9]+|[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  let index = 0;
  const result = parseOr();
  if (index !== tokens.length) {
    throw new Error(`Unused condition tokens: ${tokens.slice(index).join(" ")} in ${expression}`);
  }
  return result;

  function parseOr(): boolean {
    let left = parseAnd();
    while (tokens[index] === "OR") {
      index += 1;
      const right = parseAnd();
      left = left || right;
    }
    return left;
  }

  function parseAnd(): boolean {
    let left = parsePrimary();
    while (tokens[index] === "AND") {
      index += 1;
      const right = parsePrimary();
      left = left && right;
    }
    return left;
  }

  function parsePrimary(): boolean {
    if (tokens[index] === "(") {
      index += 1;
      const value = parseOr();
      if (tokens[index] !== ")") {
        throw new Error("missing )");
      }
      index += 1;
      return value;
    }
    const word = tokens[index];
    if (word === "attribute_exists" || word === "attribute_not_exists" || word === "attribute_type") {
      index += 1;
      if (tokens[index] !== "(") {
        throw new Error("missing (");
      }
      index += 1;
      const path = readPath();
      if (word === "attribute_type") {
        if (tokens[index] !== ",") {
          throw new Error("missing ,");
        }
        index += 1;
        const typeName = String(readValue());
        if (tokens[index] !== ")") {
          throw new Error("missing )");
        }
        index += 1;
        return attributeType(item, path) === typeName;
      }
      if (tokens[index] !== ")") {
        throw new Error("missing )");
      }
      index += 1;
      const exists = item !== undefined && Object.prototype.hasOwnProperty.call(item, path);
      return word === "attribute_exists" ? exists : !exists;
    }
    const path = readPath();
    if (tokens[index] !== "=") {
      throw new Error(`expected = near ${tokens[index] ?? "end"}`);
    }
    index += 1;
    return item?.[path] === readValue();
  }

  function readPath(): string {
    const token = tokens[index];
    index += 1;
    if (!token) {
      throw new Error("missing path");
    }
    if (token.startsWith("#")) {
      return names?.[token] ?? token;
    }
    return token;
  }

  function readValue(): unknown {
    const token = tokens[index];
    index += 1;
    if (!token?.startsWith(":")) {
      throw new Error(`missing value near ${token ?? "end"}`);
    }
    return values?.[token];
  }
}

function attributeType(item: Record<string, unknown> | undefined, path: string): string {
  if (!item || !Object.prototype.hasOwnProperty.call(item, path)) {
    return "MISSING";
  }
  const value = item[path];
  if (value === null) {
    return "NULL";
  }
  if (typeof value === "string") {
    return "S";
  }
  return "OTHER";
}
