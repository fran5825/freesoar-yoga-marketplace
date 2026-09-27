# 07: 四種身分全流程驗證

**What to build:** 學員、審核中老師、團主、管理員各走一次「登入 → 上次身分總覽 → 點公開頁入口 → 切換身分」，桌機與手機；補 smoke 測試，發現的問題在此票內修。

**Blocked by:** 02, 04, 05, 06

**Status:** done（2026-09-27）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（測試用 PORT=3100）

**Source:** `docs/signed-in-navigation-plan.md`

- [x] 四種身分桌機＋手機各走一次，截圖
- [x] 全部 smoke 測試通過
- [x] 發現的問題記在票內，超出範圍的放 docs/backlog.md

**實作紀錄：** 以 smoke 測試走過學員、審核中老師、已通過老師、團主（首頁導向）、非管理員記成管理後台的失效情況；手機與桌機截圖：審核中老師的老師合作頁（含選單、角色切換）、訪客與登入後的課程列表。管理員實際進後台的畫面未另外截圖（沿用 admin 既有測試全過）。

驗證：build、tsc、eslint 通過；整套 smoke 測試 590 支中 587 通過，3 支失敗已處理（團主通知測試依決策 3 改為先進團主專區，重跑通過；老師申請頁一支在整套負載下載入逾時，單獨重跑 3 輪全過）；新增 `tests/smoke/signed-in-navigation.spec.ts` 桌機＋手機 10 支全過。
