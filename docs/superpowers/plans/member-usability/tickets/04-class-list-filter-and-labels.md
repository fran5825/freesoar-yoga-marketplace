# 04: 課程列表：篩選、名額與來源標籤（決策 6、8、10）

**What to build:** 學員在 `/classes` 用 tag-chip 點選即時篩選（課程類型、星期幾、只看還有名額），每張卡片顯示剩餘名額、狀態與「團主團課／老師開課」來源標籤。沒有符合的課時顯示說明與下一步。

**Blocked by:** 01

**Status:** done（2026-09-26）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（`/classes` 為公開頁；不動 schema）

**Source:** `docs/member-usability-plan.md`

- [x] 篩選改為 tag-chip，點選即時更新，不需要送出按鈕
- [x] 有「只看還有名額」選項
- [x] 每張卡片顯示剩餘名額、狀態、來源標籤
- [x] 無結果時顯示空狀態說明
- [x] 手機單手可操作；未登入訪客可正常瀏覽；smoke 測試通過

**實作紀錄：** `/classes` 篩選改為 chip（課程風格、星期幾、「只看還有名額」），每個 chip 是連結，點了直接改網址參數，沒有送出按鈕，篩選結果可分享；有篩選時顯示「清除篩選」，無結果的空狀態說明並附「清除篩選」按鈕。卡片新增「團主團課／老師開課」來源標籤（`ClassOriginTag`）與名額狀態（重用票 02 的 `ClassAvailabilityBadge`）。`getPublicClassSessionListItems` 多回傳 `capacity`、`activeEnrollmentCount`、`origin`，並支援 `availableOnly`（未開始且名額未滿）；不動 schema。拿掉英文小字「Classes」。手機版 chip 改單行可左右滑，否則篩選區占約 800px、第一堂課被擠出第一屏；加 `overflow-hidden` 避免整頁橫向捲動（實測 overflow=false）。驗證：build 通過；`public-classes-discovery`（含新增 chip 與名額測試）、`teacher-initiated-open-classes`、`enrollment`、`member-dashboard` 桌機＋手機共 60 支全過。
**已知問題（非本票造成）：** `public-classes-discovery.spec.ts` 既有的列表測試寫死 `2026-11-02`，該日期一過測試會失敗（同 backlog 1b 的問題），需改用 `futureDateTime`，且要保留「星期一」的語意。
