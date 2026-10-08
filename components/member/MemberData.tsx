"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearPendingReferral, readPendingReferral } from "@/lib/auth/referral";
import { clearPendingSignupProfile, readPendingSignupProfile } from "@/lib/auth/signup-profile";
import { MemberClientError, initializeCurrentMember, updateCurrentMember } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { MemberProfile } from "@/lib/members/service";

type MemberDataStatus = "loading" | "ready" | "unconfigured" | "error";

type MemberDataValue = {
  status: MemberDataStatus;
  member: MemberProfile | null;
  message: string | null;
  referralBlocked: boolean;
  continueWithoutReferral: () => Promise<void>;
  saveProfile: (patch: { name: string; phone: string; country: string }) => Promise<void>;
};

const MemberDataContext = createContext<MemberDataValue | null>(null);

export function MemberDataProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<MemberDataStatus>(isMemberApiConfigured() ? "loading" : "unconfigured");
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [referralBlocked, setReferralBlocked] = useState(false);

  const applySuccess = useCallback((next: MemberProfile) => {
    clearPendingReferral(window.localStorage);
    clearPendingSignupProfile(window.sessionStorage);
    setMember(next);
    setMessage(null);
    setReferralBlocked(false);
    setStatus("ready");
  }, []);

  const initialize = useCallback(
    async (referralCode: string) => {
      const next = await initializeCurrentMember(referralCode, readPendingSignupProfile(window.sessionStorage));
      applySuccess(next);
    },
    [applySuccess],
  );

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    const pending = readPendingReferral(window.localStorage);
    void initialize(pending).catch((caught: unknown) => {
      if (!active) {
        return;
      }
      const error = caught instanceof MemberClientError ? caught : new MemberClientError("member_request_failed", "Could not create your member profile.");
      setReferralBlocked(error.code === "invalid_referral" || error.code === "self_referral");
      setMessage(error.message);
      setStatus("error");
    });
    return () => {
      active = false;
    };
  }, [initialize]);

  const continueWithoutReferral = useCallback(async () => {
    setStatus("loading");
    try {
      await initialize("");
    } catch (caught) {
      const error = caught instanceof MemberClientError ? caught : new MemberClientError("member_request_failed", "Could not create your member profile.");
      setReferralBlocked(false);
      setMessage(error.message);
      setStatus("error");
    }
  }, [initialize]);

  const saveProfile = useCallback(
    async (patch: { name: string; phone: string; country: string }) => {
      const next = await updateCurrentMember({
        name: patch.name,
        phone: patch.phone,
        country: patch.country,
      });
      setMember(next);
    },
    [],
  );

  const value = useMemo(
    () => ({
      status,
      member,
      message,
      referralBlocked,
      continueWithoutReferral,
      saveProfile,
    }),
    [status, member, message, referralBlocked, continueWithoutReferral, saveProfile],
  );

  return (
    <MemberDataContext.Provider value={value}>
      {message ? (
        <p className="form-error" role="alert">
          {message}
          {referralBlocked ? (
            <>
              {" "}
              <button type="button" onClick={() => void continueWithoutReferral()}>
                Continue without this referral code
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      {children}
    </MemberDataContext.Provider>
  );
}

export function useMemberData(): MemberDataValue {
  const value = useContext(MemberDataContext);
  if (!value) {
    throw new Error("useMemberData must be used within MemberDataProvider.");
  }
  return value;
}
