# 06: 學員 dashboard：待你處理＋即將上課（決策 15）

**What to build:** `/member/dashboard` 成為學員首頁：頂部「待你處理」（文案與「我的報名」共用），下方「即將上課」，排版與團主、老師總覽一致。

**Blocked by:** 05

**Status:** done（2026-09-26）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無

**Source:** `docs/member-usability-plan.md`

- [x] dashboard 頂部顯示與「我的報名」相同來源的待處理項目
- [x] 下方顯示即將上課的已確認課程，卡片可點進詳情
- [x] 版面與團主、老師總覽一致，`/account` 導向仍正常
- [x] smoke 測試通過

**實作紀錄：** `/member/dashboard` 版面改為：待你處理（重用票 05 的 `MemberTodoList` 與 `getMemberTodos`，與「我的報名」同一份判斷）→ 即將上課（最多 5 筆已確認且未開始，整張卡連到課程詳情，沒有時給「去找一堂課」按鈕）→ 近期通知（維持 5 筆與「查看全部通知」）。拿掉原本的「已報名／處理中／已取消」計數，因為對學員沒有下一步動作；對應的測試改為驗證待你處理、卡片連結與空狀態按鈕。dashboard 空狀態過期文案（團主分享的連結）已一併修正。驗證：build、tsc、eslint 通過；`member-dashboard`、`enrollment`、`notification`、`public-classes-discovery` 桌機＋手機共 72 支全過；桌機與手機畫面已看過（手機無橫向捲動）。

**票 01 補漏：** 導覽列原本沒有「總覽」，離開 dashboard 就回不去（老師、團主導覽列第一項都是總覽）。已在 `MemberShell` 補上「總覽」為第一項，選單變為「總覽／找課程／我的報名／通知」，並更新 `docs/member-usability-plan.md` 決策 7。
