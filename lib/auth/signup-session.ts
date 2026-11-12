export type SignupPrincipal = {
  sub: string;
  email: string;
};

/**
 * In-memory only. Callers may keep this for the current page session.
 * Do not write it to browser storage or logs.
 */
export type ReadyAccount = {
  email: string;
  password: string;
  sub: string;
};

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function readyAccountStillValid(
  ready: ReadyAccount | null,
  submitted: { email: string; password: string },
  current: SignupPrincipal | null,
): boolean {
  if (!ready || !current || !ready.sub || !current.sub) {
    return false;
  }
  const email = normalizeSignupEmail(submitted.email);
  return ready.email === email && ready.password === submitted.password && ready.sub === current.sub && current.email === email;
}

export function canInitializeSubmittedAccount(
  ready: ReadyAccount | null,
  principal: SignupPrincipal | null,
  submittedEmail: string,
): boolean {
  if (!ready || !principal || !ready.sub || !principal.sub) {
    return false;
  }
  const email = normalizeSignupEmail(submittedEmail);
  return ready.email === email && ready.sub === principal.sub && principal.email === email;
}
