"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import type { LastRole } from "@/lib/navigation/last-role-cookie";
import { rememberLastRole } from "@/lib/navigation/remember-last-role-action";

// member-flow-redesign 票 01：放在各專區 layout。畫面真的出現、且每次專區內換頁完成時記下上次身分；
// 背景預先載入不會畫出畫面，所以不會觸發。依 pathname 重跑，是因為同專區換頁會重用 layout，
// 只在第一次掛載時記，會漏掉「其他分頁已改掉 cookie」的情況。
export function RememberLastRole({ role }: { role: LastRole }) {
  const pathname = usePathname();

  useEffect(() => {
    rememberLastRole(role).catch(() => {
      // 只是記住使用習慣，失敗不影響頁面；下次換頁或整頁載入會再記。
    });
  }, [role, pathname]);

  return null;
}
