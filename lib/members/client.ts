import { getIdToken } from "@/lib/auth/cognito";
import { isMemberApiConfigured, readMemberApiUrl } from "@/lib/members/config";
import type { MemberProfile } from "@/lib/members/service";

export class MemberClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MemberClientError";
    this.code = code;
  }
}

export async function initializeCurrentMember(referralCode: string): Promise<MemberProfile> {
  const body = referralCode ? { referralCode } : {};
  const payload = await memberRequest("POST", "/me/initialize", body);
  return payload;
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

async function memberRequest(method: string, path: string, body?: unknown): Promise<MemberProfile> {
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
  const payload = (await response.json().catch(() => null)) as { member?: MemberProfile; error?: string; message?: string } | null;
  if (!response.ok || !payload?.member) {
    throw new MemberClientError(
      payload?.error || "member_request_failed",
      payload?.message || "Could not load your member profile.",
    );
  }
  return payload.member;
}
