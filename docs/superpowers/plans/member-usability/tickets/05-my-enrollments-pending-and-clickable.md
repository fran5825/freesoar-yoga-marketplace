# 05: 我的報名：待你處理與卡片可點（決策 12、14）

**What to build:** 「我的報名」頂部有「待你處理」區塊（待老師確認的報名、已完成課程待評價），卡片整張可點進課程詳情。空狀態改成「去找一堂課」按鈕連到 `/classes`，不再寫過期文案。

**Blocked by:** 01

**Status:** done（2026-09-26）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（動工前先查證「待評價」能否用現有資料判斷，查不到就先不放並回報）

**Source:** `docs/member-usability-plan.md`

- [x] 「待你處理」列出待老師確認與待評價項目，沒有時顯示「目前沒有待處理事項」
- [x] 報名卡片整張可點進 `/classes/[id]`
- [x] 空狀態有「去找一堂課」按鈕，文案不再提「團主分享的連結」
- [x] 手機沒有橫向捲動；smoke 測試通過

**實作紀錄：** 「待評價」可用現有資料判斷（`listOwnEnrollmentsForMember` 已帶出報名狀態、課程狀態與自己的評價），不需新查詢、不動 schema。判斷寫成共用函式 `getMemberTodos`（`src/domain/enrollment/member-todos.ts`）與共用區塊 `MemberTodoList`，票 06 的 dashboard 直接重用。「待你處理」兩種項目：待評價（confirmed＋課程 completed＋尚無評價，排前面）、等老師確認（pending＋課程未取消未結束未開始）。列表分「即將上課」（由近到遠）與「過去與已取消」（由新到舊）兩組。整張卡可點：標題連結用 `after:absolute after:inset-0` 撐滿整張卡，取消與評價表單用 `relative z-10` 浮在上層，仍可操作（卡片內不能巢狀放連結與按鈕）。空狀態改為「去找一堂課」按鈕連到 `/classes`。驗證：build、tsc、eslint 通過；`enrollment`（含新增的待處理與整卡可點測試）、`member-dashboard`、`class-session-review` 桌機＋手機共 54 支全過；桌機與手機畫面已看過。

**留給後續（非本票造成）：** 已結束的課程卡片仍顯示「取消報名…」，點下去只會得到「這堂課程已經開始，無法取消報名。」。既有 D14 測試（`enrollment.spec.ts`）刻意透過這個按鈕驗證伺服器擋取消，要隱藏按鈕須一併改該測試；建議在票 03（詳情頁取消）決定「已開始就不顯示取消」的統一規則。另：`/member/dashboard` 空狀態仍寫「透過團主分享的課程連結報名」，屬票 06。
