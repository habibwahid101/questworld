export const PASSWORD_HINT = "At least 8 characters.";

export function passwordIssue(password: string): string | null {
  if (password.length < 8) {
    return "Use at least 8 characters.";
  }
  return null;
}
