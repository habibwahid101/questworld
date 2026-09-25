export const ADMIN_GROUP = "Admins";

export function normalizeGroups(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

export function isAdminGroups(groups: readonly string[]): boolean {
  return groups.includes(ADMIN_GROUP);
}
