/**
 * Temporary handoff only. This is not referral genealogy.
 * Step 04 should read this once, store the relationship in DynamoDB, then remove the key.
 * Do not copy this value into Cognito custom attributes.
 */
export const PENDING_REFERRAL_KEY = "qw_pending_referral_code";

export const RESET_EMAIL_KEY = "qw_password_reset_email";

const MAX_REFERRAL_LENGTH = 64;

export function normalizeReferralCode(value: string): string {
  return value.trim().slice(0, MAX_REFERRAL_LENGTH);
}

export function rememberPendingReferral(storage: Pick<Storage, "setItem" | "removeItem">, code: string): void {
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    storage.removeItem(PENDING_REFERRAL_KEY);
    return;
  }
  storage.setItem(PENDING_REFERRAL_KEY, normalized);
}

export function readPendingReferral(storage: Pick<Storage, "getItem">): string {
  return storage.getItem(PENDING_REFERRAL_KEY) ?? "";
}
