import { registrationPhoneKey, type CreateResult, type MemberRecord, type MemberStore, type ProfilePatch } from "./service.ts";

export function createMemoryMemberStore(): MemberStore {
  const members = new Map<string, MemberRecord>();
  const codes = new Map<string, string>();

  return {
    async getByUserId(userId) {
      const found = members.get(userId);
      return found ? structuredClone(found) : null;
    },
    async getUserIdByReferralCode(code) {
      return codes.get(code) ?? null;
    },
    async listMembers() {
      return [...members.values()].map((member) => structuredClone(member));
    },
    async findRegistrationConflict({ userId, email, phone }) {
      return registrationConflict([...members.values()], userId, email, phone);
    },
    async createMember(member): Promise<CreateResult> {
      if (members.has(member.userId)) {
        return "exists";
      }
      const conflict = registrationConflict([...members.values()], member.userId, member.email, member.phone);
      if (conflict === "email") {
        return "email-taken";
      }
      if (conflict === "phone") {
        return "phone-taken";
      }
      if (codes.has(member.referralCode)) {
        return "referral-taken";
      }
      members.set(member.userId, structuredClone(member));
      codes.set(member.referralCode, member.userId);
      return "created";
    },
    async updateProfile(userId, patch: ProfilePatch) {
      const current = members.get(userId);
      if (!current) {
        return null;
      }
      const next: MemberRecord = {
        ...current,
        name: patch.name ?? current.name,
        phone: patch.phone === undefined ? current.phone : patch.phone,
        country: patch.country === undefined ? current.country : patch.country,
        updatedAt: patch.updatedAt,
      };
      members.set(userId, next);
      return structuredClone(next);
    },
    async setTransactionPassword(userId, hash, updatedAt) {
      const current = members.get(userId);
      if (!current) {
        return null;
      }
      const next: MemberRecord = {
        ...current,
        transactionPasswordHash: hash,
        updatedAt,
      };
      members.set(userId, next);
      return structuredClone(next);
    },
    async setProfilePhoto(userId, profilePhotoKey, updatedAt) {
      const current = members.get(userId);
      if (!current) {
        return null;
      }
      const next: MemberRecord = {
        ...current,
        profilePhotoKey,
        updatedAt,
      };
      members.set(userId, next);
      return structuredClone(next);
    },
  };
}

function registrationConflict(
  records: readonly MemberRecord[],
  userId: string,
  email: string,
  phone: string | null,
): "email" | "phone" | null {
  const emailKey = email.trim().toLowerCase();
  const phoneKey = registrationPhoneKey(phone);
  for (const current of records) {
    if (current.userId === userId) {
      continue;
    }
    if (current.email.trim().toLowerCase() === emailKey) {
      return "email";
    }
    if (phoneKey && registrationPhoneKey(current.phone) === phoneKey) {
      return "phone";
    }
  }
  return null;
}
