# Codex Builder Reviewer Workflow Prompt

## 1. 使用目的

本 prompt 用於讓 Codex 在同一個 session 內完成 Builder + Reviewer workflow。

目標是讓 Codex 可以依序完成 implement、self-review、reviewer review、必要修正與 final report，減少產品主人在 ChatGPT、VS Code、Codex 之間人工搬運 prompt 與結果。

本 workflow 適合低風險 docs-only、小 UI、小 helper 或邊界清楚的 standard slice；高風險任務仍應先做 plan review 或另開 Reviewer thread。

除非使用者明確要求英文，回報內容請以繁體中文為主；技術名稱、檔案路徑、指令與程式碼識別字可保留英文。

## 2. 使用方式

使用者可直接貼以下格式：

```text
請依 docs/prompts/codex-builder-reviewer-workflow.md 執行本任務：

[任務內容]
```

Codex 應先閱讀本文件與相關 harness / context 文件，再依下方 workflow 執行。

## 3. Workflow

### Phase 1: Builder Planning

- 閱讀必要文件。
- 判斷 slice type：micro / standard / batch。
- 說明判斷原因。
- 提出 plan。
- 若涉及 Auth、Prisma、migration、permissions、state machines、core user flows、production / deploy，先停下，不要實作。

### Phase 2: Builder Implementation

- 只實作已確認的 scope。
- 不自動擴大 scope。
- 不碰不相關檔案。
- 不讀取 `.env`。
- 不自動 commit。
- 不自動 push。

### Phase 3: Builder Self-review

- 依 `docs/harness/codex-self-review-checklist.md` 自查。
- 回報 changed files、diff summary、tests run、risks、follow-ups。
- 若有 untracked files，說明 `git diff --stat` 可能不會顯示。

### Phase 4: Reviewer Review

- 切換為 Reviewer 角色。
- Reviewer 不是 Builder。
- 預設不要修改檔案。
- 依 `docs/prompts/codex-reviewer-prompt.md` 與 `docs/review/implementation-review-checklist.md` 審查。
- 給出 `Verdict: APPROVE / REQUEST CHANGES / REJECT`。

### Phase 5: Fix if Needed

- 如果 Reviewer 是 `REQUEST CHANGES`，回到 Builder 角色修正。
- 修正後再次 self-review。
- 必要時再次 reviewer review。
- 若修正會超出原 scope 或碰到高風險邊界，先停下並請產品主人確認。

### Phase 6: Final Report

最後回報：

1. Slice type
2. Builder summary
3. Reviewer verdict
4. Changed files
5. Tests run
6. Risks / follow-ups
7. Commit readiness
8. Push readiness

## 4. Commit / Push Rules

- 不自動 commit。
- 不自動 push。
- Docs-only change 只有在產品主人明確說「commit + push」時，才可以同一輪 commit + push。
- Code / config / Prisma / Auth / permission / migration / production 相關變更，不適用 docs-only exception。
- Push 必須明確要求。
- Commit 前必須確認 staged files 只包含產品主人要求的檔案。
- Push 後必須回報 `git status -sb`。

## 5. When to Use Separate Reviewer Thread

同一 session 的 Builder + Reviewer workflow 適合：

- Docs-only change。
- 小型 UI 調整。
- 小型 helper。
- 低風險 standard slice。
- 清楚可 rollback 的 batch slice。

建議另開 Reviewer thread，或先只做 plan review 的情況：

- 涉及 source code 的大範圍變更。
- 涉及 route、server action、service layer 或 domain rule。
- 涉及 Auth、Prisma、migration、permissions、capability model、state machines。
- 涉及 teacher approval、demand publishing、response selection、class creation、enrollment 等 core user flows。
- 涉及 production / deploy settings。
