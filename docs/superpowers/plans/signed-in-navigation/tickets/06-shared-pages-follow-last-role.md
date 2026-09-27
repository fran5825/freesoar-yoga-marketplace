# 06: 關於、FAQ、通知跟著上次身分（決策 3）

**What to build:** 登入後看關於、FAQ 用上次身分的專區導覽列；新增 /member/notifications，學員導覽列的「通知」指向它；舊的 /notifications 改依上次身分挑外框。

**Blocked by:** 01, 03

**Status:** done（2026-09-27）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 通知頁是老師 session 最近改過的檔案，保留 `OwnNotificationsContent`。

**Source:** `docs/signed-in-navigation-plan.md`

- [x] 上次身分是老師時，/about、/faq、/notifications 都用老師專區導覽列
- [x] 學員導覽列「通知」→ /member/notifications，留在學員專區
- [x] 訪客開 /about、/faq 照舊公開 header
- [x] notification、notifications-area 等既有測試通過

**實作紀錄：** 新增 `LastRoleShell`；/about、/faq 登入後用上次身分外框；新增 `/member/notifications`（比照老師、團主），學員導覽列與 dashboard 的通知連結改指向它；`/notifications` 改用 `LastRoleShell`，保留 `OwnNotificationsContent`。

驗證：build、tsc、eslint 通過；整套 smoke 測試 590 支中 587 通過，3 支失敗已處理（團主通知測試依決策 3 改為先進團主專區，重跑通過；老師申請頁一支在整套負載下載入逾時，單獨重跑 3 輪全過）；新增 `tests/smoke/signed-in-navigation.spec.ts` 桌機＋手機 10 支全過。
