# Implementation Review Checklist

## 1. 文件目的

本 checklist 用於審查 Codex / AI builder 完成的實作結果。

Review 重點是確認 scope、diff、tests、docs、安全、權限、狀態機、品牌與 V1 scope 是否一致。它是 reviewer thread 或人類 reviewer 的正式檢查入口，不取代產品主人的最終判斷。

## 2. Review 前必讀

Reviewer 應先閱讀：

- `AGENTS.md`
- `docs/harness/README.md`
- `docs/harness/codex-working-protocol.md`
- `docs/harness/mvp-slicing.md`
- `docs/harness/review-checklist.md`
- `docs/harness/security-checklist.md`
- `docs/context/founder-intent.md`
- 受影響的 `docs/domain/*`
- 受影響的 `docs/engineering/*`
- 受影響的 `docs/scope/*`
- 受影響的 `docs/product/*`

## 3. Scope Review

檢查：

- 是否只完成指定任務。
- 是否符合本次 slice type。
- 是否有 scope drift。
- 是否偷渡 Wellness / Academy / Retreat / advanced AI matching / native app。
- 是否把 marketplace 做成 generic SaaS / booking tool / discount marketplace。

## 4. Files and Diff Review

檢查：

- Changed files 是否合理。
- 是否有不相關檔案。
- 是否修改 source code / config / package / Prisma / Auth。
- 是否有 untracked files。
- Diff 是否可理解、可 rollback。

## 5. Product and Brand Review

檢查：

- 是否符合 Free Soar Yoga positioning。
- 是否符合 founder intent。
- 是否尊重 teachers、organizers、members、admins。
- 是否避免焦慮式行銷、低價促銷、未證實療癒宣稱。
- 對外 UI / copy 是否符合 voice-and-tone 與 visual-direction。

## 6. Engineering Review

檢查：

- 是否符合 existing codebase pattern。
- 是否避免過度工程化。
- 是否避免不必要抽象。
- 是否保持 business logic 與 page component 的邊界。
- 是否符合 App Router / TypeScript / Tailwind / Prisma / Auth.js 的目前方向。

## 7. Auth / Prisma / Permission / State Machine Review

檢查：

- 是否不必要碰 Auth。
- 是否不必要改 Prisma schema。
- 是否不必要新增 migration。
- 是否維持 capability-based model。
- 是否避免 complex RBAC。
- 是否需要更新 permissions / state-machines docs。
- 高風險變更是否已有產品主人確認。

## 8. Tests Review

檢查：

- Tests 是否對應風險。
- Docs-only 是否有合理 read-back / git status。
- TS / UI change 是否需要 lint / typecheck / build。
- Domain / permission / state machine 是否需要 unit tests。
- Auth / Prisma 是否需要額外 smoke 或 safety check。

## 9. Docs Review

檢查：

- 是否需要同步 docs。
- 是否造成文件矛盾。
- 是否應更新 `AGENTS.md`、harness、domain、engineering、scope 或 ADR。

## 10. Verdict

Reviewer 應用以下其中一種結論：

- `APPROVE`：可接受，沒有 blocking issue。
- `REQUEST CHANGES`：需要修正後再接受。
- `REJECT`：方向或風險不符合本 repo，需重新切片或重做。

結論需列出：

- Required changes：必須修正項目。
- Optional suggestions：可延後或非必要建議。
- Commit readiness：是否可以 commit。
- Push readiness：是否可以 push。
