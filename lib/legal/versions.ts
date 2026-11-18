export const TERMS_VERSION = "1.0";
export const PRIVACY_VERSION = "1.0";

export type LegalAcceptanceMethod = "registration";

export type LegalAcceptanceRecord = {
  acceptanceId: string;
  memberId: string;
  termsVersion: typeof TERMS_VERSION;
  privacyVersion: typeof PRIVACY_VERSION;
  acceptedAt: string;
  acceptanceMethod: LegalAcceptanceMethod;
};

export function registrationAcceptanceId(memberId: string): string {
  return `acc_${memberId}_${TERMS_VERSION}_${PRIVACY_VERSION}`;
}
