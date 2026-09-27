# 04: 課程列表與詳情：登入後用學員專區（決策 1、2）

**What to build:** 已登入的人看 /classes 與 /classes/[id] 時套學員導覽列，「找課程」不會再跳出學員專區；訪客維持公開 header 與原本的資料路徑。

**Blocked by:** 03

**Status:** done（2026-09-27）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（訪客與登入分支分開套外框，資料讀取不變）

**Source:** `docs/signed-in-navigation-plan.md`

- [x] 登入後兩頁都有學員導覽列，「找課程」高亮
- [x] 訪客照舊公開 header
- [x] 手機無橫向捲動；相關 smoke 測試通過

**實作紀錄：** 新增共用外框 `SiteShell`（訪客→公開 header＋footer；已登入→指定專區外框）。`/classes` 用 `SiteShell signedInArea="member"`；`/classes/[id]` 登入分支改包 `MemberShell`，訪客分支不變。

驗證：build、tsc、eslint 通過；整套 smoke 測試 590 支中 587 通過，3 支失敗已處理（團主通知測試依決策 3 改為先進團主專區，重跑通過；老師申請頁一支在整套負載下載入逾時，單獨重跑 3 輪全過）；新增 `tests/smoke/signed-in-navigation.spec.ts` 桌機＋手機 10 支全過。
