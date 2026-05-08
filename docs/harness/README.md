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

### Codex workflow 任務

優先閱讀：

- `AGENTS.md`
- `docs/harness/workflow.md`
- `docs/harness/codex-working-protocol.md`
- `docs/harness/codex-self-review-checklist.md`

## 4. AI 協作原則摘要

- MVP-first：先完成最小可驗證 V1 marketplace slice。
- One minimal slice at a time：避免一次打開過多產品、資料、權限與 UI surface。
- No complex RBAC：V1 採 capability-based model，不提前建立複雜 RBAC。
- No scope expansion：不自動擴大到 Wellness、Academy、Retreat、advanced AI matching、native app、完整金流或 Teacher SaaS。
- No automatic migration / commit / push：Codex 不自動執行 migration、commit 或 push。
- Product owner confirmation required：任何影響 Auth、Prisma schema、permissions / capability model、state machines、V1 scope 或核心 user flows 的變更，都必須先說明影響並取得產品主人確認。
