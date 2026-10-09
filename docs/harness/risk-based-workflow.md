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

### 4.2A STANDARD 精簡執行

適用於範圍與驗收已明確核准的 STANDARD 任務；只精簡重複讀取、prompt 與報告，不改風險分類或授權。以下規則是共用依據，其他 Harness 文件引用即可，不再各自複製完整內容。

#### 按需讀檔與 prompt

- 起手讀 `AGENTS.md`、權威 spec、plan／票券索引與當前票；本節在首次使用或規則變動時讀取。沒有票券時改讀該任務核准範圍；缺少必要授權則回 planning。
- 只補讀與本票實際修改有關的 source、domain／permissions、品牌或測試設定。風險未定、治理變更、HEAVY 與實際交接，仍須讀相應規範。
- 同一 session 已讀且未變的文件不重讀；檔案被其他 task 修改、context 壓縮後資訊不足或跨 session 時，重讀所需內容。
- Prompt 只交代六項：目標、權威文件、核准範圍與禁止事項、驗證、停止條件、交付。引用 spec／acceptance criteria，不重述產品規則或塞入不適用的模板欄位。
- 首次落實具體 allowed files；已有核准清單時引用它，後續票只記新增檔案／範圍差異。票券只有功能描述時不能假定已具備 source 清單；範圍外修改仍需核准。

#### 每票紀錄與正式 packet

- 在既有票券／plan 記錄每票約 3–5 行：完成項及修改檔案、checks 命令／結果或 log 位置、未驗證項／阻塞、self review 與 scope drift。必要證據可另存並引用，不為行數限制隱藏問題。
- 同一已核准任務可維護一份累積 review packet；triage、planning、各票結果及證據可分節或引用原文件，不要求每票另建完整 packet。
- 任務完成、實際移交或阻塞需人接手時，整理自足的正式 packet，包含本工作 diff／新增檔、驗證、限制及完整 Common Handoff Schema。獨立 Reviewer 的必要 findings／verdict 不省略。
- 內部票進度不套 final report 的 L1／L2／L3 與 1／2 問題；對使用者的實際 final report 仍遵守 `AGENTS.md`。
- 每票驗收後才標完成。只有多票明確獲准、依賴已滿足且未觸發停止條件，才接續下一票；短紀錄不構成新授權。

#### 驗證安排

- 每票依修改做必要 TypeScript、lint、outcome tests 與受影響 smoke；docs-only 用 diff／read-back，不機械套用程式 checks。
- 正式 smoke 必須測目前 source：若測試以 `next start` 啟動，先完成有效 build，並確保使用該 build 的測試 server，不能重用仍提供舊產物的 server。
- 先檢查 package scripts 的前置 hook；本 repo `npm run test:smoke` 已透過 `pretest:smoke` build，勿另先 build 一次。使用 `npx playwright test` 則須先 build；build 後 source 有變要重新建置，不以「只在特定票號 build」替代。
- 同一版本已通過的 checks 不重跑，除非新修改、失敗或未解疑慮影響它；最終 build 與必要完整旅程驗收仍須有有效結果，不能把未執行或舊版本結果寫成通過。
- 每票檢查修改畫面的手機／電腦、鍵盤及關鍵錯誤；同頁連續修改可在已核准的驗證安排中集中完整多寬度 QA，完成時仍須提供規格要求的 RWD 證據。既有 prompt／票券明列的必跑 checks 不自動刪除或延後。
- 使用隔離的本機測試 port，保留其他 task 程序與資料；外部失敗如實記錄，不能為通過 checks 修改未核准區域。

本節不放寬 Auth、schema／migration、permissions、state machine、通知、production、套件、deploy、V1 scope 或 commit／push 邊界；不得以 STANDARD 精簡取代 HEAVY planning 或產品決策。

### 4.3 Heavy Mode

上述 STANDARD 精簡規則不適用於 HEAVY 的 planning、Human Gate 或必要驗證要求。

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

### 4.3A 已核准 HEAVY 多票紀錄

適用於已有 planning／產品主人決策、明確多票接續授權與逐票範圍的任務。只減少重複敘述，不套用 STANDARD 的風險豁免，不縮減 HEAVY 所需 review 材料、驗證或 Human Gate。

