# 05: 資料頁單一儲存與完整度（決策 12）

**What to build:** 團主資料頁改成一張卡片、一顆「儲存」，同時存顯示名稱與組織資訊；頂端顯示聯絡資料完整度（缺哪項直接標紅）；從別頁被送來補資料時，儲存後回到原頁。

**Blocked by:** 04（共用註冊表單欄位元件）

**Status:** done（2026-09-25）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無

**實作紀錄：** 已完成。單一「儲存」由 `saveOrganizerProfileAction` 處理，先驗證顯示名稱再存組織與名稱；`next` 參數只接受 `/organizer/` 開頭的站內路徑。舊的 `updateOrganizerProfileAction`／`updateOrganizationAction` 已移除。

**Source:** `docs/organizer-usability-plan.md`

- [x] 顯示名稱與組織資訊一次儲存，成功與失敗訊息清楚
- [x] 缺聯絡資料時頂端標示缺項
- [x] 支援帶回原頁的參數，只接受站內路徑（不可跳到外部網址）
- [x] 更新 `organizer-profile-edit` smoke 測試，桌機與手機通過
