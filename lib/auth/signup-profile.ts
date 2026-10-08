export const PENDING_SIGNUP_PROFILE_KEY = "qw_pending_signup_profile";

export type PendingSignupProfile = {
  firstName: string;
  lastName: string;
  phone: string;
};

export function rememberPendingSignupProfile(
  storage: Pick<Storage, "setItem">,
  profile: PendingSignupProfile,
): void {
  storage.setItem(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify(profile));
}

export function readPendingSignupProfile(storage: Pick<Storage, "getItem">): PendingSignupProfile | null {
  const raw = storage.getItem(PENDING_SIGNUP_PROFILE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PendingSignupProfile>;
    if (!parsed.firstName || !parsed.lastName || !parsed.phone) {
      return null;
    }
    return {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone,
    };
  } catch {
    return null;
  }
}

export function clearPendingSignupProfile(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(PENDING_SIGNUP_PROFILE_KEY);
}
