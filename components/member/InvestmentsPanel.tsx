"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createCurrentInvestment, InvestmentClientError, listCurrentInvestments, submitCurrentDeposit } from "@/lib/investments/client";
import { readBinanceDepositAddress } from "@/lib/deposits/address";
import { formatUsdtAmount, type InvestmentRecord, type InvestmentStatus, type PlanId } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";

const statusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Pending verification",
  deposit_verified: "Deposit verified",
  rejected: "Rejected",
  active: "Active",
};

const plans: readonly { id: PlanId; label: string }[] = [
  { id: "starter", label: "Starter" },
  { id: "growth", label: "Growth" },
  { id: "professional", label: "Professional" },
  { id: "premium", label: "Premium" },
];

export function InvestmentsPanel() {
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [savingPlan, setSavingPlan] = useState<PlanId | null>(null);
  const [savingDepositId, setSavingDepositId] = useState<string | null>(null);
  const [references, setReferences] = useState<Record<string, string>>({});
  const [screenshots, setScreenshots] = useState<Record<string, File | null>>({});
  const [copied, setCopied] = useState(false);
  const pendingKeys = useRef<Partial<Record<PlanId, string>>>({});
  const depositKeys = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const records = await listCurrentInvestments();
    setInvestments(records);
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void load().catch((caught: unknown) => {
      if (!active) {
        return;
      }
      setMessage(caught instanceof Error ? caught.message : "Could not load your investments.");
    }).finally(() => {
      if (active) {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function choosePlan(planId: PlanId) {
    if (savingPlan || savingDepositId) {
      return;
    }
    setSavingPlan(planId);
    setMessage(null);
    const idempotencyKey = pendingKeys.current[planId] ?? crypto.randomUUID();
    pendingKeys.current[planId] = idempotencyKey;
    try {
      await createCurrentInvestment(planId, idempotencyKey);
      delete pendingKeys.current[planId];
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not record that investment.");
      setMessage(error.message);
    } finally {
      setSavingPlan(null);
    }
  }

  async function submitReference(investmentId: string) {
    if (savingPlan || savingDepositId) {
      return;
    }
    const reference = references[investmentId]?.trim() ?? "";
    setSavingDepositId(investmentId);
    setMessage(null);
    const idempotencyKey = depositKeys.current[investmentId] ?? crypto.randomUUID();
    depositKeys.current[investmentId] = idempotencyKey;
    try {
      const screenshot = await screenshotFromFile(screenshots[investmentId]);
      await submitCurrentDeposit(investmentId, reference, idempotencyKey, screenshot);
      delete depositKeys.current[investmentId];
      await load();
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save that deposit reference.");
      setMessage(error.message);
    } finally {
      setSavingDepositId(null);
    }
  }

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Investments</h1>
        <p className="lead">Authentication is connected. Investment storage is not configured for this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h1>Investments</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Choose a listed plan to record an investment. A deposit reference is stored for review. This does not move money.
        </p>
        <div className="grid-2" style={{ marginTop: 20 }}>
          {plans.map((plan) => (
            <Button
              key={plan.id}
              variant="secondary"
              disabled={savingPlan !== null || savingDepositId !== null}
              onClick={() => void choosePlan(plan.id)}
            >
              {savingPlan === plan.id ? "Recording…" : plan.label}
            </Button>
          ))}
        </div>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      {loading ? (
        <Card>
          <p>Loading your investments…</p>
        </Card>
      ) : investments.length === 0 ? (
        <Card>
          <h2>No investments yet</h2>
          <p style={{ marginTop: 10 }}>When you choose a plan, it is recorded here as awaiting deposit.</p>
        </Card>
      ) : (
        investments.map((investment) => (
          <Card key={investment.investmentId}>
            <p className="eyebrow">{investment.planName}</p>
            <h2>{formatUsdtAmount(investment.amountMinor, investment.scale)}</h2>
            <p style={{ marginTop: 10 }}>Status: {statusLabel[investment.status]}</p>
            <p>Recorded {new Date(investment.createdAt).toLocaleString()}</p>
            {investment.status === "awaiting_deposit" ? (
              <DepositReferenceForm
                investmentId={investment.investmentId}
                reference={references[investment.investmentId] ?? ""}
                saving={savingPlan !== null || savingDepositId !== null}
                submitting={savingDepositId === investment.investmentId}
                copied={copied}
                onReference={(value) => setReferences((current) => ({ ...current, [investment.investmentId]: value }))}
                onScreenshot={(file) => setScreenshots((current) => ({ ...current, [investment.investmentId]: file }))}
                onCopy={async (address) => {
                  await navigator.clipboard.writeText(address);
                  setCopied(true);
                }}
                onSubmit={() => void submitReference(investment.investmentId)}
              />
            ) : null}
            {investment.depositReference ? <p style={{ marginTop: 10 }}>Reference {investment.depositReference}</p> : null}
            {investment.depositProofKey ? <p>Screenshot received</p> : null}
          </Card>
        ))
      )}
    </div>
  );
}

function DepositReferenceForm({
  investmentId,
  reference,
  saving,
  submitting,
  copied,
  onReference,
  onScreenshot,
  onCopy,
  onSubmit,
}: {
  investmentId: string;
  reference: string;
  saving: boolean;
  submitting: boolean;
  copied: boolean;
  onReference: (value: string) => void;
  onScreenshot: (file: File | null) => void;
  onCopy: (address: string) => Promise<void>;
  onSubmit: () => void;
}) {
  const address = readBinanceDepositAddress(process.env.NEXT_PUBLIC_BINANCE_DEPOSIT_ADDRESS);
  return (
    <form
      style={{ marginTop: 16 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {address ? (
        <p>
          Binance address {address}{" "}
          <Button type="button" variant="secondary" onClick={() => void onCopy(address)}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </p>
      ) : (
        <p>The Binance deposit address is not configured.</p>
      )}
      <label htmlFor={`deposit-${investmentId}`}>Transaction reference</label>
      <input
        id={`deposit-${investmentId}`}
        value={reference}
        onChange={(event) => onReference(event.target.value)}
        autoComplete="off"
        style={{ display: "block", width: "100%", marginTop: 8 }}
      />
      <label htmlFor={`proof-${investmentId}`} style={{ display: "block", marginTop: 12 }}>
        Screenshot, optional
      </label>
      <input
        id={`proof-${investmentId}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => onScreenshot(event.target.files?.[0] ?? null)}
        style={{ display: "block", marginTop: 8 }}
      />
      <Button type="submit" disabled={saving} style={{ marginTop: 12 }}>
        {submitting ? "Submitting…" : "Submit reference"}
      </Button>
    </form>
  );
}

async function screenshotFromFile(file: File | null | undefined): Promise<{ contentType: string; dataBase64: string } | undefined> {
  if (!file) {
    return undefined;
  }
  if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
    throw new InvestmentClientError("invalid_screenshot", "The screenshot must be a JPEG, PNG, or WebP image.");
  }
  if (file.size > 1_500_000) {
    throw new InvestmentClientError("invalid_screenshot", "The screenshot must be a JPEG, PNG, or WebP image under 1.5 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return { contentType: file.type, dataBase64: btoa(binary) };
}
