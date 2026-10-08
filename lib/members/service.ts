import { passwordIssue } from "../auth/password.ts";
import { isAdminClaims } from "../investments/service.ts";
import { hashTransactionPassword, verifyTransactionPassword } from "./transaction-password.ts";

/**
 * Member profile rules for Step 04.
 * Cognito `sub` is the permanent member id. The client cannot choose it,
 * and it cannot choose a sponsor user id. A referral code is resolved here.
 */

export const MEMBER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type MemberStatus = "active";

export type MemberRecord = {
  userId: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  country: string | null;
  referralCode: string;
  sponsorUserId: string | null;
  sponsorReferralCode: string | null;
  transactionPasswordHash: string | null;
  createdAt: string;
  updatedAt: string;
  status: MemberStatus;
};

export type MemberProfile = Omit<MemberRecord, "sponsorUserId" | "transactionPasswordHash"> & {
  transactionPasswordSet: boolean;
};

export type ListedMember = {
  name: string;
  email: string;
  role: "Admin" | "Member";
  referralCode: string;
  sponsorReferralCode: string | null;
};

export type MemberIdentity = {
  userId: string;
  email: string;
  name: string;
};

export type CreateResult = "created" | "exists" | "referral-taken";

export type ProfilePatch = {
  name?: string;
  phone?: string | null;
  country?: string | null;
  updatedAt: string;
};

export type MemberStore = {
  getByUserId(userId: string): Promise<MemberRecord | null>;
  getUserIdByReferralCode(code: string): Promise<string | null>;
  listMembers(): Promise<MemberRecord[]>;
  createMember(member: MemberRecord): Promise<CreateResult>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<MemberRecord | null>;
  setTransactionPassword(userId: string, hash: string, updatedAt: string): Promise<MemberRecord | null>;
};

export class MemberRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "MemberRequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const CODE_PATTERN = /^[A-Z0-9]{4,32}$/;
const NAME_MAX = 80;
const PHONE_MAX = 32;
const COUNTRY_MAX = 56;

function toListedMembers(records: readonly MemberRecord[], adminIds: readonly string[]): ListedMember[] {
  const admins = new Set(adminIds.map((id) => id.trim().toLowerCase()).filter((id) => id.length > 0));
  return records
    .map((record) => ({
      name: record.name,
      email: record.email,
      role: admins.has(record.userId.toLowerCase()) || admins.has(record.email.toLowerCase()) ? "Admin" as const : "Member" as const,
      referralCode: record.referralCode,
      sponsorReferralCode: record.sponsorReferralCode,
    }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.email.localeCompare(right.email));
}

export function toMemberProfile(record: MemberRecord): MemberProfile {
  return {
    userId: record.userId,
    email: record.email,
    name: record.name,
    firstName: record.firstName,
    lastName: record.lastName,
    phone: record.phone,
    country: record.country,
    referralCode: record.referralCode,
    sponsorReferralCode: record.sponsorReferralCode,
    transactionPasswordSet: Boolean(record.transactionPasswordHash),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
  };
}

export function normalizeMemberReferralCode(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toUpperCase();
}

export function createReferralCode(randomByte: () => number = randomAlphabetByte): string {
  let code = "QW";
  for (let index = 0; index < 8; index += 1) {
    code += MEMBER_CODE_ALPHABET[randomByte() % MEMBER_CODE_ALPHABET.length];
  }
  return code;
}

function randomAlphabetByte(): number {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] ?? 0;
}

export function identityFromClaims(
  claims: Record<string, unknown> | undefined,
): MemberIdentity | null {
  if (!claims) {
    return null;
  }
  const userId = stringClaim(claims.sub);
  const email = stringClaim(claims.email).toLowerCase();
  if (!userId || !email || !email.includes("@")) {
    return null;
  }
  const name = stringClaim(claims.name) || email.split("@")[0] || "Member";
  return {
    userId,
    email,
    name: clampName(name),
  };
}

export async function initializeMember(input: {
  identity: MemberIdentity;
  referralCode?: string;
  profile?: { firstName: string; lastName: string; phone: string } | null;
  store: MemberStore;
  now: () => string;
  newReferralCode?: () => string;
}): Promise<MemberRecord> {
  const existing = await input.store.getByUserId(input.identity.userId);
  if (existing) {
    return existing;
  }

  const requested = normalizeMemberReferralCode(input.referralCode);
  const sponsor = await resolveSponsor(input.store, input.identity.userId, requested);
  const nextCode = input.newReferralCode ?? createReferralCode;
  const timestamp = input.now();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const referralCode = nextCode();
    if (!CODE_PATTERN.test(referralCode)) {
      throw new MemberRequestError(500, "code_generation_failed", "Could not create a member profile.");
    }
    const member: MemberRecord = {
      userId: input.identity.userId,
      email: input.identity.email,
      name: input.profile ? clampName(`${input.profile.firstName} ${input.profile.lastName}`) : clampName(input.identity.name),
      firstName: input.profile?.firstName ?? null,
      lastName: input.profile?.lastName ?? null,
      phone: input.profile?.phone ?? null,
      country: null,
      referralCode,
      sponsorUserId: sponsor?.userId ?? null,
      sponsorReferralCode: sponsor?.code ?? null,
      transactionPasswordHash: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: "active",
    };
    const result = await input.store.createMember(member);
    if (result === "created") {
      return member;
    }
    if (result === "exists") {
      const raced = await input.store.getByUserId(input.identity.userId);
      if (raced) {
        return raced;
      }
    }
  }

  throw new MemberRequestError(500, "code_generation_failed", "Could not create a member profile.");
}

