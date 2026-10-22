"use client";

import { useEffect, useState } from "react";
import { listStoredMembers } from "@/lib/members/client";
import { isMemberApiConfigured } from "@/lib/members/config";
import type { ListedMember } from "@/lib/members/service";

export function useStoredMembers(enabled = true): ListedMember[] | null {
  const [members, setMembers] = useState<ListedMember[] | null>(null);

  useEffect(() => {
    if (!enabled || !isMemberApiConfigured()) {
      return;
    }
    let active = true;
    void listStoredMembers()
      .then((records) => {
        if (active) {
          setMembers(records);
        }
      })
      .catch(() => {
        if (active) {
          setMembers([]);
        }
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return members;
}
