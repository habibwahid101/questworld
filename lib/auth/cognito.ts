import { isAuthConfigured, readAuthConfig } from "./config.ts";
import { passwordIssue } from "./password.ts";

export class AuthConfigError extends Error {
  name = "ConfigError";

  constructor() {
    super("Authentication is not configured.");
  }
}

export class SignupConfirmationError extends Error {
  name = "SignupConfirmationError";

  constructor() {
    super("Automatic signup confirmation did not complete.");
  }
}

let configured = false;

/**
 * Idempotent. Every auth call goes through this before token storage or Amplify Auth.
 */
export async function ensureAmplifyConfigured(): Promise<void> {
  if (!isAuthConfigured()) {
    throw new AuthConfigError();
  }
  if (configured) {
    return;
  }
  const { Amplify } = await import("aws-amplify");
  const { userPoolId, clientId } = readAuthConfig();
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        loginWith: { email: true },
      },
    },
  });
  configured = true;
}

async function applyTokenStorage(remember: boolean): Promise<void> {
  const { cognitoUserPoolsTokenProvider } = await import("aws-amplify/auth/cognito");
  const { defaultStorage, sessionStorage } = await import("aws-amplify/utils");
  cognitoUserPoolsTokenProvider.setKeyValueStorage(remember ? defaultStorage : sessionStorage);
}

function readRememberFlag(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem("qw_remember") === "1";
}

function writeRememberFlag(remember: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  if (remember) {
    window.localStorage.setItem("qw_remember", "1");
  } else {
    window.localStorage.removeItem("qw_remember");
  }
}

export type AuthFlowDeps = {
  ensureConfigured: () => Promise<void>;
  setTokenStorage: (remember: boolean) => Promise<void>;
  readRemember: () => boolean;
  writeRemember: (remember: boolean) => void;
  signUp: (input: {
    username: string;
    password: string;
    options: { userAttributes: { email: string; name: string } };
  }) => Promise<{ nextStep: { signUpStep: string } }>;
  signIn: (input: { username: string; password: string }) => Promise<{ nextStep: { signInStep: string } }>;
  signOut: () => Promise<void>;
  resetPassword: (input: { username: string }) => Promise<unknown>;
  confirmResetPassword: (input: { username: string; confirmationCode: string; newPassword: string }) => Promise<unknown>;
  getCurrentUser: () => Promise<{ username: string; signInDetails?: { loginId?: string } }>;
  fetchAuthSession: () => Promise<{ tokens?: { idToken?: { toString: () => string; payload?: Record<string, unknown> } } }>;
  updatePassword: (input: { oldPassword: string; newPassword: string }) => Promise<void>;
};

async function productionDeps(): Promise<AuthFlowDeps> {
  await ensureAmplifyConfigured();
  const auth = await import("aws-amplify/auth");
  return {
    ensureConfigured: ensureAmplifyConfigured,
    setTokenStorage: applyTokenStorage,
    readRemember: readRememberFlag,
    writeRemember: writeRememberFlag,
    signUp: auth.signUp,
    signIn: auth.signIn,
    signOut: auth.signOut,
    resetPassword: auth.resetPassword,
    confirmResetPassword: auth.confirmResetPassword,
    getCurrentUser: auth.getCurrentUser,
    fetchAuthSession: auth.fetchAuthSession,
    updatePassword: auth.updatePassword,
  };
}

export async function setRememberMe(remember: boolean): Promise<void> {
  await ensureAmplifyConfigured();
  await applyTokenStorage(remember);
  writeRememberFlag(remember);
}

export async function applyStoredRememberMe(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  await setRememberMe(readRememberFlag());
}

export async function registerAccountWithDeps(
  deps: AuthFlowDeps,
  input: { name: string; email: string; password: string },
): Promise<void> {
  await deps.ensureConfigured();
  const email = input.email.trim().toLowerCase();
  const result = await deps.signUp({
    username: email,
    password: input.password,
    options: {
      userAttributes: {
        email,
        name: input.name.trim(),
      },
    },
  });
  if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
    throw new SignupConfirmationError();
  }
}

export async function registerAccount(input: { name: string; email: string; password: string }): Promise<void> {
  await registerAccountWithDeps(await productionDeps(), input);
}

export async function loginAccountWithDeps(
  deps: AuthFlowDeps,
  input: { email: string; password: string; remember: boolean },
): Promise<void> {
  await deps.ensureConfigured();
  await deps.setTokenStorage(input.remember);
  deps.writeRemember(input.remember);
  const result = await deps.signIn({
    username: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (result.nextStep.signInStep !== "DONE") {
    throw new SignupConfirmationError();
  }
}

export async function loginAccount(input: { email: string; password: string; remember: boolean }): Promise<void> {
  await loginAccountWithDeps(await productionDeps(), input);
}

export async function logoutAccountWithDeps(deps: AuthFlowDeps): Promise<void> {
  await deps.ensureConfigured();
  await deps.signOut();
}

export async function logoutAccount(): Promise<void> {
  await logoutAccountWithDeps(await productionDeps());
}

export async function requestPasswordResetWithDeps(deps: AuthFlowDeps, email: string): Promise<void> {
  await deps.ensureConfigured();
  await deps.resetPassword({ username: email.trim().toLowerCase() });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await requestPasswordResetWithDeps(await productionDeps(), email);
}

export async function confirmPasswordResetWithDeps(
  deps: AuthFlowDeps,
  input: { email: string; code: string; password: string },
): Promise<void> {
  await deps.ensureConfigured();
  await deps.confirmResetPassword({
    username: input.email.trim().toLowerCase(),
    confirmationCode: input.code.trim(),
    newPassword: input.password,
  });
}

export async function confirmPasswordReset(input: { email: string; code: string; password: string }): Promise<void> {
  await confirmPasswordResetWithDeps(await productionDeps(), input);
}

export async function changeLoginPasswordWithDeps(
  deps: AuthFlowDeps,
  input: { currentPassword: string; nextPassword: string },
): Promise<void> {
  const issue = passwordIssue(input.nextPassword);
  if (issue) {
    throw new Error(issue);
  }
  await deps.ensureConfigured();
  await deps.updatePassword({ oldPassword: input.currentPassword, newPassword: input.nextPassword });
}

export async function changeLoginPassword(input: { currentPassword: string; nextPassword: string }): Promise<void> {
  await changeLoginPasswordWithDeps(await productionDeps(), input);
}

export async function getIdTokenWithDeps(deps: AuthFlowDeps): Promise<string> {
  await deps.ensureConfigured();
  await deps.setTokenStorage(deps.readRemember());
  const session = await deps.fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new Error("Missing session token.");
  }
  return token;
}

export async function getIdToken(): Promise<string> {
  return getIdTokenWithDeps(await productionDeps());
}

export async function loadCurrentUserWithDeps(deps: AuthFlowDeps): Promise<{
  email: string;
  payload: Record<string, unknown> | undefined;
} | null> {
  await deps.ensureConfigured();
  await deps.setTokenStorage(deps.readRemember());
  try {
    const current = await deps.getCurrentUser();
    const session = await deps.fetchAuthSession();
    const payload = session.tokens?.idToken?.payload;
    return {
      email: current.signInDetails?.loginId ?? current.username,
      payload,
    };
  } catch {
    return null;
  }
}

export async function loadCurrentUser(): Promise<{
  email: string;
  payload: Record<string, unknown> | undefined;
} | null> {
  if (!isAuthConfigured()) {
    return null;
  }
  return loadCurrentUserWithDeps(await productionDeps());
}

