# 03: 角色切換與 logo 支援非專區頁（決策 9）

**What to build:** 導覽列的「目前身分」依外框所屬的身分判斷（不只看網址開頭），在 /classes、/about 這類頁面也顯示正確；logo 改連到目前身分的總覽。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-27）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 共用元件 `role-nav.tsx`、`role-shell.tsx`；不改參數格式（只新增選填參數），各角色 Shell 不需跟著改。

**Source:** `docs/signed-in-navigation-plan.md`

- [x] 在學員外框下的 /classes，「目前身分」顯示學員
- [x] 各專區 logo 連到該身分總覽
- [x] 老師未通過審核時的精簡導覽保持不變
- [x] role-switch、organizer-usability、notifications-area 等既有測試通過

**實作紀錄：** `role-nav.tsx` 的「目前身分」與 logo 改依外框 `areaLabel` 判斷（原本看網址前綴，`/teachers/join` 會被誤判成老師專區）；logo 連到該身分總覽。參數格式不變，各 Shell 未改。

驗證：build、tsc、eslint 通過；整套 smoke 測試 590 支中 587 通過，3 支失敗已處理（團主通知測試依決策 3 改為先進團主專區，重跑通過；老師申請頁一支在整套負載下載入逾時，單獨重跑 3 輪全過）；新增 `tests/smoke/signed-in-navigation.spec.ts` 桌機＋手機 10 支全過。
