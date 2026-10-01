/**
 * Public API address. Not a secret.
 * Leave it blank until QuestworldApi is deployed, then set the execute-api URL.
 * Amplify can inject NEXT_PUBLIC_MEMBER_API_URL at build time. Do not commit .env.
 */
export function readMemberApiUrl(value = process.env.NEXT_PUBLIC_MEMBER_API_URL): string {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

export function isMemberApiConfigured(url = readMemberApiUrl()): boolean {
  return url.startsWith("https://");
}
