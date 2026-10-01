import { isAuthConfigured, readAuthConfig } from "@/lib/auth/config";

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

async function amplifyAuth() {
  if (!isAuthConfigured()) {
    throw new AuthConfigError();
  }

  const { Amplify } = await import("aws-amplify");
  const { userPoolId, clientId } = readAuthConfig();
  if (!configured) {
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
  return import("aws-amplify/auth");
}

async function tokenStorage() {
  return import("aws-amplify/auth/cognito");
}

export async function setRememberMe(remember: boolean): Promise<void> {
  const { cognitoUserPoolsTokenProvider } = await tokenStorage();
  const { defaultStorage, sessionStorage } = await import("aws-amplify/utils");
  cognitoUserPoolsTokenProvider.setKeyValueStorage(remember ? defaultStorage : sessionStorage);
  if (typeof window !== "undefined") {
    if (remember) {
      window.localStorage.setItem("qw_remember", "1");
    } else {
      window.localStorage.removeItem("qw_remember");
    }
  }
}

export async function applyStoredRememberMe(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  await setRememberMe(window.localStorage.getItem("qw_remember") === "1");
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  const { signUp } = await amplifyAuth();
  const email = input.email.trim().toLowerCase();
  const result = await signUp({
    username: email,
    password: input.password,
    options: {
      userAttributes: {
        email,
        name: input.name.trim(),
      },
    },
  });

  const step = result.nextStep.signUpStep;
  if (step === "CONFIRM_SIGN_UP") {
    throw new SignupConfirmationError();
  }
}

export async function loginAccount(input: {
  email: string;
  password: string;
  remember: boolean;
}): Promise<void> {
  await setRememberMe(input.remember);
  const { signIn } = await amplifyAuth();
  const result = await signIn({
    username: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (result.nextStep.signInStep !== "DONE") {
    throw new SignupConfirmationError();
  }
}

export async function logoutAccount(): Promise<void> {
  const { signOut } = await amplifyAuth();
  await signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { resetPassword } = await amplifyAuth();
  await resetPassword({ username: email.trim().toLowerCase() });
}

export async function confirmPasswordReset(input: {
  email: string;
  code: string;
  password: string;
}): Promise<void> {
  const { confirmResetPassword } = await amplifyAuth();
  await confirmResetPassword({
    username: input.email.trim().toLowerCase(),
    confirmationCode: input.code.trim(),
    newPassword: input.password,
  });
}

export async function getIdToken(): Promise<string> {
  await applyStoredRememberMe();
  const { fetchAuthSession } = await amplifyAuth();
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new Error("Missing session token.");
  }
  return token;
}

export async function loadCurrentUser(): Promise<{
  email: string;
  payload: Record<string, unknown> | undefined;
} | null> {
  if (!isAuthConfigured()) {
    return null;
  }
  await applyStoredRememberMe();
  const { getCurrentUser, fetchAuthSession } = await amplifyAuth();
  try {
    const current = await getCurrentUser();
    const session = await fetchAuthSession();
    const payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
    return {
      email: current.signInDetails?.loginId ?? current.username,
      payload,
    };
  } catch {
    return null;
  }
}
