import { registrationPhoneKey, type CompleteMemberResult, type CreateResult, type MemberCompletion, type MemberRecord, type MemberStore, type ProfilePatch } from "./service.ts";

export function createMemoryMemberStore(): MemberStore {
  const members = new Map<string, MemberRecord>();
  const codes = new Map<string, string>();
  const phones = new Map<string, string>();

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
      return registrationConflict([...members.values()], phones, userId, email, phone);
    },
    async getPhoneOwner(phone) {
      const key = registrationPhoneKey(phone);
      if (!key) {
        return null;
      }
      return phones.get(key) ?? null;
    },
    async createMember(member): Promise<CreateResult> {
      if (members.has(member.userId)) {
        return "exists";
      }
      const conflict = registrationConflict([...members.values()], phones, member.userId, member.email, member.phone);
      if (conflict === "email") {
        return "email-taken";
      }
      if (conflict === "phone") {
        return "phone-taken";
      }
      if (codes.has(member.referralCode)) {
        return "referral-taken";
      }
      const phoneKey = registrationPhoneKey(member.phone);
      members.set(member.userId, structuredClone(member));
      codes.set(member.referralCode, member.userId);
      if (phoneKey) {
        phones.set(phoneKey, member.userId);
      }
      return "created";
    },
    async completeMember(userId, fill: MemberCompletion): Promise<CompleteMemberResult> {
      const current = members.get(userId);
      if (!current) {
        return { result: "missing", member: null };
      }
      if (
        current.email !== fill.email ||
        current.referralCode !== fill.referralCode ||
        !sameIdentity(current.sponsorUserId, fill.sponsorUserId) ||
        !sameIdentity(current.sponsorReferralCode, fill.sponsorReferralCode)
      ) {
        return { result: "conflict", member: structuredClone(current) };
      }
      const next: MemberRecord = {
        ...current,
        email: current.email,
        referralCode: current.referralCode,
        sponsorUserId: current.sponsorUserId,
        sponsorReferralCode: current.sponsorReferralCode,
      };
      let changed = false;
      if (fill.firstName && blank(current.firstName)) {
        next.firstName = fill.firstName;
        changed = true;
      }
      if (fill.lastName && blank(current.lastName)) {
        next.lastName = fill.lastName;
        changed = true;
      }
      if (fill.name && blank(current.name)) {
        next.name = fill.name;
        changed = true;
      }
      if (fill.phone && blank(current.phone)) {
        next.phone = fill.phone;
        changed = true;
      }
      if (fill.country && blank(current.country)) {
        next.country = fill.country;
        changed = true;
      }
      if (fill.transactionPasswordHash && blank(current.transactionPasswordHash)) {
        next.transactionPasswordHash = fill.transactionPasswordHash;
        changed = true;
      }
      const requestedPhone = fill.phone ?? fill.ensurePhone;
      const requestedKey = registrationPhoneKey(requestedPhone);
      const storedKey = registrationPhoneKey(next.phone);
      if (requestedKey && requestedKey !== storedKey) {
        return { result: "conflict", member: structuredClone(current) };
      }
      const phoneKey = requestedKey;
      if (phoneKey && phoneOwnedByOther([...members.values()], phones, userId, phoneKey)) {
        return { result: "phone-taken", member: structuredClone(current) };
      }

      const priorPhoneOwner = phoneKey ? phones.get(phoneKey) : undefined;
      if (changed) {
        next.updatedAt = fill.updatedAt;
        members.set(userId, next);
      }
      if (phoneKey && priorPhoneOwner !== userId) {
        const occupied = phones.get(phoneKey);
        if (occupied && occupied !== userId) {
          if (changed) {
            members.set(userId, current);
          }
          return { result: "phone-taken", member: structuredClone(current) };
        }
        phones.set(phoneKey, userId);
      }
      return { result: "updated", member: structuredClone(changed ? next : current) };
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

function blank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

function phoneOwnedByOther(
  records: readonly MemberRecord[],
  phoneOwners: ReadonlyMap<string, string>,
  userId: string,
  phoneKey: string,
): boolean {
  const owner = phoneOwners.get(phoneKey);
  if (owner && owner !== userId) {
    return true;
  }
  return records.some((member) => member.userId !== userId && registrationPhoneKey(member.phone) === phoneKey);
}

function sameIdentity(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalize = (value: string | null | undefined) => (value === null || value === undefined || value === "" ? null : value);
  return normalize(left) === normalize(right);
}

export function memberRegistrationConflict(
  records: readonly MemberRecord[],
  phoneOwners: ReadonlyMap<string, string>,
  userId: string,
  email: string,
  phone: string | null,
): "email" | "phone" | null {
  return registrationConflict(records, phoneOwners, userId, email, phone);
}

function registrationConflict(
  records: readonly MemberRecord[],
  phoneOwners: ReadonlyMap<string, string>,
  userId: string,
  email: string,
  phone: string | null,
): "email" | "phone" | null {
  const emailKey = email.trim().toLowerCase();
  const phoneKey = registrationPhoneKey(phone);
  let emailConflict = false;
  let phoneConflict = false;
  for (const current of records) {
    if (current.userId === userId) {
      continue;
    }
    if (current.email.trim().toLowerCase() === emailKey) {
      emailConflict = true;
    }
    if (phoneKey && registrationPhoneKey(current.phone) === phoneKey) {
      phoneConflict = true;
    }
  }
  if (phoneKey) {
    const owner = phoneOwners.get(phoneKey);
    if (owner && owner !== userId) {
      phoneConflict = true;
    }
  }
  if (phoneConflict) {
    return "phone";
  }
  if (emailConflict) {
    return "email";
  }
  return null;
}
