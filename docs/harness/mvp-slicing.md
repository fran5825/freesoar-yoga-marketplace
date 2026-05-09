# MVP Slicing

## 1. 文件目的

本文件定義 Free Soar Yoga repo 如何把需求切成 MVP-first、可 review、可測試、低風險的工程切片。

目標是幫助產品主人與 Codex 避免一次做太大，讓每一輪工作都能清楚說明目標、修改範圍、驗收方式與風險。

## 2. 切片原則

- One minimal slice at a time：一次只完成一個最小可驗證切片。
- One coherent slice at a time：一個 slice 可以包含多個檔案，但必須服務同一個明確目的。
- 每個 slice 都要有清楚目標、修改範圍與驗收方式。
- 不把多個 domain、UI、Auth、Prisma、admin flow 混在同一輪。
- 優先選擇可驗證、可 rollback 的小步驟。
- 非 trivial slice 應先 plan，再 build、test、self-review、report。

切片不是越小越好，而是風險要可控、驗收要清楚。一個合理的 slice 應具備：

- 同一個明確目的。
- 同一組驗收標準。
- 同一個主要風險等級。
- 可行的 rollback 方式。
- 不混合多個高風險邊界。

## 3. Free Soar Yoga 專案情境

Free Soar Yoga 是 brand-driven yoga marketplace，初期聚焦 V1 yoga group-class marketplace。

切片時必須守住：

- 不提前擴張 Wellness / Academy / Retreat。
- 不提前加入 advanced AI matching 或 native app。
- 不把 marketplace 做成 generic SaaS、generic booking tool 或 discount marketplace。
- 不為了工程完整而提前建立 complex RBAC、enterprise permissions 或大型架構。

## 4. Risk-based Slice Size

Codex 在提出 plan 時，應先判斷本任務屬於哪一種 slice，並說明原因。

### Micro slice

適合高風險邊界，應盡量小、可單獨 review：

- Auth
- Prisma schema
- migration
- permissions / capability model
- state machines
- core user flows

### Standard slice

適合一般產品或工程實作，通常可以包含同一目的下的少量檔案：

- 一般 UI
- helper
- 單一 route
- 單一 domain rule + test
- 小型 docs + implementation 對齊

### Batch slice

適合低風險 docs-only 或協作文件整理，可以一次處理同類型多份文件：

- docs-only updates
- 文案調整
- prompt
- checklist
- 文件入口整理

Batch slice 仍必須維持同一目的、清楚驗收標準，且不可混入 source code、Prisma、migration、Auth 或 permission logic。

## 5. Slice 大小判斷

### 好的 slice 範例

- 新增一份 docs-only strategy 文件，並回報 `git status --short` 與 diff summary。
- 實作單一 protected route 的最小 guard，搭配對應測試與文件更新。
- 新增 teacher onboarding form 的 UI skeleton，不同時改 Prisma schema 與 admin review flow。
- 為既有 state transition 補一個 domain test，不順手重構整個 service layer。

### 太大的 slice 範例

- 同一輪完成 teacher onboarding、admin approval、email notification、dashboard navigation。
- 同一輪修改 Prisma schema、執行 migration、改 Auth、實作 UI 與新增 E2E。
- 同一輪建立完整 RBAC、admin audit log、permissions UI 與多角色 dashboard。
- 同一輪把 V1 marketplace 擴成 Wellness / Academy / Retreat 或 Life Platform。

### 需要拆分的警訊

- 變更同時碰到 `src/**`、`prisma/**`、Auth、permissions、state machines 與 UI。
- 一個任務需要多個使用者角色的完整 end-to-end flow 才能驗收。
- 測試範圍無法清楚列出。
- rollback 需要手動修資料庫或回復 migration。
- Codex 需要替產品主人決定核心 user flow、permission 或 V1 scope。

## 6. 高風險切片規則

以下切片必須先 plan，說明影響，並取得產品主人確認後才實作：

- Auth provider、session、account linking、sign-in / sign-out flow。
- Prisma schema、enum、relation、data model。
- Migration、`db push`、seed 或資料庫資料更新。
- Permissions / capability model、admin assignment、role 判斷。
- Marketplace state machines 或 state transition rules。
- Core user flows，例如 teacher approval、demand publishing、response selection、class creation、enrollment。

高風險切片應優先拆成：

1. Docs / spec update。
2. Domain or service rule。
3. UI or route integration。
4. Tests and review。

## 7. High-risk Planning Gate

Planning / Orchestrator 在判斷下一步任務時，如果任務涉及以下任一高風險邊界，不得直接產出 Builder implementation prompt：

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

只有在產品主人明確確認 decision plan 後，才可產出 Builder implementation prompt。

## 8. Codex 回報格式

Codex 在提出或完成 slice 時，建議使用以下格式：

```text
Slice goal:
- 本次切片要完成什麼。

Slice type:
- Micro slice / standard slice / batch slice，並說明原因。

Files to change:
- 預計或實際修改的檔案。

Non-goals:
- 本次明確不做什麼。

Risks:
- Auth / Prisma / permissions / state machine / V1 scope / brand / RWD 風險。

Tests:
- 已執行或建議執行的測試。
- 若未執行，說明原因。

Rollback notes:
- 若需要回復，應如何最小化回復。
```
