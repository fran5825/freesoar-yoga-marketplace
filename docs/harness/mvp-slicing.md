# MVP Slicing

## 1. 文件目的

本文件定義 Free Soar Yoga repo 如何把需求切成 MVP-first、可 review、可測試、低風險的工程切片。

目標是幫助產品主人與 Codex 避免一次做太大，讓每一輪工作都能清楚說明目標、修改範圍、驗收方式與風險。

## 2. 切片原則

- One minimal slice at a time：一次只完成一個最小可驗證切片。
- 每個 slice 都要有清楚目標、修改範圍與驗收方式。
- 不把多個 domain、UI、Auth、Prisma、admin flow 混在同一輪。
- 優先選擇可驗證、可 rollback 的小步驟。
- 非 trivial slice 應先 plan，再 build、test、self-review、report。

## 3. Free Soar Yoga 專案情境

Free Soar Yoga 是 brand-driven yoga marketplace，初期聚焦 V1 yoga group-class marketplace。

切片時必須守住：

- 不提前擴張 Wellness / Academy / Retreat。
- 不提前加入 advanced AI matching 或 native app。
- 不把 marketplace 做成 generic SaaS、generic booking tool 或 discount marketplace。
- 不為了工程完整而提前建立 complex RBAC、enterprise permissions 或大型架構。

## 4. Slice 大小判斷

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

## 5. 高風險切片規則

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

## 6. Codex 回報格式

Codex 在提出或完成 slice 時，建議使用以下格式：

```text
Slice goal:
- 本次切片要完成什麼。

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
