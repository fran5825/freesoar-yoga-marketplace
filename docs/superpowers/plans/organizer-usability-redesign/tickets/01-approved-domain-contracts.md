# 01: 正式 contract 文件

**What to build:** 讓開團、建團、合作邀請的已核准規則可由產品、工程與測試共同核對，先完成文件與 migration 設計再改程式。

**Blocked by:** None (can start immediately)

**Status:** done（2026-10-04，docs-only）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK、STATE_MACHINE_RISK、AUTH_RISK

- [x] 以 Q1–Q19 核准內容同步 data model、permission、state machine、route、form 與 glossary；標示規劃／已實作，不能宣稱新能力已出貨。（glossary 的團主名詞在切票前已同步，本票查證後不需再改；其餘一律標「已核准・未實作」）
- [x] 多團體 owner 為一對多；記錄 additive expand、歧義回填檢查、相容讀寫、呼叫點遷移與最後 contract 的順序、FK delete 行為、明確 Prisma relation names。（spec 13.1）
- [x] 逐個動作列出 actor、own scope、approved teacher、version、future guard、時段資源、next actor 與通知收件人；三種 origin 的關聯不變量一致。（spec 13.3、13.6）
- [x] 確認 proposal 的排課鎖、既有課程 draft 占時段、轉課排除自身預留、失敗 rollback、重試唯一性，以及涉及不同老師時的一致鎖順序。（spec 13.5）
- [x] 記錄 safe callback、匿名非公開課程不洩漏存在性、送出與儲存的區別、首次建資料與補資料返回；多堂課只保留 backlog。（spec 13.8）
- [x] 產出 migration 風險、測試資料驗證方式與 rollback 計畫；歧義 owner 必須停止，不能挑第一位；不執行 schema、production mutation 或 source 修改。（spec 13.1、13.9）
- [x] 文件 read-back、相對連結、術語與跨文件一致性、git diff --check 通過；保留共享文件既有變更。

## 執行紀錄（2026-10-04）

**修改檔案**：`docs/specs/organizer-usability-redesign-spec.md`（新增第 13 節、更新狀態列）、`docs/domain/data-model.md`、`docs/domain/permissions.md`、`docs/domain/permissions-matrix.md`、`docs/domain/state-machines.md`、`docs/domain/state-transition-details.md`、`docs/product/route-map.md`、`docs/product/form-field-spec.md`、本票、ticket-breakdown 與分批計畫的狀態列。沒有修改 source、Prisma、tests、glossary。

**Checks**：`git diff --check` 通過；文件引用的路徑（spec、`validation.ts`、`notification/link.ts`、`risk-based-workflow.md`、`backlog.md`）都存在；五份正式文件的新增段落都標「已核准・未實作」並指回 spec 第 13 節。docs-only，沒有跑 TypeScript／lint／build／E2E，因為沒有任何程式變更。

**查證 source 後新增寫進 contract 的事實**：

1. 老師端開放、取消、完成核心（`src/domain/class-session/__internal__/*-for-teacher.ts`、`service.ts` 的 `*ForTeacher`）只用 `teacherProfileId` 過濾、沒有檢查 `origin`，排在票 09 修正（spec 13.6）。
2. `Notification` 沒有目標資料欄位，`link.ts` 只能連到列表頁；直達單筆與重試防重複需要 schema 變更，列為票 12 開始前的 Human Gate（spec 13.7）。
3. 既有 `Organization` 與 `OrganizerProfile` 已有一條關聯，新增 owner 後必須用 relation name 區分（spec 13.1）。

**共享檔案**：`docs/product/route-map.md` 開工前已有管理員工作的一行未 commit 修改（Admin Routes 段落），本票只新增團主／老師／Route Guard 段落，沒有動到那一行；commit 時只 stage 本票 hunk。

**Self review／scope drift**：在 V1 與 Q18／Q19 核准範圍內；沒有新增付款、AI、Wellness／Academy／Retreat、native app、多堂系列。新的命名（relation name、enum 值、錯誤碼）屬於實作預設，語意都來自已核准的 spec 第 6–8 節。要先取得確認的事項：票 12 的 notification schema、票 15 的破壞性 migration，以及每個 migration 票執行前的目標資料庫紀錄。

**獨立 review（Codex peer review，4 輪後 APPROVED）**：
- 第 1 輪：老師端 origin guard 的實際位置（開放、完成是直接 `updateMany`，不是鎖查詢）；婉拒後修改缺少 transition；退回 draft 後可繞過換團體限制；換老師時原老師收不到通知。另建議調整既有媒合建課的鎖順序。全部修正（spec 13.3、13.5、13.6、13.7）。
- 第 2 輪：同版本重送時 `eventKey` 會撞號 → 新增 `transitionSeq`。
- 第 3 輪：pending 中只改內容時 `transitionSeq` 不會增加 → 改成每次成功寫入都 +1。
- 第 4 輪：APPROVED，沒有反駁項目。

<!-- codex-peer-reviewed: 2026-10-04T00:19:52Z rounds=4 verdict=approved -->
