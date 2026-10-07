export type AdminGroupAction = "grant" | "remove";

export type AdminGroupUser = {
  username: string;
  email: string;
};

export type AdminGroupDirectory = {
  findByEmail(email: string): Promise<AdminGroupUser | null>;
  groupsFor(username: string): Promise<readonly string[]>;
  listAdminUsernames(): Promise<readonly string[]>;
  grant(username: string): Promise<void>;
  remove(username: string): Promise<void>;
  signOut(username: string): Promise<void>;
};

export class AdminGroupError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "AdminGroupError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export async function changeAdminGroup(input: {
  actorSub: string;
  actorEmail: string;
  body: unknown;
  directory: AdminGroupDirectory;
}): Promise<{ result: "granted" | "removed" | "unchanged"; message: string }> {
  const request = requestFromBody(input.body);
  const actorEmail = input.actorEmail.trim().toLowerCase();
  if (!actorEmail || request.email === actorEmail || request.email === input.actorSub) {
    throw new AdminGroupError(409, "self_group_change", "An administrator cannot change their own group here.");
  }
  const target = await input.directory.findByEmail(request.email);
  if (!target) {
    throw new AdminGroupError(404, "member_not_found", "That member was not found.");
  }
  if (target.username === input.actorSub || target.email.trim().toLowerCase() === actorEmail) {
    throw new AdminGroupError(409, "self_group_change", "An administrator cannot change their own group here.");
  }
  const groups = await input.directory.groupsFor(target.username);
  const alreadyAdmin = groups.includes("Admins");
  if (request.action === "grant") {
    if (alreadyAdmin) {
      return { result: "unchanged", message: "That member is already an administrator." };
    }
    await input.directory.grant(target.username);
    await input.directory.signOut(target.username);
    return {
      result: "granted",
      message: "Administrator access was granted. They must log in again before it takes effect.",
    };
  }
  if (!alreadyAdmin) {
    throw new AdminGroupError(409, "not_an_admin", "That member is not an administrator.");
  }
  const admins = await input.directory.listAdminUsernames();
  if (admins.length < 2) {
    throw new AdminGroupError(409, "last_admin", "The last administrator cannot be removed.");
  }
  await input.directory.remove(target.username);
  await input.directory.signOut(target.username);
  return {
    result: "removed",
    message: "Administrator access was removed. They must log in again before it takes effect.",
  };
}

function requestFromBody(body: unknown): { email: string; action: AdminGroupAction } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdminGroupError(400, "invalid_body", "Enter a member email and an action.");
  }
  const source = body as Record<string, unknown>;
  const extra = Object.keys(source).filter((key) => key !== "email" && key !== "action");
  if (extra.length > 0) {
    throw new AdminGroupError(400, "invalid_body", "Only the member email and action can be submitted.");
  }
  const email = typeof source.email === "string" ? source.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) {
    throw new AdminGroupError(400, "invalid_email", "Enter the member email address.");
  }
  if (source.action !== "grant" && source.action !== "remove") {
    throw new AdminGroupError(400, "invalid_action", "Choose grant or remove.");
  }
  return { email, action: source.action };
}
