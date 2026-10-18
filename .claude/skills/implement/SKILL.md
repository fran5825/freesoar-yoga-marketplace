---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

### Free Soar Yoga 專案覆寫（優先於下方預設）

- 票券是本機檔案：`docs/superpowers/plans/<feature-slug>/tickets/<NN>-<slug>.md`，沒有 issue tracker。開始前讀票、說出標題，並檢查它的 Blocked by 都已完成。
- 先看票頭的 Workflow mode／Human Gate：HEAVY 或 Human Gate = yes 的票，產品主人還沒在對話裡明確放行就先停下來問，不要動手。流程依 `docs/harness/risk-based-workflow.md`。
- 驗證指令：typecheck 用 `npx tsc --noEmit`、lint 用 `npm run lint`；單一 smoke 檔 `npx playwright test tests/smoke/<file>.spec.ts`，整套 `npm run test:smoke`（會先 build）。Playwright 用獨立埠（`PORT=3100`，多個工作階段同時跑就改 3200 等）。
- 完成一票就把票檔的 Status 改成 done，並在對應的 plan 檔勾掉（AGENTS.md 長任務規則）。
- 審查分兩段，照順序做：
  1. 「code-review」用 Claude Code 內建的 `/code-review`（抓 bug）。
  2. 接著用 Skill tool 呼叫 `spec-review`，把這次改到的檔案和票、spec 的路徑交給它，檢查有沒有照專案規則、照 spec 實作。
  
  兩段的發現一起回報。要修的先修，修完再回報；屬於產品決定的就列出來問產品主人。
- 最後一步「Commit」改成：只有產品主人在這次任務明確要求或已放行 commit 時才 commit；否則列出改了哪些檔案、等確認。永遠不要自動 push。
- 結尾照 AGENTS.md 的 Required Self Review 回報。

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, call the Skill tool with "code-review" to review the work, then call the Skill tool with "spec-review".

Commit your work to the current branch.
