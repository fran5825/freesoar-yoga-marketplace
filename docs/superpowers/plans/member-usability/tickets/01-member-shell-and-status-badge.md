# 01: 學員外框與共用狀態標籤（決策 7、9）

**What to build:** 學員登入後看到的頁面都有跟老師、團主端一致的導覽列與頁寬，能從任何一頁走到「找課程／我的報名／通知」，不必再按瀏覽器上一頁。三處各自複製的報名狀態標籤改成共用元件。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-26）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（只動版面與元件；`/classes` 系列是公開頁，未登入訪客的 header 不能被學員外框影響，實作時確認）

**Source:** `docs/member-usability-plan.md`

- [x] `/member/dashboard`、`/member/enrollments` 有導覽列，頁寬 `max-w-4xl`，與團主、老師頁一致
- [x] 導覽選單為「找課程／我的報名／通知」，目前頁面有高亮
- [x] 未登入訪客看 `/classes` 與課程詳情，header 與現在相同
- [x] 報名狀態標籤只有一份共用元件，dashboard、我的報名、課程詳情都改用它，文字與樣式不變
- [x] 手機（375 寬）沒有橫向捲動；學員相關 smoke 測試桌機與手機通過

**實作紀錄：** 新增 `member/layout.tsx`、`MemberShell`（選單：找課程／我的報名／通知）、`EnrollmentStatusBadge`；dashboard、我的報名、課程詳情三處改用共用標籤，各頁自己的 `<main>` 與 `max-w-3xl`、英文小字「Member」已拿掉。`/notifications` 純學員分支改套 `MemberShell`（唯一動到的共用檔案）。未動 `role-shell.tsx`、`role-nav.tsx`；導覽列已自動帶到另一個 session 加的「目前身分」選單。`/classes` 系列維持公開 header。驗證：build 通過；`enrollment.spec`、`member-dashboard` 桌機＋手機共 30 支全過；登入後桌機三頁主內容寬 896px、手機三頁無橫向捲動，手機選單展開後三項目與高亮正常。附帶修：`enrollment.spec.ts` 寫死 `2026-09-01` 已過期，改用 `futureDateTime`；報名表單選擇器改成只選含「確認報名」的表單（header 有登出表單）。這些改動已被另一個 session 的 commit `ba73295` 一併收入。
**留給後續票：** 「我的報名」空狀態仍寫「團主分享的連結」，屬票 05。
