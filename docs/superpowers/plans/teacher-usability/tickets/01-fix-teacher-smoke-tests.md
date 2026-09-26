# 01: 修老師端既有 smoke 測試

**What to build:** 老師相關的 smoke 測試先修到全部通過，讓後面每張票有可靠的驗證基準，不會分不清是新壞還是舊壞。範圍限於 `docs/backlog.md` 已列的老師申請表單改版後遺留的失敗（`teacher-join`、`teacher-profile-edit`、`teacher-profile-suspension`、`admin-teachers`、`notification` 的老師送審段）。只改測試，不改產品行為。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-25）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（只改測試；用 `PORT=3100` 跑 Playwright，見 backlog 小提醒）

**實作紀錄：** 只改測試，`src/` 沒動。修了：標題文字、狀態列出現兩次的按鈕（`.first()`）、送審按鈕需先填完 7 項必填才啟用、擅長類型改標籤選擇、admin 頁「已通過審核」變成標籤而非按鈕、老師 dashboard 狀態文字改中文；另把 `teacher-initiated-open-classes` 寫死的日期改成「今天算起 N 天後」（新增 `tests/smoke/_helpers/future-dates.ts`，其他 spec 的 1b 日期問題不在本票範圍）。

**Source:** `docs/teacher-usability-plan.md`

- [x] 上述測試對齊現行欄位名稱、標題文字，狀態列出現兩次的按鈕已處理（`.first()`）
- [x] 用正式建置（先 `npm run build`）以 `PORT=3100` 跑，老師相關測試桌機與手機皆通過
- [x] 沒有修改 `src/` 底下任何檔案
