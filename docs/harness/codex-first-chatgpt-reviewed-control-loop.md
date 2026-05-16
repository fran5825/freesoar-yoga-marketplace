# Codex-first / ChatGPT-reviewed Control Loop

## 1. 文件目的

本文件定義 Free Soar Yoga repo 的半自動 AI 開發控制迴路。

核心原則：

> Codex 先根據 repo 現況產生 planning draft 與 prompt draft；ChatGPT 再根據品牌精神、MVP 節奏、工程邊界與安全規則做治理 review；通過後才讓 Codex Builder 執行。

此流程用於降低手動複製貼上的負擔，同時避免 AI 直接一路自動改 code、commit 或 push。

本流程必須搭配：

- `docs/harness/risk-based-workflow.md`
- `docs/harness/review-packet-spec.md`
- `docs/harness/chatgpt-governance-review.md`

## 2. 角色分工

### Human Owner

產品主人負責：

- 決定任務是否開始。
- approve high-risk plan。
- approve Builder 是否可執行。
- approve commit / push。
- 處理品牌、商業、權限、核心流程等最終決策。

### Codex Planning / Orchestrator

Codex 先讀 repo，產生 repo-aware 草案。

負責：

- 閱讀 `AGENTS.md`、相關 docs、相關 source files。
- 不改 code。
- 產出 repo 現況摘要、relevant files、risk、implementation plan。
- 產出 suggested builder prompt 與 suggested reviewer prompt。

### ChatGPT Governance Reviewer

ChatGPT 負責治理校正。

負責：

- review Codex planning draft。
- 檢查品牌精神、founder intent、low-pressure UX、V1 scope、MVP slicing。
- 判斷是否需要 human gate。
- 產生 corrected planning / builder / reviewer prompt。

### Codex Builder

Codex Builder 只在 planning 被 approve 後執行。

負責：

- 依 corrected builder prompt 改 code 或 docs。
- 不擴大 scope。
- 執行必要 checks。
- 產出 result、changed files、diff、checks summary。

### Codex Reviewer

Codex Reviewer 做 repo-local review。

負責：

- 根據 corrected reviewer prompt review diff。
- 不改 code。
- 檢查 scope、files、risk、tests、docs。

### ChatGPT Final Reviewer

ChatGPT 最後 review Builder result、diff、checks 與 Codex Reviewer draft。

負責：

- 判斷是否 approve / request changes / stop / human decision required。
- 建議 commit readiness / push readiness。
- 不取代產品主人做 commit / push 決策。

## 3. Run Folder 建議

每個任務建立一個 run folder。可先放在 local，不一定 commit。

本節描述的是較完整的 per-run / archival model；目前手動 MVP flow 可優先使用 `docs/harness/ai-runs-current-spec.md` 定義的 `.ai-runs/current/` minimal current-run model，不需要 automation。

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

## 4. State Machine

```text
NEW
↓
CODEX_TRIAGE_RUNNING
↓
CHATGPT_GOVERNANCE_REVIEW_REQUIRED
↓
APPROVE_LIGHT / APPROVE_STANDARD / APPROVE_HEAVY_WITH_HUMAN_GATE / PLANNING_ONLY / REQUEST_PLAN_CHANGES / REQUEST_MORE_MATERIALS / HUMAN_DECISION_REQUIRED / STOP
↓
BUILDER_RUNNING
↓
CODEX_REVIEW_REQUIRED
↓
CHATGPT_FINAL_REVIEW_REQUIRED
↓
APPROVE / APPROVE_WITH_LIMITS / REQUEST_IMPLEMENTATION_CHANGES / REQUEST_MORE_MATERIALS / HUMAN_DECISION_REQUIRED / STOP / PROVISIONAL_REVIEW
↓
COMMIT_READY
↓
PUSH_READY
↓
DONE
```

Blocked states：

```text
FAILED_CHECKS
SCOPE_CREEP_DETECTED
HIGH_RISK_GATE_REQUIRED
SESSION_ROTATION_REQUIRED
MISSING_REVIEW_MATERIALS
```

## 5. 流程模式

不要所有任務都走同樣重量。先由 Codex 做 triage，再由 ChatGPT review 分類是否合理。完整規則見 `docs/harness/risk-based-workflow.md`。

### Light Mode

適用：

- typo / wording。
- docs 小修。
- 小型 copy / style 調整。
- 不碰 Auth、Prisma、permission、state machine、package、env。

流程：

```text
Codex small change
↓
changed files + diff + summary
↓
ChatGPT quick review
↓
Human commit / push gate
```

### Standard Mode

適用：

- 一般小功能切片。
- 小型 UI / form / domain validation。
- 小範圍 server action 或 service layer。
- 可明確驗證、可 rollback。

