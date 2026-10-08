import { getIdToken } from "@/lib/auth/cognito";
import { isMemberApiConfigured, readMemberApiUrl } from "@/lib/members/config";
import type { ListedMember, MemberProfile } from "@/lib/members/service";

export class MemberClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MemberClientError";
    this.code = code;
  }
}

export async function initializeCurrentMember(
  referralCode: string,
  profile?: { firstName: string; lastName: string; phone: string } | null,
): Promise<MemberProfile> {
  const body: Record<string, string> = {};
  if (referralCode) {
    body.referralCode = referralCode;
  }
  if (profile) {
    body.firstName = profile.firstName;
    body.lastName = profile.lastName;
    body.phone = profile.phone;
  }
  return memberRequest("POST", "/me/initialize", body);
}

export async function readCurrentMember(): Promise<MemberProfile> {
  return memberRequest("GET", "/me");
}

export async function updateCurrentMember(patch: {
  name?: string;
  phone?: string | null;
  country?: string | null;
}): Promise<MemberProfile> {
  return memberRequest("PATCH", "/me", patch);
}

export async function listStoredMembers(): Promise<ListedMember[]> {
  const payload = await memberJson("GET", "/admin/members");
  if (!Array.isArray(payload.members) || !payload.members.every(isListedMember)) {
    throw new MemberClientError("member_request_failed", "Could not load members.");
  }
  return payload.members;
}

async function memberRequest(method: string, path: string, body?: unknown): Promise<MemberProfile> {
  const payload = await memberJson(method, path, body);
  if (!payload.member || !isMemberProfile(payload.member)) {
    throw new MemberClientError(payload.error || "member_request_failed", payload.message || "Could not load your member profile.");
  }
  return payload.member;
}

async function memberJson(method: string, path: string, body?: unknown): Promise<{ member?: MemberProfile; members?: unknown; error?: string; message?: string }> {
  const base = readMemberApiUrl();
  if (!isMemberApiConfigured(base)) {
    throw new MemberClientError("not_configured", "Member profiles are not connected in this build.");
  }
  const token = await getIdToken();
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = ((await response.json().catch(() => null)) ?? {}) as { member?: MemberProfile; members?: unknown; error?: string; message?: string };
  if (!response.ok) {
    throw new MemberClientError(payload.error || "member_request_failed", payload.message || "Could not load your member profile.");
  }
  return payload;
}

function isMemberProfile(value: unknown): value is MemberProfile {
  return Boolean(value && typeof value === "object");
}

function isListedMember(value: unknown): value is ListedMember {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as ListedMember;
  return (
    typeof record.name === "string" &&
    typeof record.email === "string" &&
    (record.role === "Admin" || record.role === "Member") &&
    typeof record.referralCode === "string" &&
    (record.sponsorReferralCode === null || typeof record.sponsorReferralCode === "string")
  );
}
