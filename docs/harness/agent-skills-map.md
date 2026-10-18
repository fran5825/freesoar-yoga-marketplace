# Agent Skills Map

This project may use `addyosmani/agent-skills` as an engineering discipline layer.

Use skills selectively. Do not load unnecessary skills into every task.

## Define

Use:

- spec-driven-development

For:

- PRD
- page specs
- flow specs
- data model changes
- state machine changes

## Plan

Use:

- planning-and-task-breakdown

For:

- task breakdown
- sprint planning
- feature decomposition

## Build

Use:

- incremental-implementation
- frontend-ui-engineering
- api-and-interface-design

For:

- React components
- forms
- route handlers
- calendar UI
- dashboard UI
- API/service design

## Verify

Use:

- test-driven-development
- debugging-and-error-recovery

For:

- unit tests
- integration tests
- e2e tests
- bug triage

## Review

Use:

- code-review-and-quality
- security-and-hardening

For:

- auth
- role permissions
- marketplace data access
- form validation
- admin actions
- sensitive data

## Ship

Use:

- ci-cd-and-automation
- shipping-and-launch

For:

- deployment
- release checklist
- production readiness

## Recommended Mapping by Feature

### Teacher Onboarding

- spec-driven-development
- frontend-ui-engineering
- api-and-interface-design
- security-and-hardening
- code-review-and-quality

### Demand Request

- spec-driven-development
- planning-and-task-breakdown
- api-and-interface-design
- test-driven-development
- security-and-hardening

### Teacher Calendar

- spec-driven-development
- frontend-ui-engineering
- incremental-implementation
- test-driven-development
- code-review-and-quality

### Enrollment

- spec-driven-development
- api-and-interface-design
- security-and-hardening
- test-driven-development
- shipping-and-launch

### Admin Dashboard

- spec-driven-development
- code-review-and-quality
- security-and-hardening
- frontend-ui-engineering

## Matt Pocock skills 閉環流程（專案內客製版）

`.claude/skills/` 裡收了 Matt Pocock skills 的飛索版。每個 `SKILL.md` 開頭都有「Free Soar Yoga 專案覆寫」一節，內容優先於下方原文：不用 issue tracker、不開 PR、遵守 Human Gate 與 commit gate。

| 步驟 | 指令 | 產出 |
|---|---|---|
| 想清楚 | `/grill-with-docs` | 一題一題問到決定都清楚，同時更新 `docs/context/glossary.md` 與 `docs/adr/` |
| 寫 spec | `/to-spec` | `docs/specs/<feature-slug>-spec.md` |
| 切票 | `/to-tickets <spec 路徑>` | `docs/superpowers/plans/<feature-slug>/tickets/*.md`，每張標好 Workflow mode／Human Gate |
| 實作（一票一票） | `/implement <票路徑>` | 先寫測試再寫程式（`tdd`），最後跑 `/code-review` |
| 實作（整份 spec 並行） | `/implement-spec <spec 路徑>` | 多個 subagent 在 integration branch 並行做票，只用在大功能 |
| 審查 | `/code-review` | Claude Code 內建版本 |
| 回顧 | `/retro` | 依嚴重度列出要改的規則、檢查或文件；產品主人挑選後才修改，下一輪就套用 |

`pr` skill 先不收：目前還沒上線，直接進 main。正式上線、改成走 PR 之後再評估。
