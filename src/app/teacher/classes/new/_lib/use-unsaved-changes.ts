"use client";

import { useEffect } from "react";

export const UNSAVED_CHANGES_MESSAGE = "這堂課還沒建立，離開後剛才填的內容不會保留。確定要離開嗎？";

// 建課表單有未建立的修改時提醒（teacher-usability-redesign 票 01）。
// - 關閉分頁、重新整理、輸入網址：瀏覽器原生的 beforeunload 提醒。
// - 點站內連結（Next.js Link 是 client-side 導覽，不會觸發 beforeunload）：在 document 的 capture
//   階段先攔下點擊、跳出確認；按取消就 preventDefault，Link 看到 defaultPrevented 不會導覽。
// 只是提醒，不做任何暫存或離頁續填。成功建立後是 Server Action 的 redirect，不經過這兩條路徑。
export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // 舊版瀏覽器需要設定 returnValue 才會跳提醒。
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest?.("a[href]");

      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const isSamePageAnchor =
        destination.origin === window.location.origin &&
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash !== "";

      if (isSamePageAnchor) {
        return;
      }

      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [enabled]);
}
