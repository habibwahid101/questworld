"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth/config";
import { loadCurrentUser, logoutAccount } from "@/lib/auth/cognito";
import { authUserFromPayload, type AuthUser } from "@/lib/auth/session";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "unconfigured";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthConfigured()) {
      setUser(null);
      setStatus("unconfigured");
      return;
    }

    const current = await loadCurrentUser();
    if (!current) {
      setUser(null);
      setStatus("unauthenticated");
      return;
    }

    setUser(authUserFromPayload(current.payload, current.email));
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().catch(() => {
      if (!active) {
        return;
      }
      setUser(null);
      setStatus(isAuthConfigured() ? "unauthenticated" : "unconfigured");
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      if (isAuthConfigured()) {
        await logoutAccount();
      }
    } finally {
      setUser(null);
      setStatus(isAuthConfigured() ? "unauthenticated" : "unconfigured");
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      logout,
      refresh,
    }),
    [status, user, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return value;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?reason=auth");
    }
    if (status === "unconfigured") {
      router.replace("/login?reason=config");
    }
  }, [router, status]);

  if (status !== "authenticated") {
    return (
      <p className="container" style={{ padding: "24px 0" }}>
        Checking your session…
      </p>
    );
  }

  return children;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && !user?.isAdmin) {
      router.replace("/dashboard?notice=admin");
    }
  }, [router, status, user]);

  if (status !== "authenticated" || !user?.isAdmin) {
    return (
      <p className="container" style={{ padding: "24px 0" }}>
        Checking administrator access…
      </p>
    );
  }

  return children;
}
