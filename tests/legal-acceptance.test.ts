import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMemoryMemberStore } from "../lib/members/memory-store.ts";
import { handleMemberApi } from "../lib/members/service.ts";

const NOW = "2026-11-18T12:00:00.000Z";

function claims(userId: string, email = `${userId}@example.com`) {
  return { sub: userId, email, name: "Member Name" };
}

function registrationBody(extra: Record<string, unknown> = {}) {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "+1 555 0199",
    referralCode: "QWSPONSOR1",
    ...extra,
  };
}

test("registration without either acceptance is rejected and stores nothing", async () => {
  const store = createMemoryMemberStore();
  await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims("sponsor"),
    body: { acceptTerms: true, acceptPrivacy: true },
    store,
    now: () => NOW,
    newReferralCode: () => "QWSPONSOR1",
  });

  const missingTerms = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims("member-terms"),
    body: registrationBody({ acceptPrivacy: true, termsVersion: "9.9", acceptedAt: "1999-01-01T00:00:00.000Z", memberId: "forged" }),
    store,
    now: () => NOW,
    newReferralCode: () => "QWTERMS001",
  });
  assert.equal(missingTerms.statusCode, 400);
  assert.equal(missingTerms.body.error, "terms_acceptance_required");
  assert.equal(await store.getByUserId("member-terms"), null);
  assert.equal(await store.getLegalAcceptance("member-terms"), null);

  const missingPrivacy = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims("member-privacy"),
    body: registrationBody({ acceptTerms: true, privacyVersion: "9.9" }),
    store,
    now: () => NOW,
    newReferralCode: () => "QWPRIV0001",
  });
  assert.equal(missingPrivacy.statusCode, 400);
  assert.equal(missingPrivacy.body.error, "privacy_acceptance_required");
  assert.equal(await store.getByUserId("member-privacy"), null);
  assert.equal(await store.getLegalAcceptance("member-privacy"), null);
});

test("accepted registration stores the server member id, versions, and timestamp", async () => {
  const store = createMemoryMemberStore();
  await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims("sponsor"),
    body: { acceptTerms: true, acceptPrivacy: true },
    store,
    now: () => NOW,
    newReferralCode: () => "QWSPONSOR1",
  });
  const created = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims("member-ok"),
    body: registrationBody({
      acceptTerms: true,
      acceptPrivacy: true,
      termsVersion: "9.9",
      privacyVersion: "8.8",
      acceptedAt: "1999-01-01T00:00:00.000Z",
      memberId: "forged-member",
    }),
    store,
    now: () => NOW,
    newReferralCode: () => "QWMEMBER01",
  });
  assert.equal(created.statusCode, 200);
  const member = await store.getByUserId("member-ok");
  assert.equal(member?.sponsorReferralCode, "QWSPONSOR1");
  const acceptance = await store.getLegalAcceptance("member-ok");
  assert.equal(acceptance?.memberId, "member-ok");
  assert.equal(acceptance?.termsVersion, "1.0");
  assert.equal(acceptance?.privacyVersion, "1.0");
  assert.equal(acceptance?.acceptedAt, NOW);
  assert.equal(acceptance?.acceptanceMethod, "registration");
  assert.equal(acceptance?.acceptanceId, "acc_member-ok_1.0_1.0");

  const again = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims("member-ok"),
    body: { referralCode: "QWOTHER01" },
    store,
    now: () => "2026-12-01T00:00:00.000Z",
  });
  assert.equal(again.statusCode, 200);
  assert.equal((await store.getLegalAcceptance("member-ok"))?.acceptedAt, NOW);
  assert.equal((await store.listMembers()).length, 2);
});

test("a rejected duplicate registration does not keep an acceptance record", async () => {
  const store = createMemoryMemberStore();
  const first = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims("user-a", "ada@example.com"),
    body: { firstName: "Ada", lastName: "Lovelace", phone: "+1 555 0100", acceptTerms: true, acceptPrivacy: true },
    store,
    now: () => NOW,
    newReferralCode: () => "QWADA00001",
  });
  assert.equal(first.statusCode, 200);
  const duplicate = await handleMemberApi({
    method: "POST",
    path: "/me/initialize",
    claims: claims("user-b", "ada@example.com"),
    body: { firstName: "Other", lastName: "Person", phone: "+44 7700 900123", acceptTerms: true, acceptPrivacy: true },
    store,
    now: () => NOW,
    newReferralCode: () => "QWOTH00001",
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(await store.getByUserId("user-b"), null);
  assert.equal(await store.getLegalAcceptance("user-b"), null);
  assert.equal((await store.getLegalAcceptance("user-a"))?.memberId, "user-a");
});

test("public legal pages render the complete version 1.0 documents", async () => {
  const { PRIVACY_POLICY_DOCUMENT, TERMS_OF_SERVICE_DOCUMENT } = await import("../lib/legal/documents.ts");
  const termsPage = readFileSync(new URL("../app/(public)/terms/page.tsx", import.meta.url), "utf8");
  const privacyPage = readFileSync(new URL("../app/(public)/privacy/page.tsx", import.meta.url), "utf8");
  const terms = readFileSync(new URL("../docs/legal/TERMS_OF_SERVICE.md", import.meta.url), "utf8");
  const privacy = readFileSync(new URL("../docs/legal/PRIVACY_POLICY.md", import.meta.url), "utf8");
  const register = readFileSync(new URL("../components/auth/RegisterForm.tsx", import.meta.url), "utf8");
  const finish = readFileSync(new URL("../components/auth/FinishRegistration.tsx", import.meta.url), "utf8");
  assert.equal(TERMS_OF_SERVICE_DOCUMENT, terms);
  assert.equal(PRIVACY_POLICY_DOCUMENT, privacy);
  assert.match(termsPage, /TERMS_OF_SERVICE_DOCUMENT/);
  assert.match(privacyPage, /PRIVACY_POLICY_DOCUMENT/);
  assert.doesNotMatch(termsPage, /Draft placeholder/);
  assert.doesNotMatch(privacyPage, /Draft placeholder/);
  assert.match(terms, /End of Terms of Service — Version 1.0 Project Draft/);
  assert.match(privacy, /End of Privacy Policy — Version 1.0 Project Draft/);
  assert.match(terms, /\[INSERT REGISTERED ADDRESS\]/);
  assert.match(terms, /\[INSERT OFFICIAL DISPUTE EMAIL AND POSTAL ADDRESS\]/);
  assert.match(privacy, /\[INSERT PRIVACY EMAIL\]/);
  assert.match(register, /name="acceptTerms"/);
  assert.match(register, /name="acceptPrivacy"/);
  assert.doesNotMatch(register, /defaultChecked/);
  assert.match(register, /Version \{TERMS_VERSION\}/);
  assert.match(register, /Version \{PRIVACY_VERSION\}/);
  assert.match(finish, /name="acceptTerms"/);
  assert.match(finish, /name="acceptPrivacy"/);
  assert.doesNotMatch(finish, /defaultChecked/);
});
