export function memberReferralUrl(origin: string, code: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/register?ref=${encodeURIComponent(code)}`;
}
