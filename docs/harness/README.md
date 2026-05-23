# Harness README

## 1. 本 Harness 的定位

本 Harness 是 Free Soar Yoga repo 的 AI 協作開發入口。

Free Soar Yoga 是 Free Soar master brand 下的 brand-driven yoga marketplace，不是通用 SaaS、不是純 booking tool，也不是低價課程 marketplace。本 repo 的 AI 協作必須服務 V1 瑜伽團課 marketplace，並保留品牌精神、權限邊界、狀態機與 MVP-first 的開發節奏。

本 Harness 的用途，是讓 Codex / AI agent 在本產品 repo 中穩定協作：先理解 context，再規劃最小切片，接著實作、測試、自我 review 與回報。

## 2. 必讀文件地圖

開始任何非 trivial 任務前，先依任務類型讀取相關文件：

- `AGENTS.md`：repo 最高規則、V1 scope、AI 禁止事項與品質要求。
- `docs/context/*`：品牌定位、創辦人意圖、語氣與視覺方向。
- `docs/scope/*`：V1 scope、non-goals、future expansion。
- `docs/domain/*`：roles、permissions、data model、state machines、marketplace rules。
- `docs/engineering/*`：Auth、Prisma、local development、capability helper、first admin 等工程邊界。
- `docs/harness/workflow.md`：spec → plan → build → test → review → ship 工作流程。
- `docs/harness/codex-first-chatgpt-reviewed-control-loop.md`：Codex 先產生 repo-aware draft，ChatGPT 再做治理 review 的 AI 開發控制迴路。
- `docs/harness/controlled-automation-loop.md`：定義 Codex 在本 repo 可使用的受控自動化層級，包括 Planning-only、Approved Builder、低風險 docs cleanup、human gate、high-risk 降級與 commit / push governance。
- `docs/harness/risk-based-workflow.md`：依任務風險選擇 Light / Standard / Heavy / Planning-only workflow。
- `docs/harness/review-packet-spec.md`：定義 triage、planning、builder、final review packet 的必要材料。
- `docs/harness/chatgpt-governance-review.md`：ChatGPT 作為上層治理 reviewer 時的品牌、scope、風險、verdict 與 prompt 校正準則。
- `docs/prompts/controlled-automation-task-prompt.md`：通用任務啟動 prompt，讓 RD 用短任務描述要求 Codex 依 Controlled Automation Loop 自行判斷 automation level、human gate、Planning-only 或 Approved Builder 流程。
- `docs/prompts/codex-repo-aware-triage-prompt.md`：任務開始前讓 Codex 先做 repo-aware triage 的操作 prompt。
- `docs/prompts/chatgpt-governance-review-prompt.md`：讓 ChatGPT review Codex triage / planning draft 並產出治理 verdict 的操作 prompt。
- `docs/harness/builder-review-packet-template.md`：Codex Builder 完成後交給 ChatGPT final review 的回報格式。
- `docs/harness/ai-runs-current-spec.md`：定義 `.ai-runs/current/` local-only run folder 的最小規格。
- `docs/harness/codex-working-protocol.md`：Codex 在本 repo 的實際工作方式。
- `docs/harness/codex-self-review-checklist.md`：Codex 修改後的自我檢查。
- `docs/harness/review-checklist.md`：產品、品牌、工程、RWD、app-readiness review。
- `docs/harness/security-checklist.md`：Auth、data access、forms、admin、secrets 安全檢查。

## 3. 常見任務文件路線

### Brand / copy / UI 任務

優先閱讀：

- `AGENTS.md`
- `docs/context/free-soar-yoga-positioning.md`
- `docs/context/brand-rules.md`
- `docs/context/founder-intent.md`
- `docs/context/voice-and-tone.md`
- `docs/context/visual-direction.md`
- `docs/harness/review-checklist.md`

### Auth / Prisma / capability 任務

優先閱讀：

