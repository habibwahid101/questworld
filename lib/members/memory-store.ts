import type { CreateResult, MemberRecord, MemberStore, ProfilePatch } from "./service.ts";

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
    async createMember(member): Promise<CreateResult> {
      if (members.has(member.userId)) {
        return "exists";
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
  };
}
