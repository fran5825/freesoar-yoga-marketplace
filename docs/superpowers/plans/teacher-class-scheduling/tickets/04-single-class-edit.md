# 04：單堂改課

**What to build:** 老師可以修改自己開的單堂課（`draft` 或 `open_for_enrollment` 且尚未開始）的內容、時間、地點與人數上限；改時間、地點時通知已報名學員，改時間重跑撞課檢查。

**Blocked by:** None (can start immediately)

**Status:** accepted（2026-10-05 實作；2026-10-09 產品主人看過驗收畫面包後回覆「排課 01–06 都通過」）

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** STATE_MACHINE（取代「建立後不提供編輯」）、PERMISSION（新增老師 own-scoped 改課）、NOTIFICATION、CONCURRENCY

規格：[4.5 改課](../../../../specs/teacher-class-scheduling-spec.md)（Q5、Q7–Q9、Q14）；情境 S13、S16、S17、S22、S23。

- [x] 實作前更新 `docs/domain/state-machines.md` 與 `docs/domain/permissions.md`，並完成安全檢查。
- [x] 標題、說明、課程風格、瑜伽類型隨時可改，不通知；驗證規則同建立。
- [x] 鎖定順序依規格第 6 節：先鎖 `ClassSession` 再鎖 `TeacherProfile`（與單場報名相同）；撞課 helper 目前要求先鎖老師，須調整成支援「場次已鎖」的呼叫，不得反向取鎖。
- [x] 日期時間可改，必須在未來並通過撞課檢查；改時間或地點時，通知該場 `pending`／`confirmed` 學員，報名保留。
- [x] `class_session_changed` 目前只有 enum 和連結，沒有通知文案 builder（呼叫會被吞掉、實際不建立通知）；本票補上學員收件文案，並以測試驗證通知確實寫入資料庫、只發給該場有效報名的學員。
- [x] 人數上限可加大；調小時不得低於 `pending` + `confirmed` 人數，檢查在同一把課程鎖內進行。
- [x] 補強現行單場「開放報名」：server 端檢查老師須為已通過審核（目前沒有檢查，暫停中的老師仍可開放），對應規格推導規則 11 與 S22；更新 `permissions.md`。
- [x] 只有老師自己開的課、`draft`／`open_for_enrollment`、尚未開始、老師為已通過審核才可改；團主媒合的課、已開始／完成／取消的課不顯示改課入口，server 端也拒絕。
- [x] 「是否需要確認報名」不開放修改。
- [x] Smoke 測試覆蓋各欄位規則、通知寫入與對象、撞課、人數下限、狀態與時間限制、他人與暫停老師拒絕（含暫停老師直接呼叫單場開放報名被拒）、改課與同場單場報名交錯執行不死鎖也不超額；tsc、lint、build、受影響 smoke 通過；RWD 檢查。

## 跨計畫註記：適合對象／準備事項（2026-10-04，產品主人選 A）

學員流程票 03／04（`docs/superpowers/plans/member-flow-redesign/tickets/`）會在 `ClassSession` 與 `RecurringClassSeries` 新增選填的 `suitableFor`（適合對象）與 `preparationNotes`（準備事項）。產品主人決定：這兩段屬於「內容類欄位」，單堂改課時與課程介紹同規則：隨時可改、不通知已報名學員。若本票早於學員流程票 03／04 實作，則由後做的那一方補上這兩個欄位。

<!-- codex-peer-reviewed: 2026-10-04T00:20:21Z rounds=4 verdict=approved -->

<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
## 開工前安全檢查與設計（2026-10-05，待產品主人確認）

產品主人已同意推導規則 6（不開放改「是否需要確認報名」）與 11（單場開放報名補 approved 檢查）。文件已先更新：`state-machines.md`、`state-transition-details.md`、`permissions.md`、`permissions-matrix.md`，標為「已核准・未實作」。

### 安全檢查結果

- **權限**：老師端開放／取消／完成目前只靠 UI 隱藏團主媒合課的按鈕，server 不檢查 `origin`（organizer-usability 票 09 才補）。改課不沿用這個作法：own-scope 寫在鎖查詢的 WHERE；`origin = teacher_initiated`、不屬於系列、狀態、開始時間、老師 `approved` 全部在鎖內檢查。
- **老師資格**：鎖住 `TeacherProfile` 後才讀狀態，與管理員暫停（UPDATE 同一列）互相排隊，不會出現「剛被暫停還改成功」。
- **人數上限**：調小時在課程鎖內數 `pending + confirmed`。會增加人數的只有新報名，而新報名也要先鎖同一堂課，所以不會在比對後被超收；確認／婉拒／學員取消只會維持或減少人數，不影響這個檢查。
- **死鎖**：各路徑取鎖順序——單場報名「場次 → 老師」、改課「場次 → 老師」、建課「老師」、取消單堂「場次」、系列操作（票 01、03）「系列 → 場次 → 老師」、管理員暫停「老師」。都是同一個方向，沒有互相等待的循環。撞課檢查的 helper 會再對已鎖的老師列 `FOR UPDATE` 一次，同一個 transaction 內是允許的。
- **通知**：`class_session_changed` 目前沒有文案，`notifyUsers` 會丟例外被吞掉、實際不建立通知；本票補上學員文案，commit 後才發，只發給該場 `pending`／`confirmed` 學員。
- **資料外洩**：改課頁只顯示這堂課本身的欄位，與詳情頁相同的 own-scoped 讀取，不新增可讀資料。

### 設計