export async function patchMember(input: {
  userId: string;
  body: unknown;
  store: MemberStore;
  now: () => string;
}): Promise<MemberRecord> {
  const current = await input.store.getByUserId(input.userId);
  if (!current) {
    throw new MemberRequestError(404, "member_not_found", "Create your member profile first.");
  }

  const changes = editableChanges(input.body);
  if (!changes.hasEdits) {
    throw new MemberRequestError(400, "invalid_body", "No editable profile fields were provided.");
  }

  const updated = await input.store.updateProfile(input.userId, {
    ...changes.patch,
    updatedAt: input.now(),
  });
  if (!updated) {
    throw new MemberRequestError(404, "member_not_found", "Create your member profile first.");
  }
  return updated;
}

async function setTransactionPassword(input: {
  userId: string;
  body: unknown;
  store: MemberStore;
  now: () => string;
}): Promise<MemberRecord> {
  const current = await input.store.getByUserId(input.userId);
  if (!current) {
    throw new MemberRequestError(404, "member_not_found", "Create your member profile first.");
  }
  const nextPassword = transactionPasswordFromBody(input.body);
  const issue = passwordIssue(nextPassword);
  if (issue) {
    throw new MemberRequestError(400, "invalid_body", issue);
  }
  if (current.transactionPasswordHash) {
    const currentPassword = currentTransactionPasswordFromBody(input.body);
    if (!currentPassword || !verifyTransactionPassword(currentPassword, current.transactionPasswordHash)) {
      throw new MemberRequestError(403, "transaction_password_rejected", "The transaction password is not correct.");
    }
  }
  const hash = hashTransactionPassword(nextPassword);
  const updated = await input.store.setTransactionPassword(input.userId, hash, input.now());
  if (!updated) {
    throw new MemberRequestError(404, "member_not_found", "Create your member profile first.");
  }
  return updated;
}

function requestsTransactionPassword(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) && "transactionPassword" in body);
}

function transactionPasswordFromBody(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MemberRequestError(400, "invalid_body", "Enter a transaction password.");
  }
  const source = body as Record<string, unknown>;
  const allowed = new Set(["transactionPassword", "currentTransactionPassword"]);
  if (Object.keys(source).some((key) => !allowed.has(key))) {
    throw new MemberRequestError(400, "invalid_body", "Change the transaction password separately.");
  }
  if (typeof source.transactionPassword !== "string" || source.transactionPassword.length === 0) {
    throw new MemberRequestError(400, "invalid_body", "Enter a transaction password.");
  }
  return source.transactionPassword;
}

function currentTransactionPasswordFromBody(body: unknown): string {
  const source = body as Record<string, unknown>;
  if (!("currentTransactionPassword" in source) || source.currentTransactionPassword === "") {
    return "";
  }
  if (typeof source.currentTransactionPassword !== "string") {
    throw new MemberRequestError(400, "invalid_body", "Enter the current transaction password.");
  }
  return source.currentTransactionPassword;
}

export async function handleMemberApi(input: {
  method: string;
  path: string;
  claims?: Record<string, unknown>;
  body?: unknown;
  store: MemberStore;
  now?: () => string;
  newReferralCode?: () => string;
  adminUserIds?: () => Promise<readonly string[]>;
}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const identity = identityFromClaims(input.claims);
  if (!identity) {
    return errorBody(401, "unauthorized", "Sign in to continue.");
  }

  const now = input.now ?? (() => new Date().toISOString());
  const path = normalizePath(input.path);
  const method = input.method.toUpperCase();

  try {
    if (method === "POST" && path === "/me/initialize") {
      const referralCode = referralFromBody(input.body);
      const profile = profileFromBody(input.body);
      const record = await initializeMember({
        identity,
        referralCode,
        profile,
        store: input.store,
        now,
        newReferralCode: input.newReferralCode,
      });
      return { statusCode: 200, body: { member: toMemberProfile(record) } };
    }

    if (method === "GET" && path === "/admin/members") {
      if (!isAdminClaims(input.claims)) {
        return errorBody(403, "forbidden", "Admin access is required.");
      }
      if (!input.adminUserIds) {
        return errorBody(500, "configuration", "Member listing is not configured.");
      }
      const [records, adminIds] = await Promise.all([input.store.listMembers(), input.adminUserIds()]);
      return { statusCode: 200, body: { members: toListedMembers(records, adminIds) } };
    }

    if (method === "GET" && path === "/me") {
      const record = await input.store.getByUserId(identity.userId);
      if (!record) {
        return errorBody(404, "member_not_found", "Create your member profile first.");
      }
      return { statusCode: 200, body: { member: toMemberProfile(record) } };
    }

    if (method === "PATCH" && path === "/me") {
      if (requestsTransactionPassword(input.body)) {
        const record = await setTransactionPassword({
          userId: identity.userId,
          body: input.body,
          store: input.store,
          now,
        });
        return { statusCode: 200, body: { member: toMemberProfile(record) } };
      }
      const record = await patchMember({
        userId: identity.userId,
        body: input.body,
        store: input.store,
        now,
      });
      return { statusCode: 200, body: { member: toMemberProfile(record) } };
    }

    return errorBody(404, "not_found", "That member request does not exist.");
  } catch (caught) {
    if (caught instanceof MemberRequestError) {
      return errorBody(caught.statusCode, caught.code, caught.message);
    }
    return errorBody(500, "member_request_failed", "Could not complete that member request.");
  }
}