- `AGENTS.md`
- `docs/engineering/prisma-auth-initialization-plan.md`
- `docs/engineering/auth-entry-strategy.md`
- `docs/engineering/session-capability-helper-strategy.md`
- `docs/engineering/first-admin-strategy.md`
- `docs/engineering/local-development.md`
- `docs/domain/permissions.md`
- `docs/domain/permissions-matrix.md`

### Marketplace domain 任務

優先閱讀：

- `AGENTS.md`
- `docs/scope/v1-scope.md`
- `docs/scope/non-goals.md`
- `docs/domain/data-model.md`
- `docs/domain/permissions.md`
- `docs/domain/permissions-matrix.md`
- `docs/domain/state-machines.md`
- `docs/domain/state-transition-details.md`
- 對應的 `docs/specs/*`

### Review 任務

優先閱讀：

- `AGENTS.md`
- `docs/harness/codex-self-review-checklist.md`
- `docs/harness/review-checklist.md`
- `docs/harness/security-checklist.md`
- `docs/context/founder-intent.md`
- 受影響的 scope、domain、engineering 文件。

### Codex workflow / ChatGPT governance 任務

優先閱讀：

- `AGENTS.md`
- `docs/harness/workflow.md`
- `docs/harness/codex-first-chatgpt-reviewed-control-loop.md`
- `docs/harness/controlled-automation-loop.md`
- `docs/harness/risk-based-workflow.md`
- `docs/harness/review-packet-spec.md`
- `docs/harness/chatgpt-governance-review.md`
- `docs/harness/codex-working-protocol.md`
- `docs/harness/codex-self-review-checklist.md`
- `docs/prompts/codex-repo-aware-triage-prompt.md`
- `docs/prompts/chatgpt-governance-review-prompt.md`
- `docs/harness/builder-review-packet-template.md`
- `docs/harness/ai-runs-current-spec.md`

當任務要從手動協作升級到較自動化流程時，Codex 應先閱讀 `docs/harness/controlled-automation-loop.md`，判斷本輪任務適合的 automation level，並確認是否需要 Planning-only、human gate 或降級處理。

## 4. 操作 Prompt 與 Run Folder

本 Harness 可使用下列最小操作文件支援手動 ChatGPT ↔ Codex App 流程：

- `docs/prompts/codex-repo-aware-triage-prompt.md`：讓 Codex 在不改檔的前提下先讀 repo、判斷任務類型、風險、workflow mode、human gate 與 Builder prompt candidate。
- `docs/prompts/controlled-automation-task-prompt.md`：通用任務啟動 prompt；當 RD 只提供短任務描述時，Codex 應先做 repo status check、task classification 與 automation level decision，再決定本輪只能 Planning-only，或是否可依明確授權進入 Approved Builder。
- `docs/prompts/chatgpt-governance-review-prompt.md`：讓 ChatGPT review Codex triage / planning draft，檢查品牌精神、founder intent、low-pressure UX、MVP slicing、scope creep 與風險分類。
- `docs/harness/builder-review-packet-template.md`：定義 Builder 完成後必須提供的 task request、approved prompt、changed files、git diff、checks result、summary、risk notes 與 unfinished items。
- `docs/harness/ai-runs-current-spec.md`：定義 `.ai-runs/current/` local-only 暫存資料夾，用來保存單次任務的手動協作紀錄。

`.ai-runs/current/` 不屬於正式 docs，也不應 commit；可用來暫存本次任務的 triage、governance review、approved Builder prompt、Builder review packet、final review 與 human decision record。

## 5. AI 協作原則摘要

- MVP-first：先完成最小可驗證 V1 marketplace slice。
- One minimal slice at a time：避免一次打開過多產品、資料、權限與 UI surface。
- No complex RBAC：V1 採 capability-based model，不提前建立複雜 RBAC。
- No scope expansion：不自動擴大到 Wellness、Academy、Retreat、advanced AI matching、native app、完整金流或 Teacher SaaS。
- No automatic migration / commit / push：Codex 不自動執行 migration、commit 或 push。
- Product owner confirmation required：任何影響 Auth、Prisma schema、permissions / capability model、state machines、V1 scope 或核心 user flows 的變更，都必須先說明影響並取得產品主人確認。
