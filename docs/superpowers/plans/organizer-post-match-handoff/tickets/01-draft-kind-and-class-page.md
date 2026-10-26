# 01: 草稿判斷與課程頁說明

來源：[spec](../../../../specs/organizer-post-match-handoff-spec.md)「開放報名提醒」的「草稿分兩種」「課程頁」；[plan](../plan.md) 第 1 批。對應 User Stories 11、15。

**What to build:** 新增一個共用判斷（可開放的草稿／已過開課時間的草稿／其他），讓團主課程頁依它顯示：可開放的草稿說明「學員還看不到」；已過期的草稿不再出現「開放報名」按鈕，改成說明與兩個新入口。建課成功提示改成「課程已建立，還沒開放報名。」

**Blocked by:** None (can start immediately)

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（不改 schema、不改狀態機：只把按鈕顯示條件改成跟 `openOwnClassSessionForEnrollment` 的 `startAt > now` 一致）

- [x] `src/domain/class-session/` 底下新增純函式，輸入課程 `status`、`startAt`、現在時間，回傳三種結果；`startAt` 剛好等於現在算「已過期」（與 service 的 `gt` 一致），測試含這個邊界
- [x] 團主課程頁 `src/app/organizer/classes/[classSessionId]/page.tsx`：`available` 的 `open` 改用這個函式，已過期草稿不顯示「開放報名」
- [x] 可開放的草稿：標題下方顯示 spec 的說明句
- [x] 已過期的草稿：顯示「開課時間已過，這堂課沒有開放報名，無法再開放。」與「建立新的需求」「直接邀請合作老師開課」兩個連結，各自打開 `/organizer/demands/new`、`/organizer/class-proposals/new`
- [x] `src/app/organizer/demands/[demandRequestId]/actions.ts` 建課成功提示改成「課程已建立，還沒開放報名。」；同步更新 `tests/smoke/class-session-creation.spec.ts` 第 111 行（文案變更，不是行為變更）
- [x] 已開放、已取消、已完成的課程頁畫面不變
- [x] smoke：可開放草稿、已過期草稿（用 Prisma 在測試資料庫建立 `startAt` 已過的團主草稿課）、已開放三種畫面
- [x] `tsc`、`eslint src tests`、相關 smoke 通過（`PORT=3100` 或其他空埠）

## 進度紀錄

- 2026-10-26 完成：新增 `src/domain/class-session/draft-kind.ts`（`getClassDraftKind`）；團主課程頁改用它決定「開放報名」與兩種說明；建課成功提示改字，`class-session-creation.spec.ts` 同步（文案變更）。新 smoke `organizer-post-match-handoff.spec.ts` 4 支＋`class-session-creation.spec.ts` 8 支，桌機與手機共 24 passed（`PORT=3300`，測試庫 `freesoar_opmh_test`）。範圍差異：無。

<!-- codex-peer-reviewed: 2026-10-26T11:47:59Z rounds=2 verdict=approved -->
