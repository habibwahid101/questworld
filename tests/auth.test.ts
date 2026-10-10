import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isAuthConfigured, readAuthConfig } from "../lib/auth/config.ts";
import {
  changeLoginPasswordWithDeps,
  confirmPasswordResetWithDeps,
  getIdTokenWithDeps,
  loadCurrentUserWithDeps,
  loginAccountWithDeps,
  logoutAccountWithDeps,
  registerAccountWithDeps,
  requestPasswordResetWithDeps,
  type AuthFlowDeps,
} from "../lib/auth/cognito.ts";
import { mapAuthError, mapRecoveryRequestError } from "../lib/auth/errors.ts";
import { isAdminGroups, normalizeGroups } from "../lib/auth/groups.ts";
import { passwordIssue } from "../lib/auth/password.ts";
import { isAdminPath, isMemberPath, isProtectedPath } from "../lib/auth/paths.ts";
import { normalizeReferralCode, rememberPendingReferral, PENDING_REFERRAL_KEY } from "../lib/auth/referral.ts";

test("member routes are protected and public referral page is not", () => {
  assert.equal(isMemberPath("/dashboard"), true);
  assert.equal(isMemberPath("/investments"), true);
  assert.equal(isMemberPath("/investments/inv_1"), true);
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

test("password policy is at least 8 characters", () => {
  assert.equal(passwordIssue("short"), "Use at least 8 characters.");
  assert.equal(passwordIssue("lowercase"), null);
  assert.equal(passwordIssue("simplepass"), null);
  const auth = readFileSync(new URL("../infrastructure/lib/auth-stack.ts", import.meta.url), "utf8");
  assert.match(auth, /minLength: 8/);
  assert.match(auth, /requireLowercase: false/);
  assert.match(auth, /requireUppercase: false/);
  assert.match(auth, /requireDigits: false/);
  assert.match(auth, /requireSymbols: false/);
  assert.doesNotMatch(auth, /requireUppercase: true/);
});

test("auth errors stay user-safe", () => {
  assert.equal(mapAuthError({ name: "NotAuthorizedException", message: "raw cognito text" }), "Email or password is incorrect.");
  assert.equal(mapAuthError({ name: "UsernameExistsException" }), "An account with this email already exists. Try logging in.");
  assert.match(mapAuthError({ name: "ExpiredCodeException" }), /expired/i);
  assert.equal(mapAuthError(new Error("Failed to fetch")), "We could not reach the authentication service. Check your connection and try again.");
  assert.equal(mapAuthError({ name: "SomethingElse", message: "User pool abc leaked" }), "Something went wrong. Please try again.");
  assert.equal(
    mapAuthError(new Error("Amplify has not been configured. Please call Amplify.configure() before using this service.")),
    "Authentication is still starting. Refresh the page and try again.",
  );
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

function recordingDeps(remembered: boolean) {
  const events: string[] = [];
  let remember = remembered;
  const deps: AuthFlowDeps = {
    async ensureConfigured() {
      events.push("configure");
    },
    async setTokenStorage(next) {
      events.push(next ? "storage-local" : "storage-session");
    },
    readRemember() {
      return remember;
    },
    writeRemember(next) {
      remember = next;
      events.push(next ? "flag-on" : "flag-off");
    },
    async signUp() {
      events.push("signUp");
      return { nextStep: { signUpStep: "DONE" } };
    },
    async signIn() {
      events.push("signIn");
      return { nextStep: { signInStep: "DONE" } };
    },
    async signOut() {
      events.push("signOut");
    },
    async resetPassword() {
      events.push("resetPassword");
    },
    async confirmResetPassword() {
      events.push("confirmResetPassword");
    },
    async getCurrentUser() {
      events.push("getCurrentUser");
      return { username: "member@example.com", signInDetails: { loginId: "member@example.com" } };
    },
    async fetchAuthSession() {
      events.push("fetchAuthSession");
      return { tokens: { idToken: { toString: () => "token", payload: { sub: "member-1" } } } };
    },
    async updatePassword() {
      events.push("updatePassword");
    },
  };
  return {
    deps,
    events,
    remembered: () => remember,
  };
}

test("a fresh page load configures Amplify before token storage and the session read", async () => {
  const remembered = recordingDeps(true);
  const user = await loadCurrentUserWithDeps(remembered.deps);
  assert.deepEqual(remembered.events, ["configure", "storage-local", "getCurrentUser", "fetchAuthSession"]);
  assert.equal(user?.email, "member@example.com");
  assert.ok(remembered.events.indexOf("configure") < remembered.events.indexOf("storage-local"));
  assert.ok(remembered.events.indexOf("storage-local") < remembered.events.indexOf("getCurrentUser"));

  const guest = recordingDeps(false);
  await loadCurrentUserWithDeps(guest.deps);
  assert.equal(guest.events[0], "configure");
  assert.equal(guest.events[1], "storage-session");

  const token = recordingDeps(true);
  assert.equal(await getIdTokenWithDeps(token.deps), "token");
  assert.deepEqual(token.events, ["configure", "storage-local", "fetchAuthSession"]);
});

test("login from a fresh page configures Amplify before storage and sign-in", async () => {
  const checked = recordingDeps(false);
  await loginAccountWithDeps(checked.deps, { email: "A@Example.com", password: "ValidPass1!", remember: true });
  assert.deepEqual(checked.events, ["configure", "storage-local", "flag-on", "signIn"]);
  assert.equal(checked.remembered(), true);

  const unchecked = recordingDeps(true);
  await loginAccountWithDeps(unchecked.deps, { email: "member@example.com", password: "ValidPass1!", remember: false });
  assert.deepEqual(unchecked.events, ["configure", "storage-session", "flag-off", "signIn"]);
  assert.equal(unchecked.remembered(), false);
});

test("password, logout, and signup calls configure Amplify before the auth request", async () => {
  const signup = recordingDeps(false);
  await registerAccountWithDeps(signup.deps, { name: "Member", email: "member@example.com", password: "ValidPass1!" });
  assert.deepEqual(signup.events, ["configure", "signUp"]);

  const reset = recordingDeps(false);
  await requestPasswordResetWithDeps(reset.deps, "member@example.com");
  assert.deepEqual(reset.events, ["configure", "resetPassword"]);

  const confirm = recordingDeps(false);
  await confirmPasswordResetWithDeps(confirm.deps, { email: "member@example.com", code: "123456", password: "ValidPass1!" });
  assert.deepEqual(confirm.events, ["configure", "confirmResetPassword"]);

  const logout = recordingDeps(true);
  await logoutAccountWithDeps(logout.deps);
  assert.deepEqual(logout.events, ["configure", "signOut"]);
  assert.equal(logout.events.includes("storage-local"), false);
});

test("changing the login password configures Amplify first and does not store the password", async () => {
  const recorded = recordingDeps(true);
  let captured: { oldPassword: string; newPassword: string } | null = null;
  recorded.deps.updatePassword = async (input) => {
    captured = input;
    recorded.events.push("updatePassword");
  };
  await changeLoginPasswordWithDeps(recorded.deps, { currentPassword: "OldPass1!", nextPassword: "NewPass1!" });
  assert.deepEqual(recorded.events, ["configure", "updatePassword"]);
  assert.deepEqual(captured, { oldPassword: "OldPass1!", newPassword: "NewPass1!" });
  assert.equal(recorded.events.includes("OldPass1!"), false);

  const weak = recordingDeps(true);
  await assert.rejects(() => changeLoginPasswordWithDeps(weak.deps, { currentPassword: "OldPass1!", nextPassword: "short" }));
  assert.deepEqual(weak.events, []);
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

test("blank env uses the deployed public cognito configuration", () => {
  const config = readAuthConfig({
    NEXT_PUBLIC_AWS_REGION: " ",
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: "",
    NEXT_PUBLIC_COGNITO_CLIENT_ID: undefined,
  });
  assert.deepEqual(config, {
    region: "ap-south-1",
    userPoolId: "ap-south-1_X2ibT0rBo",
    clientId: "4djbqt27hj54c3tu5754g4pvgt",
  });
  assert.equal(isAuthConfigured(config), true);
});

test("explicit public env overrides the deployed cognito configuration", () => {
  const config = readAuthConfig({
    NEXT_PUBLIC_AWS_REGION: "ap-south-1",
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: "ap-south-1_OverridePool",
    NEXT_PUBLIC_COGNITO_CLIENT_ID: "overrideclientid1",
  });
  assert.equal(config.userPoolId, "ap-south-1_OverridePool");
  assert.equal(config.clientId, "overrideclientid1");
  assert.equal(isAuthConfigured(config), true);
});
