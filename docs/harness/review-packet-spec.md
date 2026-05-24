# Review Packet Spec

## 1. 文件目的

本文件定義 Codex / AI agent 在不同階段交給 ChatGPT Governance Reviewer、ChatGPT Final Reviewer 或 Human Owner 的 review packet 格式。

Review packet 的目的，是讓 ChatGPT 不依賴長 session 記憶，也不只根據 Codex summary 做判斷，而是可以根據固定、可檢查、可追溯的材料進行 review。

核心原則：

> No diff, no final approval.

如果沒有 diff / patch，ChatGPT 只能做 planning review 或 provisional review，不得建議 commit / push。

## 2. Packet 類型

本 repo 使用四種主要 packet：

1. Triage Packet
2. Planning Review Packet
3. Builder Review Packet
4. Final Review Packet

視任務模式不同，packet 要求如下：

| Workflow mode | Required packets |
| --- | --- |
| Light | Triage Packet, Builder Review Packet, Final Review Packet |
| Standard | Triage Packet, Planning Review Packet, Builder Review Packet, Final Review Packet |
| Heavy | Triage Packet, Planning Review Packet, Builder Review Packet, Final Review Packet, Human Decision Record |
| Planning-only | Triage Packet, Planning Review Packet |

## 3. Triage Packet

### 3.1 使用時機

任務開始時，由 Codex Planning / Orchestrator 產生。

### 3.2 必填欄位

```text
# Triage Packet

Task summary:
- 使用者原始需求。
- Codex 對任務的理解。

Repo context read:
- 已讀 `AGENTS.md` / docs / source files。
- 若未讀，說明原因。

Current repo state:
- branch。
- working tree 是否 clean。
- 是否有既有 untracked / modified files。

Task type:
- docs / copy / UI / domain / data / auth / permission / state machine / config / refactor / other。

Recommended workflow mode:
- LIGHT / STANDARD / HEAVY / PLANNING_ONLY。

Risk level:
- low / medium / high。

Slice type:
- micro / standard / batch。

Risk flags:
- AUTH_RISK / PRISMA_RISK / MIGRATION_RISK / PERMISSION_RISK / STATE_MACHINE_RISK / PACKAGE_RISK / ENV_SECRET_RISK / DEPLOY_RISK / PRODUCTION_DATA_RISK / PAYMENT_RISK / LARGE_REFACTOR_RISK / BRAND_RISK / LOW_PRESSURE_UX_RISK / SCOPE_DRIFT_RISK。

Relevant docs:
- 本任務相關文件。

Relevant files:
- 本任務相關 source / config / docs files。

Likely files to change:
- 預計可能修改的檔案。

Files not allowed to change:
- 本輪不應修改的檔案。

Non-goals:
- 本輪明確不做什麼。

Human gate:
- yes / no。
- 原因。

Recommended next action:
- small change / planning draft / planning-only / stop / ask human decision。
```

## 4. Planning Review Packet

### 4.1 使用時機

Codex 產生 planning draft 後，交給 ChatGPT Governance Reviewer review。

### 4.2 必填欄位

```text
# Planning Review Packet

Task request:
- 原始需求。

Triage summary:
- workflow mode。
- risk level。
- slice type。
- risk flags。

Repo context read:
- Codex 已讀文件與 source files。

Current state summary:
- 目前 repo / feature 狀態。

Proposed plan:
- 步驟 1。
- 步驟 2。
- 步驟 3。

Files to inspect:
- Builder 執行前應閱讀的檔案。

Files allowed to change:
- 允許修改的檔案。

Files not allowed to change:
- 不允許修改的檔案。

Brand / founder intent considerations:
- 是否影響品牌精神、teacher 主體性、low-pressure UX。

MVP / scope considerations:
- 是否符合 V1 scope。
- 是否有 scope drift。

Risk gates:
- 是否涉及 high-risk 項目。
- 是否需要 human approval。

Auto Builder Decision:
- Can auto-enter Builder: yes/no。
- Risk level。
- Required human gate: yes/no。
- Reason。
- If yes：產出完整可執行 Builder Prompt，且最後包含固定 Output Report Requirement。
- If no：只產出 Builder Prompt Draft，停在 Human Gate 等 RD approval。

Verification scope:
- lint / typecheck / test / build / manual check / docs read-back。

Suggested Builder prompt:
- Codex 建議的 Builder prompt。
- 最後必須固定包含：

```text
Output Report Requirement:
完成後請不要 commit / push，並回報：
1. Changed files
2. Full git diff
3. Checks result
4. Manual smoke result
5. Self review
6. Scope drift check：是否有任何超出本任務範圍的修改或判斷
```

Suggested Reviewer prompt:
- Codex 建議的 Reviewer prompt。

Open questions:
- 需要 ChatGPT 或產品主人判斷的問題。
```

