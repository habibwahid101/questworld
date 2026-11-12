"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FinishRegistration } from "@/components/auth/FinishRegistration";
import { clearPendingReferral } from "@/lib/auth/referral";
import { clearPendingSignupProfile } from "@/lib/auth/signup-profile";
import { MemberClientError, readCurrentMember, updateCurrentMember } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { MemberProfile } from "@/lib/members/service";

type MemberDataStatus = "loading" | "ready" | "unconfigured" | "finish" | "error";

type MemberDataValue = {
  status: MemberDataStatus;
  member: MemberProfile | null;
  message: string | null;
  saveProfile: (patch: { name: string; phone: string; country: string }) => Promise<void>;
};

const MemberDataContext = createContext<MemberDataValue | null>(null);

export function MemberDataProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<MemberDataStatus>(isMemberApiConfigured() ? "loading" : "unconfigured");
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applySuccess = useCallback((next: MemberProfile) => {
    clearPendingReferral(window.localStorage);
    clearPendingSignupProfile(window.sessionStorage);
    setMember(next);
    setMessage(null);
    setStatus("ready");
  }, []);

  const load = useCallback(async () => {
    if (!isMemberApiConfigured()) {
      setStatus("unconfigured");
      return;
    }
    setStatus("loading");
    setMessage(null);
    try {
      applySuccess(await readCurrentMember());
    } catch (caught: unknown) {
      const error = caught instanceof MemberClientError ? caught : new MemberClientError("member_request_failed", "Could not load your member profile.");
      if (error.code === "member_not_found") {
        setMember(null);
        setMessage(null);
        setStatus("finish");
        return;
      }
      setMessage(error.message);
      setStatus("error");
    }
  }, [applySuccess]);

  useEffect(() => {
    if (!isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void readCurrentMember()
      .then((next) => {
        if (active) {
          applySuccess(next);
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        const error = caught instanceof MemberClientError ? caught : new MemberClientError("member_request_failed", "Could not load your member profile.");
        if (error.code === "member_not_found") {
          setMember(null);
          setMessage(null);
          setStatus("finish");
          return;
        }
        setMessage(error.message);
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [applySuccess]);

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
      saveProfile,
    }),
    [status, member, message, saveProfile],
  );

  return (
    <MemberDataContext.Provider value={value}>
      {status === "finish" ? (
        <FinishRegistration onComplete={applySuccess} />
      ) : (
        <>
          {message ? (
            <p className="form-error" role="alert">
              {message}{" "}
              <button type="button" onClick={() => void load()}>
                Try again
              </button>
            </p>
          ) : null}
          {children}
        </>
      )}
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
