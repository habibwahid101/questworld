export const DEPOSIT_NETWORKS = ["BEP20", "TRC20"] as const;

export type DepositNetwork = (typeof DEPOSIT_NETWORKS)[number];

/** Owner-provided deposit wallets. These are the only initial addresses. */
export const INITIAL_DEPOSIT_ADDRESSES: Record<DepositNetwork, string> = {
  BEP20: "0x61440ed26b7527b186b34a661be1e07b9a67f3fe",
  TRC20: "TMuGe7QWieZR1sMKQRLhS9FxE7GTLi87Hg",
};

const NETWORK_PATTERNS: Record<DepositNetwork, RegExp> = {
  BEP20: /^0x[a-fA-F0-9]{40}$/,
  TRC20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
};

export function readNetworkAddress(network: DepositNetwork, value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "PASTE THE ADDRESS HERE" || !NETWORK_PATTERNS[network].test(trimmed)) {
    return "";
  }
  return trimmed;
}
