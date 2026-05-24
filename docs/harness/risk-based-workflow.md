# Risk-based Workflow

## 1. 文件目的

本文件定義 Free Soar Yoga repo 的風險分級 AI 協作流程。

核心原則：

> Workflow weight must match task risk.

不是每個任務都需要完整 Planning → Builder → Reviewer → ChatGPT Final Review → Human Gate。小任務應保持輕量；高風險任務必須先停在 planning / decision gate，不可直接進入實作。

本文件搭配：

- `docs/harness/codex-first-chatgpt-reviewed-control-loop.md`
- `docs/harness/chatgpt-governance-review.md`
- `docs/harness/review-packet-spec.md`
- `docs/harness/mvp-slicing.md`

## 2. 核心原則

- Codex owns repo awareness：Codex 先根據 repo 現況、docs、source files 做 triage。
- ChatGPT owns governance review：ChatGPT 檢查品牌精神、MVP 節奏、風險分類與 prompt 是否安全。
- Human owns irreversible decisions：產品主人保留 high-risk approval、commit、push 等不可逆決策。
- No diff, no final approval：沒有 diff / patch，不做 final approve。
- Brand spirit is part of technical review：品牌精神、founder intent、low-pressure UX 是 review 的一部分，不是額外裝飾。

## 3. Triage First

每個非 trivial 任務開始前，Codex Planning / Orchestrator 應先做 repo-aware triage。

Triage 應輸出：

```text
Task summary:
- 任務目標與使用者原始需求。

Repo context read:
- 已讀取的 AGENTS.md、docs、source files。

Task type:
- docs / copy / UI / domain / data / auth / permission / state machine / config / refactor / other。

Risk level:
- low / medium / high。

Recommended workflow mode:
- LIGHT / STANDARD / HEAVY / PLANNING_ONLY。

Slice type:
- micro / standard / batch，並說明理由。

Likely files to inspect:
- 預計需要閱讀的檔案。

Likely files to change:
- 預計可能修改的檔案。

Files not allowed to change:
- 本任務不應碰的檔案或目錄。

Risk flags:
- Auth / Prisma / migration / permission / state machine / package / env / deploy / production data / payment / large refactor / brand / low-pressure UX。

Human gate:
- 是否需要產品主人 approve，原因是什麼。

Auto Builder Decision:
- Can auto-enter Builder: yes/no。
- Risk level。
- Required human gate: yes/no。
- Reason。
- If yes：產出完整可執行 Builder Prompt，且最後包含固定 Output Report Requirement。
- If no：只產出 Builder Prompt Draft，停在 Human Gate 等 RD approval。

Recommended next step:
- 直接 small change / 進 planning draft / planning-only / 停止並要求 human decision。
```

## 4. Workflow Modes

### 4.1 Light Mode

#### 適用情況

Light Mode 適合低風險、範圍清楚、容易 review 的任務：

- docs-only 小修。
- typo / wording / copy 微調。
- 小型 UI wording。
- 小範圍樣式調整。
- 註解或 checklist 補充。
- 不碰 source code 的文件入口整理。

#### 不適用情況

只要碰到以下任一項，就不應使用 Light Mode：

- Auth / session / login / admin guard。
- Prisma schema / migration / database mutation。
- permissions / capability model / state machine。
- package / env / deploy / CI config。
- production data / payment。
- 大型重構或跨 domain 修改。

#### 流程

```text
Codex triage
↓
ChatGPT quick governance review, if needed
↓
Codex small change
↓
Builder packet: summary + changed files + diff + checks/read-back
↓
ChatGPT quick final review
↓
Human commit / push gate
```

#### 最低 review 材料

- task request。
- changed files。
- diff / patch。
- docs read-back 或必要 checks。
- Codex summary。

### 4.2 Standard Mode

#### 適用情況

Standard Mode 是本 repo 最常用的預設模式，適合一般小功能切片：

- 單一 UI component 或 route shell。
- 小型 form / validation。
- 單一 domain rule。
- 小範圍 server action 或 service layer。
- 小範圍 Prisma read/write，但不改 schema / migration。
- 可明確驗證、可 rollback 的功能 slice。

#### 流程

```text
Codex repo-aware triage
↓
Codex planning draft
↓
ChatGPT governance review + corrected Builder / Reviewer prompt
↓
Codex Builder execution
↓
Builder packet: result + changed files + diff + checks
↓
Codex Reviewer draft, if useful
↓
ChatGPT final review
↓
Human commit / push gate
```

#### 最低 review 材料

- task request。
- Codex triage / planning draft。
- ChatGPT governance review。
- approved / corrected Builder prompt。
- Builder result。
- changed files。
- diff / patch。
- lint / typecheck / build / test 結果，或未執行原因。
- Codex reviewer draft，如果有 source code 變更或風險中等以上。

### 4.3 Heavy Mode

#### 適用情況

Heavy Mode 適合高風險、不可逆、跨邊界或可能影響核心產品行為的任務：

- Auth / session / account linking / admin guard。
- Prisma schema / migration / seed / database data update。
- permission / capability model / role decision。
- marketplace state machine / core user flow。
- payment / refund / financial flow。
- package upgrade / dependency replacement。
- deployment / env / secret / CI config。
- production data。
- large refactor / cross-domain rewrite。

#### 流程

```text
Codex repo-aware triage
↓
Planning-only first
↓
ChatGPT deep governance review
↓
Human approve plan
↓
Codex Builder in isolated worktree, if approved
↓
Full checks
↓
Codex Reviewer draft
↓
ChatGPT final review with diff + checks
↓
Human commit gate
↓
Human push gate
```