## 5. Builder Review Packet

### 5.1 使用時機

Codex Builder 執行後，交給 ChatGPT Final Reviewer 或 Codex Reviewer。

### 5.2 必填欄位

```text
# Builder Review Packet

Task request:
- 原始需求。

Approved prompt:
- ChatGPT corrected Builder prompt 或產品主人 approve 的 prompt 摘要。

Implementation summary:
- 實際完成項目。

Changed files:
- 檔案 1：變更摘要。
- 檔案 2：變更摘要。

Diff / patch:
- 附上 `git diff` 或 patch 檔路徑。

Checks run:
- lint：pass / fail / not run，原因。
- typecheck：pass / fail / not run，原因。
- test：pass / fail / not run，原因。
- build：pass / fail / not run，原因。

Scope compliance:
- 是否只做 approved prompt 內的事。
- 是否有任何超出 scope 的變更。

Risk notes:
- Auth / Prisma / permission / state machine / package / env / deploy / data / brand / low-pressure UX 風險。

Docs impact:
- 是否需要同步 docs。
- 是否已同步。

Rollback notes:
- 如何最小化 rollback。

Known limitations:
- 未完成事項或刻意不做的事。

Builder self-review:
- Codex 對本次變更的自我檢查。
```

## 6. Final Review Packet

### 6.1 使用時機

ChatGPT 要做 final review、commit readiness 或 push readiness 判斷前使用。

### 6.2 必填欄位

```text
# Final Review Packet

Task request:
- 原始需求。

Workflow mode:
- LIGHT / STANDARD / HEAVY / PLANNING_ONLY。

Triage packet summary:
- risk level。
- slice type。
- risk flags。

Governance review summary:
- ChatGPT 先前的 governance verdict。
- corrected prompt 摘要。

Builder packet:
- implementation summary。
- changed files。
- diff / patch。
- checks result。

Codex reviewer draft:
- Codex reviewer verdict。
- required changes。
- optional suggestions。

Brand / low-pressure UX review:
- 對外 UI / copy / CTA / form / empty / loading / error states 是否符合品牌。

Security / permission / data review:
- 是否涉及高風險資料或權限。

Docs review:
- 是否需要更新文件。

Human decisions:
- 已取得的產品主人確認。
- 尚未取得的決策。

Commit readiness:
- ready / not ready / human decision required。

Push readiness:
- ready / not ready / human decision required。

Recommended next action:
- approve / request changes / stop / ask human decision / commit gate / push gate。
```

## 7. Human Decision Record

Heavy Mode 或任何 high-risk gate 都必須記錄 human decision。

```text
# Human Decision Record

Decision needed:
- 需要產品主人判斷的事項。

Options:
- A。
- B。
- C。

AI recommendation:
- 推薦方案與原因。

Human decision:
- approve / reject / revise / defer。

Decision time:
- YYYY-MM-DD HH:mm。

Constraints:
- 產品主人附加限制。

Next allowed action:
- planning-only / builder / reviewer / commit / push / stop。
```

## 8. Missing Materials 規則

如果 final review packet 缺少以下材料，ChatGPT 不得給 final approve：

- changed files。
- diff / patch。
- checks result 或未執行原因。
- high-risk human decision record，如果任務有 high-risk flag。

可用 verdict：

- `PROVISIONAL_REVIEW`：材料不足，只能初步 review。
- `REQUEST_MORE_MATERIALS`：要求補齊 diff / checks / changed files / human decision。
- `STOP`：若材料不足且風險高。

## 9. 建議 Run Folder 對應

以下是較完整的 per-run / archival / expanded model，適合需要長期保存或完整審計的任務紀錄。若只是目前手動 ChatGPT ↔ Codex App 的單次 current run，可使用 `docs/harness/ai-runs-current-spec.md` 定義的 `.ai-runs/current/` local-only minimal model；兩者不是互相取代關係。

```text
.ai-runs/
  2026-05-16-001-task-name/
    00-task-request.md
    01-triage-packet.md
    02-planning-review-packet.md
    03-chatgpt-governance-review.md
    04-corrected-builder-prompt.md
    05-corrected-reviewer-prompt.md
    06-builder-review-packet.md
    07-diff.patch
    08-checks/
      lint.txt
      typecheck.txt
      test.txt
      build.txt
    09-codex-reviewer-draft.md
    10-final-review-packet.md
    11-chatgpt-final-review.md
    12-human-decision.md
    13-final-summary.md
```

## 10. Packet 品質要求

- Packet 必須自足，不依賴前一個長 ChatGPT / Codex session 的記憶。
- Packet 應引用實際檔案路徑。
- Packet 應區分「已確認事實」與「AI 推測」。
- Packet 不應隱藏 failed checks。
- Packet 不應只給 summary 而不給 diff。
- Packet 應明確列出 non-goals 與未完成事項。
