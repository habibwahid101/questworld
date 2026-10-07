const UNCONFIGURED = "PASTE THE ADDRESS HERE";

export function readBinanceDepositAddress(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === UNCONFIGURED) {
    return "";
  }
  return trimmed;
}
