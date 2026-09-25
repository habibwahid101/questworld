"use client";

import { useSearchParams } from "next/navigation";

export function AccessNotice() {
  const notice = useSearchParams().get("notice");
  if (notice !== "admin") {
    return null;
  }

  return (
    <p role="status" className="form-error">
      Administrator access is required for that page. Your account is signed in as a member.
    </p>
  );
}
