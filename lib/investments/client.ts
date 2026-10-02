import { getIdToken } from "@/lib/auth/cognito";
import { isMemberApiConfigured, readMemberApiUrl } from "@/lib/members/config";
import type { InvestmentRecord } from "@/lib/investments/service";

export class InvestmentClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "InvestmentClientError";
    this.code = code;
  }
}

export async function listCurrentInvestments(): Promise<InvestmentRecord[]> {
  const payload = await investmentRequest<{ investments?: InvestmentRecord[] }>("GET", "/investments");
  return payload.investments ?? [];
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
