import { getIdToken } from "@/lib/auth/cognito";
import { isMemberApiConfigured, readMemberApiUrl } from "@/lib/members/config";
import type { CommissionEntry, InvestmentRecord, ProfitEntry, WithdrawalRequest } from "@/lib/investments/service";

export class InvestmentClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "InvestmentClientError";
    this.code = code;
  }
}

export async function readCurrentInvestment(investmentId: string): Promise<InvestmentRecord> {
  const payload = await investmentRequest<{ investment?: InvestmentRecord }>(
    "GET",
    `/investments/${encodeURIComponent(investmentId)}`,
  );
  if (!payload.investment) {
    throw new InvestmentClientError("investment_not_found", "That investment was not found.");
  }
  return payload.investment;
}

export async function listCurrentInvestments(): Promise<InvestmentRecord[]> {
  const payload = await investmentRequest<{ investments?: InvestmentRecord[] }>("GET", "/investments");
  return payload.investments ?? [];
}

export async function submitCurrentDeposit(
  investmentId: string,
  reference: string,
  idempotencyKey: string,
  screenshot?: { contentType: string; dataBase64: string },
): Promise<InvestmentRecord> {
  const payload = await investmentRequest<{ investment?: InvestmentRecord }>(
    "POST",
    `/investments/${investmentId}/deposit`,
    screenshot ? { reference, screenshot } : { reference },
    idempotencyKey,
  );
  if (!payload.investment) {
    throw new InvestmentClientError("investment_request_failed", "Could not save that deposit reference.");
  }
  return payload.investment;
}

export async function changeMemberAdminGroup(
  email: string,
  action: "grant" | "remove",
): Promise<{ result: string; message: string }> {
  const payload = await investmentRequest<{ result?: string; message?: string }>("POST", "/admin/members/group", { email, action });
  return {
    result: payload.result ?? "unchanged",
    message: payload.message ?? "They must log in again before this change takes effect.",
  };
}

export async function listCurrentProfits(): Promise<ProfitEntry[]> {
  const payload = await investmentRequest<{ profits?: ProfitEntry[] }>("GET", "/profits");
  return payload.profits ?? [];
}

export async function listCurrentCommissions(): Promise<CommissionEntry[]> {
  const payload = await investmentRequest<{ commissions?: CommissionEntry[] }>("GET", "/commissions");
  return payload.commissions ?? [];
}

export async function listCurrentWithdrawals(): Promise<{ withdrawals: WithdrawalRequest[]; availableMinor: number }> {
  const payload = await investmentRequest<{ withdrawals?: WithdrawalRequest[]; availableMinor?: number }>("GET", "/withdrawals");
  return { withdrawals: payload.withdrawals ?? [], availableMinor: payload.availableMinor ?? 0 };
}

export async function requestCurrentWithdrawal(amountMinor: number): Promise<WithdrawalRequest> {
  const payload = await investmentRequest<{ withdrawal?: WithdrawalRequest }>("POST", "/withdrawals", { amountMinor });
  if (!payload.withdrawal) {
    throw new InvestmentClientError("investment_request_failed", "Could not save that withdrawal request.");
  }
  return payload.withdrawal;
}

export type DepositWallets = {
  bep20: string;
  trc20: string;
};

export async function readCurrentDepositAddresses(): Promise<DepositWallets> {
  const payload = await investmentRequest<Partial<DepositWallets>>("GET", "/deposit-address");
  return { bep20: payload.bep20 ?? "", trc20: payload.trc20 ?? "" };
}

export async function saveDepositAddresses(wallets: DepositWallets): Promise<DepositWallets> {
  const payload = await investmentRequest<Partial<DepositWallets>>("PUT", "/admin/deposit-address", wallets);
  if (!payload.bep20 || !payload.trc20) {
    throw new InvestmentClientError("investment_request_failed", "Could not save those deposit addresses.");
  }
  return { bep20: payload.bep20, trc20: payload.trc20 };
}

export async function listPendingDeposits(): Promise<InvestmentRecord[]> {
  const payload = await investmentRequest<{ investments?: InvestmentRecord[] }>("GET", "/admin/deposits");
  return payload.investments ?? [];
}

export async function listVerifiedDeposits(): Promise<InvestmentRecord[]> {
  const payload = await investmentRequest<{ verified?: InvestmentRecord[] }>("GET", "/admin/deposits");
  return payload.verified ?? [];
}

export async function activateVerifiedInvestment(investmentId: string): Promise<InvestmentRecord> {
  const payload = await investmentRequest<{ investment?: InvestmentRecord }>(
    "POST",
    `/admin/deposits/${investmentId}/activate`,
    {},
  );
  if (!payload.investment) {
    throw new InvestmentClientError("investment_request_failed", "Could not activate that investment.");
  }
  return payload.investment;
}

export async function reviewPendingDeposit(
  investmentId: string,
  decision: "deposit_verified" | "rejected",
): Promise<InvestmentRecord> {
  const payload = await investmentRequest<{ investment?: InvestmentRecord }>(
    "POST",
    `/admin/deposits/${investmentId}/review`,
    { decision },
  );
  if (!payload.investment) {
    throw new InvestmentClientError("investment_request_failed", "Could not save that review.");
  }
  return payload.investment;
}

export async function createCurrentInvestment(planId: string, idempotencyKey: string): Promise<InvestmentRecord> {
  const payload = await investmentRequest<{ investment?: InvestmentRecord }>("POST", "/investments", { planId }, idempotencyKey);
  if (!payload.investment) {
    throw new InvestmentClientError("investment_request_failed", "Could not record that investment.");
  }
  return payload.investment;
}

async function investmentRequest<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const base = readMemberApiUrl();
  if (!isMemberApiConfigured(base)) {
    throw new InvestmentClientError("not_configured", "Investments are not connected in this build.");
  }
  const token = await getIdToken();
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  if (idempotencyKey) {
    headers["idempotency-key"] = idempotencyKey;
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!response.ok || !payload) {
    throw new InvestmentClientError(
      payload?.error || "investment_request_failed",
      payload?.message || "Could not load your investments.",
    );
  }
  return payload;
}
