export const PASSWORD_HINT =
  "At least 8 characters, with uppercase, lowercase, a number, and a special character.";

export function passwordIssue(password: string): string | null {
  if (password.length < 8) {
    return "Use at least 8 characters.";
  }
  if (!/[a-z]/.test(password)) {
    return "Include a lowercase letter.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Include an uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Include a number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Include a special character.";
  }
  return null;
}
