"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  InvestmentClientError,
  readCurrentDepositAddresses,
  readCurrentInvestment,
  submitCurrentDeposit,
  type DepositWallets,
} from "@/lib/investments/client";
import { formatUsdtAmount, type InvestmentRecord, type InvestmentStatus } from "@/lib/investments/service";
import { isMemberApiConfigured } from "@/lib/members/config";
import styles from "./InvestmentsPanel.module.css";

const statusLabel: Record<InvestmentStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  pending_verification: "Pending verification",
  deposit_verified: "Deposit verified",
  rejected: "Rejected",
  active: "Active",
};

export function InvestmentPaymentPanel({ investmentId }: { investmentId: string }) {
  const [investment, setInvestment] = useState<InvestmentRecord | null>(null);
  const [wallets, setWallets] = useState<DepositWallets>({ bep20: "", trc20: "" });
  const [reference, setReference] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [copiedNetwork, setCopiedNetwork] = useState<"BEP20" | "TRC20" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberApiConfigured());
  const [submitting, setSubmitting] = useState(false);
  const depositKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [record, addresses] = await Promise.all([
      readCurrentInvestment(investmentId),
      readCurrentDepositAddresses(),
    ]);
    setInvestment(record);
    setWallets(addresses);
    setMessage(null);
  }, [investmentId]);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void load()
      .catch((caught: unknown) => {
        if (active) {
          setMessage(caught instanceof Error ? caught.message : "Could not load that investment.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function submitReference() {
    if (!investment || submitting || investment.status !== "awaiting_deposit") {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const idempotencyKey = depositKey.current ?? crypto.randomUUID();
    depositKey.current = idempotencyKey;
    try {
      const proof = await screenshotFromFile(screenshot);
      const saved = await submitCurrentDeposit(investment.investmentId, reference.trim(), idempotencyKey, proof);
      depositKey.current = null;
      setInvestment(saved);
      setScreenshot(null);
    } catch (caught) {
      const error = caught instanceof InvestmentClientError ? caught : new InvestmentClientError("investment_request_failed", "Could not save that deposit reference.");
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isMemberApiConfigured()) {
    return (
      <Card>
        <h1>Payment</h1>
        <p className="lead">Authentication is connected. Investment storage is not configured for this build yet.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <p className="eyebrow">Payment</p>
        <h1>{investment ? investment.planName : "Investment"}</h1>
        {investment ? <h2 style={{ marginTop: 8 }}>{formatUsdtAmount(investment.amountMinor, investment.scale)}</h2> : null}
        <p className="lead" style={{ marginTop: 12 }}>
          Submit the transaction reference for this investment. This does not move money.
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/investments">Back to investments</Link>
        </p>
        {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
      </Card>
      {loading ? (
        <Card>
          <p>Loading this investment…</p>
        </Card>
      ) : !investment ? null : (
        <Card>
          <p>Status: {statusLabel[investment.status]}</p>
          {investment.status === "awaiting_deposit" ? (
            <DepositReferenceForm
              investmentId={investment.investmentId}
              reference={reference}
              submitting={submitting}
              copiedNetwork={copiedNetwork}
              wallets={wallets}
              onReference={setReference}
              onScreenshot={setScreenshot}
              onCopy={async (network, address) => {
                await navigator.clipboard.writeText(address);
                setCopiedNetwork(network);
              }}
              onSubmit={() => void submitReference()}
            />
          ) : null}
          {investment.depositReference ? <p style={{ marginTop: 10 }}>Reference {investment.depositReference}</p> : null}
          {investment.depositProofKey ? <p>Screenshot received</p> : null}
        </Card>
      )}
    </div>
  );
}

function DepositReferenceForm({
  investmentId,
  reference,
  submitting,
  copiedNetwork,
  wallets,
  onReference,
  onScreenshot,
  onCopy,
  onSubmit,
}: {
  investmentId: string;
  reference: string;
  submitting: boolean;
  copiedNetwork: "BEP20" | "TRC20" | null;
  wallets: DepositWallets;
  onReference: (value: string) => void;
  onScreenshot: (file: File | null) => void;
  onCopy: (network: "BEP20" | "TRC20", address: string) => Promise<void>;
  onSubmit: () => void;
}) {
  return (
    <form
      style={{ marginTop: 16 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className={styles.wallets}>
        <DepositAddressRow network="BEP20" address={wallets.bep20} copied={copiedNetwork === "BEP20"} onCopy={onCopy} />
        <DepositAddressRow network="TRC20" address={wallets.trc20} copied={copiedNetwork === "TRC20"} onCopy={onCopy} />
      </div>
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
      <Button type="submit" disabled={submitting} style={{ marginTop: 12 }}>
        {submitting ? "Submitting…" : "Submit reference"}
      </Button>
    </form>
  );
}

function DepositAddressRow({
  network,
  address,
  copied,
  onCopy,
}: {
  network: "BEP20" | "TRC20";
  address: string;
  copied: boolean;
  onCopy: (network: "BEP20" | "TRC20", address: string) => Promise<void>;
}) {
  if (!address) {
    return (
      <Card>
        <p className={styles.network}>{network}</p>
        <p style={{ marginTop: 8 }}>The {network} deposit address is not configured.</p>
      </Card>
    );
  }
  return (
    <Card>
      <p className={styles.network}>{network}</p>
      <p className={styles.address}>{address}</p>
      <Button type="button" variant="secondary" onClick={() => void onCopy(network, address)}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </Card>
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
