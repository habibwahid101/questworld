import assert from "node:assert/strict";
import test from "node:test";
import { isAuthConfigured } from "../lib/auth/config.ts";
import { mapAuthError, mapRecoveryRequestError } from "../lib/auth/errors.ts";
import { isAdminGroups, normalizeGroups } from "../lib/auth/groups.ts";
import { passwordIssue } from "../lib/auth/password.ts";
import { isAdminPath, isMemberPath, isProtectedPath } from "../lib/auth/paths.ts";
import { normalizeReferralCode, rememberPendingReferral, PENDING_REFERRAL_KEY } from "../lib/auth/referral.ts";

test("member routes are protected and public referral page is not", () => {
  assert.equal(isMemberPath("/dashboard"), true);
  assert.equal(isMemberPath("/referrals/dashboard"), true);
  assert.equal(isMemberPath("/referrals"), false);
  assert.equal(isProtectedPath("/wallet"), true);
  assert.equal(isProtectedPath("/plans"), false);
});

test("admin routes require the admin area only", () => {
  assert.equal(isAdminPath("/admin"), true);
  assert.equal(isAdminPath("/admin/users"), true);
  assert.equal(isAdminPath("/dashboard"), false);
});

test("admin group check is exact", () => {
  assert.equal(isAdminGroups(normalizeGroups(["Members", "Admins"])), true);
  assert.equal(isAdminGroups(normalizeGroups(["Members"])), false);
  assert.equal(isAdminGroups(normalizeGroups(undefined)), false);
  assert.equal(isAdminGroups(normalizeGroups(["Admins"])), true);
});

test("password policy matches the V1 rules", () => {
  assert.equal(passwordIssue("short1!"), "Use at least 8 characters.");
  assert.equal(passwordIssue("lowercase1!"), "Include an uppercase letter.");
  assert.equal(passwordIssue("ValidPass1!"), null);
});

test("auth errors stay user-safe", () => {
  assert.equal(mapAuthError({ name: "NotAuthorizedException", message: "raw cognito text" }), "Email or password is incorrect.");
  assert.equal(mapAuthError({ name: "UsernameExistsException" }), "An account with this email already exists. Try logging in.");
  assert.match(mapAuthError({ name: "ExpiredCodeException" }), /expired/i);
  assert.equal(mapAuthError(new Error("Failed to fetch")), "We could not reach the authentication service. Check your connection and try again.");
  assert.equal(mapAuthError({ name: "SomethingElse", message: "User pool abc leaked" }), "Something went wrong. Please try again.");
  assert.equal(mapRecoveryRequestError({ name: "UserNotFoundException" }), null);
  assert.match(mapRecoveryRequestError({ name: "LimitExceededException" }) ?? "", /Too many/);
});

test("referral handoff stores only a trimmed pending code", () => {
  const saved = new Map<string, string>();
  const storage = {
    setItem(key: string, value: string) {
      saved.set(key, value);
    },
    removeItem(key: string) {
      saved.delete(key);
    },
    getItem(key: string) {
      return saved.get(key) ?? null;
    },
  };
  rememberPendingReferral(storage, "  QW12345  ");
  assert.equal(saved.get(PENDING_REFERRAL_KEY), "QW12345");
  rememberPendingReferral(storage, "   ");
  assert.equal(saved.has(PENDING_REFERRAL_KEY), false);
  assert.equal(normalizeReferralCode("x".repeat(80)).length, 64);
});

test("empty cognito identifiers are not treated as configured", () => {
  assert.equal(
    isAuthConfigured({
      region: "ap-south-1",
      userPoolId: "",
      clientId: "",
    }),
    false,
  );
  assert.equal(
    isAuthConfigured({
      region: "ap-south-1",
      userPoolId: "ap-south-1_EXAMPLE",
      clientId: "exampleclient",
    }),
    false,
  );
});
