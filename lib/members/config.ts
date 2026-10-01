/**
 * Public API address. Not a secret.
 * Production builds receive it from Amplify as NEXT_PUBLIC_MEMBER_API_URL.
 * CDK sets that variable from the QuestworldApi endpoint. Do not hard-code the URL.
 */
export function readMemberApiUrl(value = process.env.NEXT_PUBLIC_MEMBER_API_URL): string {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

export function isMemberApiConfigured(url = readMemberApiUrl()): boolean {
  return url.startsWith("https://");
}