1. **Domain 核心** `__internal__/edit-class-session-core-for-teacher.ts`：一個 transaction 內 → 鎖 `ClassSession`（WHERE id + teacherProfileId）→ 檢查 origin／不屬於系列／`draft` 或 `open_for_enrollment`／`startAt` 未到 → 鎖 `TeacherProfile` 並確認 `approved` → 驗證欄位（沿用建立單堂的規則：新時間須在未來、結束晚於開始）→ 時間有變才跑撞課檢查（排除自己）→ 人數上限 ≥ `pending + confirmed` → 更新 → 回傳「時間是否改變、地點是否改變、要通知的學員」。commit 後才發通知。`service.ts` 包一層登入檢查。
2. **通知文案**：`class_session_changed` 的學員文案，例如：標題「課程時間或地點有變更」，內容「「皮拉提斯每周常態班」的上課時間改為 10/13（二）19:30–20:30；地點改為 台北市…。你的報名仍然有效，如果不能來，可以到我的報名取消。」只列出真的有改的項目。通知連結沿用既有（學員到「我的報名」）。
3. **單場開放報名補檢查**：既有 `openOwnClassSessionForEnrollmentForTeacher` 的 `updateMany` 條件加上「老師為 approved」，判斷與寫入一次完成；暫停老師回傳明確訊息。
4. **畫面**：
   - 新增 `/teacher/classes/[classSessionId]/edit`，沿用建立單堂的欄位元件與樣式（課程內容／時間地點兩區），預先帶入目前的值。「是否需要確認報名」「公開列表」只顯示、不能改（公開設定在票 06）。
   - 送出前的核對摘要列出「改了哪些項目」；有人報名且改了時間或地點時，再跳確認視窗說明「會通知 N 位學員，報名照樣保留」。
   - 單堂詳情頁頂端操作區加「修改課程」（只對可改的課顯示），刪掉「課程內容建立後目前無法修改；需要調整的話，請取消後重新建立」這句。
   - 失敗時留在改課頁並保留輸入（與建立表單相同作法）。
5. **測試**：各欄位規則、通知寫入與對象（只發給有效報名學員、內容寫的是改後時間地點）、撞課（排除自己）、人數下限、狀態與時間限制、團主媒合課與系列場次被拒、他人被拒、暫停老師改課與單場開放報名被拒、改課與同一堂課的報名交錯不死鎖也不超收；RWD 三種寬度。

### 待產品主人確認

- A. 上面的通知文案方向。
- B. 有人報名時改時間或地點，送出前多一個確認視窗（建議要）。
- C. 「修改課程」放在單堂詳情頁頂端操作區（建議），而不是只放在頁尾。

## 執行紀錄（2026-10-05）

產品主人確認 A、B、C 照建議並放行票 04。已完成：
- [x] Domain 核心 `__internal__/edit-class-session-core-for-teacher.ts`（鎖場次 → 檢查 origin／系列／狀態／時間 → 鎖老師確認 approved → 驗證 → 撞課（排除自己）→ 人數下限 → 更新 → commit 後通知）。
- [x] 通知：`types.ts` 新增 `changeSummary`；`copy.ts` 新增 `class_session_changed` 學員文案。
- [x] 單場開放報名：`updateMany` 條件加上老師 approved，新增錯誤碼 `teacher_not_approved`。

後半段（2026-10-05 完成）：
- [x] `service.ts` 包登入檢查的 `editOwnClassSessionForTeacher`。
- [x] 改課頁 `/teacher/classes/[classSessionId]/edit`（沿用建立單堂欄位元件、預帶目前值、改了哪些項目的摘要、有人報名且改時間地點時的確認視窗、失敗保留輸入）。
- [x] 單堂詳情頁頂端加「修改課程」，刪掉「建立後目前無法修改」那句。
- [x] 測試（見上方設計第 5 點）、build、smoke（3100 被占用時同票 01 改用暫存副本＋3200）、RWD。

### 完成結果

- `service.ts` 新增 `editOwnClassSessionForTeacher`（登入檢查＋錯誤訊息）；改課 action 在 `src/app/teacher/classes/[classSessionId]/edit/actions.ts`。
- 改課頁沿用建課表單（`ClassSessionCreateForm` 加 `edit` 模式）：只顯示單堂欄位並預帶目前值（不在選單中的瑜伽類型放回「其他」）；公開列表與報名方式只顯示不能改；「儲存前核對」列出這次改了哪些項目；有人報名且改時間或地點時，先跳確認視窗（「先不要」不寫入）；失敗留在原頁保留輸入。
- 單堂詳情頁「下一步」操作列加「修改課程」（只對可改的課、approved 老師顯示）；刪掉「建立後目前無法修改」那句，系列場次改寫為「系列中的場次目前還不能修改內容」。建課摘要改為「建立後，開課前都還可以在課程頁修改…」。
- 文件：`state-machines.md`、`state-transition-details.md`、`permissions.md`、`permissions-matrix.md` 由「已核准・未實作」改為「已落地」。
- Checks：整個 repo `tsc`、`eslint` 通過；`next build` 通過；Playwright 6 個檔 92 個測試全數通過（含新增 `teacher-class-edit.spec.ts`：只改內容不通知、改時間地點只通知有效報名且內容正確、撞課與排除自己、人數下限、團主課／系列場次／已取消／已開始／他人／暫停老師被拒且資料不變、改課握鎖時報名排隊且不超收、UI 改課與確認視窗、名額太少留在原頁、團主課沒有改課表單、暫停老師開放報名被拒）。既有 `teacher-class-usability` 的摘要文字斷言同步更新。
- RWD：375／768／1440 單堂詳情、改課頁、確認視窗無橫向捲動，按鈕高度 ≥ 44px。
- 執行方式同票 01：在暫存資料夾 build，用 3200 埠測試。
- 順帶觀察（非本票範圍，未改）：詳情頁的「標記完成」在課程還沒結束時也會顯示（server 會擋），之後可考慮只在結束後顯示。

<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->
