---
name: flow-walkthrough
description: "Free Soar 角色流程的 cognitive walkthrough 與日常工作對照；適用 $flow-walkthrough、/flow-walkthrough、流程走查、某角色第一次使用是否順暢或容易理解。只讀程式並產出報告；單頁視覺精修交給 impeccable。"
---

# Flow Walkthrough（Codex 入口）

先讀 [Codex runtime 轉接規則](../feature-loop/references/codex-runtime.md)，再從 repo root 讀 `.claude/skills/flow-walkthrough/SKILL.md`，沿用它的角色判定、舊紀錄比對、程式證據、四問、三位 persona、日常工作與真人測試格式。

- `references/personas.md`、`references/jobs.md`、`references/report-template.md` 都位於 `.claude/skills/flow-walkthrough/references/`，不要從本 adapter 找或另造 persona。
- 引用的 onboarding／heuristics 原則仍讀原始 `.claude/skills/impeccable/reference/`。
- 報告裡的「Claude 自己的判斷」改標「Codex 的判斷」；來源方法與推論仍要區分，其他格式沿用。
- 同主題已有報告時，新增 `review-YYYY-MM-DD.md`，同日重跑加 `-02` 等尾碼；不覆寫舊報告。
- 只寫本次報告，程式、設定、其他文件與 DB 都不改。不替使用者登入、不製造假資料；沒在瀏覽器看過的結論標「待驗證」。
- 報告完成後依 runtime 規則明確執行獨立 peer review；不依賴 Claude Stop hook，不把 self review 稱為獨立 review，不偽造 `codex-peer-reviewed` marker。

結尾保留原始 skill 的發現與建議，並補齊 AGENTS.md 的 Required Self Review 與 Recommended Next Step。