- 任務起手讀權威 spec、索引與涉及的治理規範；當票核對核准引用、allowed files、風險、依賴、checks／rollback。已讀且未變的內容可引用，缺少上下文或外部變更時補讀。
- 原決策覆蓋當票時引用 decision record，不重問同項批准；決策紀錄不完整、新模型／權限／state 選擇、資料庫操作未明確授權或範圍變更仍停在 Human Gate。
- 每票在既有 plan／ticket 記完成項、修改檔案、checks／log、未驗證項、self review／scope drift，以及 decision／review／patch 引用；必要內容不能為了行數限制省略。累積 packet 可分節保留每票完整證據，無須重抄 spec 或另建同樣的 packet。
- 內部短進度不是 final report；正式 Human Gate、獨立 review、任務完成、實際移交或阻塞需人接手時，提供自足材料與完整 Common Handoff Schema。可以引用完整 patch／log／既有決策，但不能只交摘要讓 Reviewer 猜測。
- 獨立 review 不得以 Builder self review 代替；每票核准、依賴、必要 checks 與 review 均滿足，且沒有停止條件，才可依原多票授權接續。需人參與的 gate 未完成時不得先做下一票。
- 保留當票既定 checks；僅依修改檢查受影響畫面，完整 RWD 的集中安排須符合已核准驗證計畫。不得以精簡名義測舊 build、略過並發／權限測試或取消明列必跑 checks。

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

已有明確批准且覆蓋當票的事項依 4.3A 引用原決策；仍須核對全部前置與操作授權。下列 gate 不因縮短紀錄而取消，也不因曾核准另一張票就視為已放行。

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

## 10. 未 commit 的 Baseline 與 Patch

此處為差異保存的共用規則，不要求 commit，也不授權 reset、clean、stash、還原或覆寫其他工作。

1. 任務起手記錄 repo／branch／HEAD、working tree 路徑與既有 dirty／untracked 狀態，區分授權修改與僅供背景的檔案。僅在已明確授權且能安全保留既有變更時，於 dirty workspace 繼續。
2. 使用獨立 local-only run 目錄，保存 allowed files 的 task-start 快照；每票修改前另存 ticket-start 快照。Manifest 記相對路徑、是否存在與 checksum，新增 allowed file 須在第一次修改前加入，不能事後補造基線。
3. 保留檔案原位元組；涵蓋原有未提交內容。以 ticket-start→ticket-end 產生逐票 patch，以 task-start→task-end 產生累積 patch。新增、刪除、改名及原有 untracked 檔需有明確前後狀態，不能只用 HEAD→working tree 認領全部變更。
4. 可使用 `git diff --no-index -- <before> <after>` 或等效前後比較，不修改 index；此命令 exit 1 表示有差異，exit 大於 1 才是執行錯誤。原始完整 patch、檔案映射及 checks 保存為證據，Reviewer 能找到並讀取。
5. 寫入前核對檔案仍符合當票預期版本；發現同檔外部修改、無法確認 hunk 來源或缺少 baseline 時，停止受影響修改並協調，不把混合 diff 冒稱精準歸因。快照不是鎖，也不會自動隔離其他程序。
6. 不備份整個 workspace，不收錄 `.env`、secret、credentials、DB 資料／dump 或無關檔案；排除清單不影響工作範圍與秘密存取規則。保存位置與多任務規則見 [本機 run 規格](ai-runs-current-spec.md)。

## 11. Migration 操作授權

核准 schema／模型設計不等於核准 DB mutation。完整欄位填法見 [Builder prompt 模板](ai-runs-current-templates/03-approved-builder-prompt.md)；未填或未確認視為未授權。

- 產生 migration、套用 migration、backfill／seed 分別列核准範圍、確切命令／參數、目標與前置條件；產生 migration 若需 DB／shadow DB 也適用，不能因是產生 SQL 就假設沒有環境影響。
- 目標以不含 credentials 的 DB identifier、用途、隔離證據及產品主人批准記錄辨識；執行前確認實際目標與核准者一致。不能只用 localhost、dev 字樣、獨立 port 或檔名判定安全，也不在報告輸出連線字串或 `.env` 內容。
- 區分 disposable fixture DB、可能含真實資料的開發 DB、preview／production；shadow DB 若使用，亦須確認隔離與操作範圍。共享 smoke DB 或 worker 串行不等於 disposable DB。
- 列出 SQL review、資料完整性／歧義檢查、必要備份或重建方式、rollback 限制、有效 checks。schema migration 通過不代表 backfill 已授權或安全。
- 目標不明或不同、歷史 drift、reset／資料損失提示、owner 歧義、SQL 超出核准範圍時停止。不得自動答應 reset、加破壞性 flag、改用 db push、切 DB 或修改 migration history 來通過。
- 未授權 production／真實資料 mutation、破壞性 contract、環境設定、秘密存取或 commit／push／deploy 維持原 gate；此規格只界定批准如何記錄，沒有預先放行任何命令或資料庫。