async function resolveSponsor(
  store: MemberStore,
  userId: string,
  requested: string,
): Promise<{ userId: string; code: string } | null> {
  if (!requested) {
    return null;
  }
  if (!CODE_PATTERN.test(requested)) {
    throw new MemberRequestError(400, "invalid_referral", "That referral code is not valid.");
  }
  const sponsorUserId = await store.getUserIdByReferralCode(requested);
  if (!sponsorUserId) {
    throw new MemberRequestError(400, "invalid_referral", "That referral code is not valid.");
  }
  if (sponsorUserId === userId) {
    throw new MemberRequestError(400, "self_referral", "You cannot use your own referral code.");
  }
  return { userId: sponsorUserId, code: requested };
}

function editableChanges(body: unknown): {
  hasEdits: boolean;
  patch: Omit<ProfilePatch, "updatedAt">;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MemberRequestError(400, "invalid_body", "Profile changes must be an object.");
  }
  const source = body as Record<string, unknown>;
  const patch: Omit<ProfilePatch, "updatedAt"> = {};
  let hasEdits = false;

  if ("name" in source) {
    if (typeof source.name !== "string" || !clampName(source.name)) {
      throw new MemberRequestError(400, "invalid_body", "Enter a name up to 80 characters.");
    }
    patch.name = clampName(source.name);
    hasEdits = true;
  }
  if ("phone" in source) {
    patch.phone = optionalText(source.phone, PHONE_MAX, "Enter a shorter phone number.");
    hasEdits = true;
  }
  if ("country" in source) {
    patch.country = optionalText(source.country, COUNTRY_MAX, "Enter a shorter country.");
    hasEdits = true;
  }

  return { hasEdits, patch };
}

function optionalText(value: unknown, max: number, message: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new MemberRequestError(400, "invalid_body", message);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > max) {
    throw new MemberRequestError(400, "invalid_body", message);
  }
  return trimmed;
}

function profileFromBody(body: unknown): { firstName: string; lastName: string; phone: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const source = body as Record<string, unknown>;
  if (!("firstName" in source) && !("lastName" in source) && !("phone" in source)) {
    return null;
  }
  const firstName = personName(source.firstName, "Enter a first name.");
  const lastName = personName(source.lastName, "Enter a last name.");
  if (`${firstName} ${lastName}`.length > NAME_MAX) {
    throw new MemberRequestError(400, "invalid_body", "Enter a shorter name.");
  }
  const phone = mobileNumber(source.phone);
  return { firstName, lastName, phone };
}

function personName(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new MemberRequestError(400, "invalid_body", message);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40) {
    throw new MemberRequestError(400, "invalid_body", message);
  }
  return trimmed;
}

function mobileNumber(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9+().\-\s]{6,32}$/.test(value.trim()) || value.replace(/\D/g, "").length < 6) {
    throw new MemberRequestError(400, "invalid_body", "Enter a mobile number.");
  }
  return value.trim();
}

function referralFromBody(body: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new MemberRequestError(400, "invalid_body", "Initialization must be an object.");
  }
  const source = body as Record<string, unknown>;
  if (!("referralCode" in source) || source.referralCode === null || source.referralCode === "") {
    return "";
  }
  if (typeof source.referralCode !== "string") {
    throw new MemberRequestError(400, "invalid_body", "Referral code must be text.");
  }
  return source.referralCode;
}

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "/";
  const trimmed = withoutQuery.replace(/\/+$/, "");
  return trimmed || "/";
}

function stringClaim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampName(value: string): string {
  return value.trim().slice(0, NAME_MAX);
}

function errorBody(statusCode: number, code: string, message: string): {
  statusCode: number;
  body: Record<string, unknown>;
} {
  return { statusCode, body: { error: code, message } };
}

export { memberReferralUrl } from "./referral-url.ts";
