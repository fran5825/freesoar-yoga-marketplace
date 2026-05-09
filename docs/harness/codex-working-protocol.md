# Codex Working Protocol

## 1. 基本工作流程

Codex 在本 repo 的預設工作流程是：

1. Read：確認 repo 狀態，閱讀 `AGENTS.md` 與任務相關文件。
2. Plan：對非 trivial change 先提出計畫，列出 files to change、risks、tests。
3. Implement：只實作已確認的最小範圍。
4. Test：依變更風險執行適當測試或說明未執行原因。
5. Self-review：依 `docs/harness/codex-self-review-checklist.md` 做輕量自查。
6. Report：回報變更、測試、風險、未完成事項與 git 狀態。

## 2. 開始任務前必做

每次開始工作前，Codex 應：

- 確認目前工作目錄是 repo 根目錄。
- 檢查 `git status`，理解目前是否有既有變更。
- 閱讀 `AGENTS.md` 與任務相關 docs。
- 避免讀取、輸出或修改 `.env`；需要環境變數時，只參考 `.env.example`。
- 若發現既有未提交變更，必須保留並避免覆蓋使用者工作。

## 3. 實作前規則

非 trivial change 必須先提出 plan。

Plan 至少包含：

- 預計新增或修改的 files。
- 主要實作步驟。
- 可能風險。
- 預計執行的 tests 或不執行的原因。
- 是否可能影響 Auth、Prisma、permissions、state machines、V1 scope 或核心 user flows。

若任務涉及高風險邊界，Codex 必須先說明影響並等待產品主人確認後才實作。

## 4. 實作中規則

Codex 實作時必須：

- 只做任務範圍內變更。
- 不自動擴大 scope。
- 不自動新增大型架構或不必要抽象。
- 不引入 complex RBAC；V1 維持 capability-based model。
- 不提前實作 Wellness、Academy、Retreat、advanced AI matching、native app、完整金流或 Teacher SaaS。
- 避免把 marketplace business logic 放進 page component。
- 避免把 UI 顯示判斷當成 security boundary。

## 5. 高風險邊界

以下變更必須先說明影響並取得產品主人確認：

- Auth provider、session、account linking 或 sign-in flow。
- Prisma schema、enum、relation 或 data model。
- Migration、`db push`、seed、production database 操作。
- Permissions / capability model、admin assignment、role 判斷。
- Marketplace state machines 或 state transition rules。
- Production / deploy / release 設定。
- Secrets、`.env`、OAuth credentials、database connection string。

若無法確認 database environment，必須停止，不可執行 migration 或資料更新。

## 6. High-risk Planning Gate

當 Codex 擔任 Planning / Orchestrator，並判斷下一步任務涉及以下任一高風險邊界時，不得直接產出 Builder implementation prompt：

- Auth
- Prisma schema
- migration
- `db push`
- permissions / capability model
- state machines
- core user flows
- production / deploy
- secrets / `.env`

Planning / Orchestrator 必須先產出 planning-only decision prompt，要求下一輪只做只讀分析，不修改檔案。

Decision plan 必須包含：

1. 目前狀態。
2. 可選方案。
3. 推薦方案。
4. 風險。
5. 需要產品主人確認的決策。
6. 確認後才可進入 implementation slice。

Planning / Orchestrator 每次建議下一個 slice 時，都應先說明：

- `slice type`: micro / standard / batch。
- 是否觸發 high-risk planning gate。
- 如果觸發，只產出 planning-only prompt，不產出 implementation prompt。

只有在產品主人明確確認 decision plan 後，才可產出 Builder implementation prompt。若尚未取得確認，Codex 應停在 planning-only 狀態，不得修改檔案、執行 migration、`db push`、commit 或 push。

## 7. 測試與回報

Codex 應根據變更風險執行適當測試：

- Docs-only change：通常回報 read-back、`git status --short`、`git diff --stat` 即可。
- TypeScript / UI change：優先考慮 typecheck、lint、build 或相關 smoke test。
- Domain / permission / state machine change：應補 unit tests 或至少說明測試缺口。
- Auth / Prisma change：需特別回報安全、migration、schema 與環境風險。

完成後回報：

- Changed files。
- Diff summary。
- Tests run 與結果。
- Risks / follow-ups。
- 是否有未完成事項。
- 是否沒有自動 commit / push。

如果檔案是 untracked，需說明 `git diff --stat` 可能不會顯示該檔案，並搭配 `git status --short` 回報。

## 8. Commit / Push 規則

- Codex 不自動 commit。
- Codex 不自動 push。
- 只有在使用者明確要求時才 commit。
- Push 必須另行明確要求，即使 commit 已建立也不可自動 push。
- Commit 時只 stage 使用者要求的檔案，避免帶入不相關變更。

## 9. Docs-only Commit / Push Exception

低風險 docs-only change 可以有 commit + push 例外，但只有在產品主人明確要求「commit + push」時才可執行。

此例外只適用於 docs-only changes，例如：

- `docs/**/*.md`
- `README.md`
- `AGENTS.md`

此例外不適用於：

- `src/**`
- `prisma/**`
- `package.json`
- `package-lock.json`
- config files
- migrations
- Auth / permission / capability logic
- environment files
- production / deploy settings

即使是 docs-only change，Codex 仍必須：

1. 回報 changed files。
2. 確認沒有 stage 不相關檔案。
3. 使用清楚 commit message。
4. 只有在明確批准後 push。
5. Push 後回報 `git status -sb`。
