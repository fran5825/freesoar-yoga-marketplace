"use client";

import { useEffect, useState } from "react";

// 2026-10-18 impeccable 改版（診斷報告 D1）：手機底部的報名按鈕。原本是一行底線文字，而且和卡片裡的
// 實心「我要報名」同時出現；改成實心按鈕，只在卡片裡的報名區（data-sticky-enroll-target）捲出畫面後才出現，
// 一個畫面只有一個主要按鈕（DESIGN.md The One Pine Rule）。表單正在輸入時照舊收起，避免擋住鍵盤。
export function StickyEnrollBar({ href, label }: { href: string; label: string }) {
  const [targetVisible, setTargetVisible] = useState(true);

  useEffect(() => {
    const target = document.querySelector("[data-sticky-enroll-target]");
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setTargetVisible(entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`${targetVisible ? "hidden" : "block"} fixed inset-x-0 bottom-0 z-20 border-t border-pine/15 bg-cream px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] group-has-[form:focus-within]:hidden sm:hidden`}
    >
      <a
        className="flex min-h-12 w-full items-center justify-center rounded-full bg-pine text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        href={href}
      >
        {label}
      </a>
    </div>
  );
}
