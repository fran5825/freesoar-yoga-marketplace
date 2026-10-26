---
name: feature-loop
description: "使用者明確要求 $feature-loop、/feature-loop 或功能閉環時，接手 Free Soar 的 grill → spec → tickets → implement → review → 畫面驗收 → retro。沿用既有進度與產品主人關卡，不因一般功能問題自動啟動。"
---

# Feature Loop（Codex 入口）

先讀 [Codex runtime 轉接規則](references/codex-runtime.md)，再從 repo root 讀 `.claude/skills/feature-loop/SKILL.md`，依其階段、進度檔與關卡執行。

所有階段仍以 `.claude/skills/<name>/SKILL.md` 為來源；原文要求 Skill tool 時，直接讀該檔後遵循，不需要偽造工具呼叫。僅在該階段需要時讀取其 supporting references，且相對路徑從來源 skill 的資料夾解析。

開始或恢復時，先找 loop-status、spec、tickets 與 handoff。摘要已完成階段、現有明確授權與下一步；已有使用者明確要求從該步接手且授權足夠時直接續作，不重問相同的 gate。未放行的關卡照原流程等待回答。

串接審查、平行實作與畫面驗收時，必須套用 runtime 轉接規則；Claude 的內建 `/code-review` 與 Stop hook 不會自動在 Codex 存在。安裝本入口不是啟動 feature-loop，也不是核准 commit、push 或尚未提供的產品決定。
