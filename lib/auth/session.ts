import { isAdminGroups, normalizeGroups } from "./groups";

export type AuthUser = {
  email: string;
  name: string;
  groups: string[];
  isAdmin: boolean;
};

type TokenPayload = Record<string, unknown> | undefined;

export function authUserFromPayload(payload: TokenPayload, fallbackEmail = ""): AuthUser {
  const email = typeof payload?.email === "string" ? payload.email : fallbackEmail;
  const name = typeof payload?.name === "string" ? payload.name : "";
  const groups = normalizeGroups(payload?.["cognito:groups"]);

  return {
    email,
    name,
    groups,
    isAdmin: isAdminGroups(groups),
  };
}
