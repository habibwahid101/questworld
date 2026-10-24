export const PASSWORD_HINT = "At least 6 characters.";
export const TRANSACTION_PASSWORD_MIN = 8;

export function passwordIssue(password: string, minimum = 6): string | null {
  if (password.length < minimum) {
    return `Use at least ${minimum} characters.`;
  }
  return null;
}
