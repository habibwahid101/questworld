const UNCONFIGURED = "PASTE THE ADDRESS HERE";
const ADDRESS_PATTERN = /^[A-Za-z0-9]{26,128}$/;

export function readBinanceDepositAddress(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === UNCONFIGURED || !ADDRESS_PATTERN.test(trimmed)) {
    return "";
  }
  return trimmed;
}
