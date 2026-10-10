"use client";

import { useEffect } from "react";

// inline-member-actions 票 01（spec 3.2）：就地操作做完，捲到剛操作的那一列（成功）或可見的結果訊息（失敗）。
// server action 的 redirect 不會保留網址 fragment，所以改由網址參數 focus 指定目標 id，進頁面後捲過去。
export function ScrollToTarget({ targetId }: { targetId: string | undefined }) {
  useEffect(() => {
    if (!targetId || !/^[A-Za-z0-9_-]+$/.test(targetId)) {
      return;
    }

    document.getElementById(targetId)?.scrollIntoView({ block: "center" });
  }, [targetId]);

  return null;
}