流程：

```text
Codex planning draft
↓
ChatGPT governance review + corrected prompt
↓
Human approve builder if needed
↓
Codex builder
↓
Codex reviewer draft
↓
ChatGPT final review
↓
Human commit / push gate
```

### Planning-only Mode

適用：

- 方向未定。
- 任務過大，需要先拆 slice。
- 影響範圍不明。
- 可能碰 Auth / Prisma / permission / state machine，但尚未切清楚。

流程：

```text
Codex read-only analysis
↓
Options / risk map / recommended slice
↓
ChatGPT governance review
↓
Human decision
```

### Heavy Mode

適用：

- Auth / session / admin guard。
- Prisma schema / migration / production data。
- permission / capability / state machine。
- payment / package / deploy / env。
- large refactor / cross-domain change。

流程：

```text
Planning-only first
↓
ChatGPT deep governance review
↓
Human approve plan
↓
Codex builder in isolated worktree
↓
Full checks
↓
Codex reviewer
↓
ChatGPT final review with diff
↓
Human commit gate
↓
Human push gate
```

## 6. Review Packet 要求

所有交給 ChatGPT 或 Human Owner 的材料都應符合 `docs/harness/review-packet-spec.md`。

至少包含：

- Triage Packet。
- Planning Review Packet。
- Builder Review Packet。
- Final Review Packet。

## 7. Codex Planning Draft 輸出要求

Codex Planning / Orchestrator 必須輸出：

```text
1. Repo context read
2. Current state summary
3. Relevant docs
4. Relevant files
5. Proposed slice type: light / standard / heavy, or micro / standard / batch
6. Proposed plan
7. Files likely to change
8. Files that should not change
9. High-risk gates
10. Verification scope
11. Suggested Builder prompt
12. Suggested Reviewer prompt
```

## 8. ChatGPT Governance Review 輸出要求

ChatGPT 應根據 `docs/harness/chatgpt-governance-review.md` 輸出：

```text
1. Verdict
2. Brand / founder intent review
3. Low-pressure UX review
4. Scope and slice review
5. Risk gate review
6. Corrected Builder prompt
7. Corrected Reviewer prompt
8. Required before next step
9. Next recommended action
```

## 9. Builder 執行邊界

Builder 必須遵守：

- 只能依 corrected builder prompt 執行。
- 不新增未要求功能。
- 不自動 commit。
- 不自動 push。
- 不主動新增 migration / package / env change。
- 若發現需要擴 scope，停止並回報。
- 若發現 high-risk 變更，停止並要求 human decision。

## 10. Final Review 最小材料

ChatGPT final review 至少需要：

- `00-task-request.md`
- `01-triage-packet.md`
- `02-planning-review-packet.md`
- `03-chatgpt-governance-review.md`
- `04-corrected-builder-prompt.md`
- `06-builder-review-packet.md`
- `07-diff.patch`
- `08-checks/*`
- `09-codex-reviewer-draft.md`
- `10-final-review-packet.md`

若缺少 diff 或 checks，ChatGPT 只能給 provisional review，不可建議 commit / push。

## 11. Future Automation / Human Gate 建議

本節只描述未來 automation 可能支援的通知方向，不是目前 manual ChatGPT ↔ Codex App flow 的必要條件；目前流程不需要接 Hermes，也不需要接 Telegram。

未來若產品主人明確批准 automation，可以由 Hermes Agent 或其他 runner 在以下情況通知產品主人：

- Planning 被 ChatGPT 判斷為 high-risk。
- ChatGPT verdict 是 `HUMAN_DECISION_REQUIRED`。
- Builder 需要修改 Auth、Prisma、permission、state machine、package、env、deploy 設定。
- Checks fail。
- Reviewer verdict 是 `APPROVE`，準備 commit / push。

通知內容應包含：

```text
Task
Verdict
Risk level
Changed files
Checks result
Recommended next action
Approve / request changes / stop options
```

## 12. Session Rotation 規則

為避免 ChatGPT 或 Codex session 過長，每個任務完成後必須產生：

```text
13-final-summary.md
```

內容包含：

- 任務目標。
- 實際修改。
- 沒有修改的範圍。
- 重要決策。
- 檢查結果。
- commit / push 狀態。
- 後續任務候選。

下一個任務應從 clean context 開始，讀取 `13-final-summary.md` 與必要 docs，而不是依賴上一個長 session 的記憶。

## 13. Commit / Push 原則

AI 可以建議 commit message，但不得自行 commit / push。

commit / push 前必須確認：

- ChatGPT final review 已看過 diff。
- 必要 checks 通過。
- 沒有未要求的 high-risk change。
- 產品主人已明確 approve。