#### Heavy Mode 硬規則

- 不得直接從 task request 進入 Builder。
- 必須先做 planning-only / decision plan。
- 必須列出方案、風險、rollback、驗證方式。
- 必須取得產品主人明確 approve 才能實作。
- 建議使用 isolated worktree。
- 不得自動 commit / push。

### 4.4 Planning-only Mode

#### 適用情況

Planning-only Mode 適合方向未定、範圍不明或需要先盤點 repo 的任務：

- 產品方向還需要選擇。
- 需求太大，需要拆 slice。
- 影響範圍不明。
- 可能碰 Auth / Prisma / permission / state machine，但尚未切清楚。
- 只想要 options / risk map / implementation strategy。

#### 流程

```text
Codex read-only repo analysis
↓
Options / risk map / recommended slice
↓
ChatGPT governance review
↓
Human decision
↓
產生下一個 Light / Standard / Heavy task
```

#### 硬規則

- 不改 code。
- 不新增 migration。
- 不更新 package。
- 不 commit / push。
- 輸出下一步建議，但不自動執行。

## 5. Risk Flags

Codex triage 與 ChatGPT governance review 都必須檢查以下 flags：

```text
AUTH_RISK
PRISMA_RISK
MIGRATION_RISK
PERMISSION_RISK
STATE_MACHINE_RISK
PACKAGE_RISK
ENV_SECRET_RISK
DEPLOY_RISK
PRODUCTION_DATA_RISK
PAYMENT_RISK
LARGE_REFACTOR_RISK
BRAND_RISK
LOW_PRESSURE_UX_RISK
SCOPE_DRIFT_RISK
```

只要出現 Auth / Prisma / migration / permission / state machine / package / env / deploy / production data / payment / large refactor，預設應升級為 Heavy 或 Planning-only。

Brand / low-pressure UX risk 不一定升級為 Heavy，但必須在 ChatGPT governance review 與 final review 中明確檢查。

## 6. Human Gate Rules

以下情況必須停下來等產品主人決策：

- ChatGPT verdict 是 `HUMAN_DECISION_REQUIRED`。
- Risk level 是 medium、medium-high 或 high。
- 任務被分類為 Heavy。
- Builder 需要超出 approved prompt 的修改。
- 需要改 Auth、Prisma schema、migration、permission、state machine、package、env、deploy 或 production data。
- 需要改 session、permission boundary、DB write behavior、role / capability、Admin、payment、email、notification、public onboarding policy、teacher application status flow、rejected / approved / suspended policy、`package.json` 或 `package-lock.json`。
- Scope ambiguous 或 missing verification plan。
- Checks fail 但 Codex 建議繼續。
- Diff 顯示未要求的檔案或 scope creep。
- 準備 commit / push。

## 6A. Auto-enter Builder Conditions

Auto-enter Builder 只適用於 low risk slice。它不是 commit / push 授權，也不是 merge 授權。

只有以下條件全部成立時，Planning / Orchestrator 才可以判斷 `Can auto-enter Builder: yes`：

1. Risk level = low
2. No Prisma schema / migration
3. No Auth / session / permission boundary
4. No payment / email / notification
5. No production data access
6. No public UX policy decision
7. Allowed files are narrow and explicit
8. Forbidden files are listed
9. Required checks are listed
10. Builder must not commit / push
11. Builder must output Review Packet

若任一條件不成立，`Can auto-enter Builder` 必須是 `no`，只能產出 Builder Prompt Draft，並停在 Human Gate 等 RD approval。

## 7. Mode Selection Matrix

| 任務類型 | 預設模式 | 備註 |
| --- | --- | --- |
| docs / wording / typo | Light | 若只是 docs-only，可 batch slice |
| 小型 UI copy / style | Light | 若涉及新 user flow，升 Standard |
| 一般 UI / form / route shell | Standard | 需 diff + checks |
| domain validation / state rule test | Standard 或 Heavy | 若碰 core state machine，升 Heavy |
| server action / service layer | Standard | 若碰 Auth / permission，升 Heavy |
| Prisma read/write 不改 schema | Standard | 需明確驗證 |
| Prisma schema / migration | Heavy | 必須 human gate |
| Auth / session / admin guard | Heavy | 必須 human gate |
| permission / capability model | Heavy | 必須 human gate |
| package / deploy / env | Heavy | 必須 human gate |
| 大型重構 | Planning-only | 先拆 slice，不直接 build |

## 8. 回報格式

Codex 或 ChatGPT 回報 workflow mode 時，請使用：

```text
Workflow mode: LIGHT / STANDARD / HEAVY / PLANNING_ONLY
Risk level: low / medium / high
Slice type: micro / standard / batch
Risk flags:
- ...
Human gate: yes / no
Auto Builder Decision:
- Can auto-enter Builder: yes/no
- Risk level:
- Required human gate: yes/no
- Reason:
- If yes: produce a complete executable Builder Prompt with Output Report Requirement.
- If no: produce Builder Prompt Draft only, and stop at Human Gate for RD approval.
Reason:
- ...
Next action:
- ...
```

## 9. 與 MVP Slicing 的關係

`risk-based-workflow.md` 決定流程重量；`mvp-slicing.md` 決定 slice 大小。

兩者可以交叉使用：

- Light workflow 通常對應 batch 或 standard slice。
- Standard workflow 通常對應 standard slice。
- Heavy workflow 通常需要 micro slice。
- Planning-only 通常用來把過大的需求拆成 micro / standard / batch slice。
