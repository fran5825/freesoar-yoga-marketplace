# 學員端返回連結修正 Plan

> Status: DRAFT — 已與產品主人完成 grill 討論（2026-10-10 Q1–Q8 全數採建議），待核准後施工。
> 範圍：學員端（找課程、單堂頁、期班頁、持續開課頁、我的報名、會員首頁待辦）。不動 schema、權限、state machine。

## 1. 問題

使用者從「我的報名」進期班頁，按「返回課程列表」卻回到「找課程」。原因：

- 單堂頁的返回連到 `returnTo`，沒帶時預設 `/classes`；`safeClassReturnPath`（`src/lib/navigation/class-return-path.ts`）只允許 `/classes` 路徑，所以其他來源都被打回 `/classes`。
- 期班頁（`src/app/classes/terms/[recurringClassSeriesId]/page.tsx`）與持續開課頁（`src/app/classes/series/[recurringClassSeriesId]/page.tsx`）的返回寫死 `/classes`。
- 期班頁點某一堂（`href={`/classes/${session.id}`}`）沒帶來源，單堂返回會跳到找課程，不是回期班頁。
- 找課程列表的 TermCard、SeriesCard 沒傳 `returnTo`，篩選條件在這兩種卡片上會遺失。
- 文字一律「返回課程列表」，與實際去向不符。

## 2. 已決定（grill 結果）

1. 返回 = 回到「上一層來源」，用網址 `returnTo` 一層層保存；不用 history.back()、不做麵包屑。
2. 連結文字依目的地顯示。
3. 期班頁→單堂頁→返回回期班頁；期班頁自己的來源仍保留在網址參數內。
4. 選單亮起項目不在這次範圍（backlog 第 22 項）。
5. 範圍只有學員端；老師端、團主端另做只讀檢查，發現再回報。

## 3. 返回對照

| 來源 | 目的頁 | 文字 → 去向 |
|---|---|---|
| 找課程（含篩選） | 單堂／期班／持續開課 | 返回課程列表 → 原篩選結果 |
| 我的報名 | 單堂／期班 | 返回我的報名 → `/member/enrollments` |
| 會員首頁、待辦 | 單堂 | 返回首頁 → `/member/dashboard` |
| 期班頁 | 單堂 | 返回期班 → 該期班頁（含它自己的 returnTo） |
| 持續開課頁 | 單堂 | 返回持續開課 → 該頁 |
| 無來源／來源不合法 | 任一頁 | 返回課程列表 → `/classes` |

白名單：`/classes`（含合法篩選）、`/member/enrollments`、`/member/dashboard`、`/classes/terms/{id}`、`/classes/series/{id}`。其他一律退回 `/classes`。`not-found` 頁與讀不到的登入引導維持回 `/classes`（登入後回原頁的 returnTo 保留）。

## 4. 任務清單（完成一項勾一項）

- [x] T1 擴充 `class-return-path.ts`：白名單解析、`returnTo` 的 label 判斷、巢狀 returnTo 長度與深度限制（期班頁的 returnTo 內再含來源）；單元測試涵蓋惡意值（`//`、`\`、`%5c`、外部網址、hash、過長）。
- [x] T2 單堂頁、期班頁、持續開課頁的返回連結改用共用函式（href＋文字）。
- [x] T3 入口補 `returnTo`：我的報名（`src/app/member/enrollments/page.tsx` 的單堂與期班連結）、會員首頁（`dashboard/page.tsx`）、`MemberTodoList`、期班頁→單堂、持續開課頁→單堂、找課程的 TermCard／SeriesCard。
- [x] T4 確認 `actions.ts`（報名、請假、退出）與 sign-in 回程保留 `returnTo`，行為不變。
- [x] T5 Playwright／Vitest：從我的報名→期班頁→返回；期班頁→單堂→返回；找課程（有篩選）→期班頁→返回；直接貼網址→返回；報名成功後返回連結不變。
- [x] T6 只讀檢查老師端、團主端返回連結：老師單堂頁已用白名單 `from=` 參數（route-map 票 04），團主頁用 `/organizer/` 前綴的 returnTo，兩邊都沒有寫死回找課程的返回連結，無需修改。
- [x] T7 同步文件：`docs/product/route-map.md` 若有記載返回行為則更新；backlog 第 22 項已新增。

## 5. 風險與驗證

- 風險：巢狀 returnTo 造成網址過長或被拿來做 open redirect → 白名單加長度與深度上限，只接受站內路徑。
- 驗證範圍：TypeScript、ESLint、changed logic 的 Vitest、上述 Playwright 流程（用 `PORT=3100`）、手機寬度檢查。
- 不 commit／push，等產品主人明確要求。
