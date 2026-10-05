# 13: 分享連結、登入與學員報名

**What to build:** 團主開放課程後可複製完整報名連結與看名單；收到僅透過連結招募課程的學員能登入回原課程並報名。

**Blocked by:** 09：直接開放報名與來源權限

**Status:** done（2026-10-05）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** AUTH_RISK、PERMISSION_RISK、LOW_PRESSURE_UX_RISK

- [x] 開放課程詳情主要動作為複製完整 URL，另可開啟課程／看名單；複製成功／失敗可理解且 aria-live，不只顯示相對路徑文字。
- [x] 匿名非公開課程與其他無法公開讀取的 ID 使用一致的通用登入引導，URL／回應不能透露是否存在、標題、老師或聯絡資料。
- [x] 登入後 callback 返回同課；可見且有效課程走既有 Member 讀取／報名，無效／draft／越權資料不洩漏。
- [x] 預設 unlisted 不出現在公開探索；勾選公開才依既有公開 guards 顯示，不新增公司成員驗證，明確說明連結可轉傳。
- [x] 報名、滿額、取消、來源權限及團主 own roster 保留既有規則；此票不實作 Google 一鍵登入捷徑或新 login provider。
- [x] 測試匿名 valid/invalid/draft 一致引導、callback 安全、登入返回、Member 報名、名額競態、公開探索與 roster 越權；桌機／手機完整分享旅程。
- [x] 先查證最新 member／public 修改，保留其他 task 的 diff；同步曝光與登入邊界文件。

## 進度紀錄

- 2026-10-05 開工核對：老師排課、管理員、學員流程的程式都已 commit，`src/app/classes`、`src/domain/enrollment`、`src/domain/class-session` 沒有其他 task 的未 commit 修改。既有 Member 讀取（`getClassSessionForMember`）本來就不檢查 `isPublic`，僅透過連結招募已可報名；本票只改匿名呈現與團主分享，不改讀取／報名規則。
- 匿名登入引導：`src/app/classes/_components/ClassSignInGuide.tsx`。`/classes/[id]` 訪客讀不到時顯示，狀態碼 200；內容只依網址 id 與 `safeClassReturnPath` 清理過的找課條件，沿用 `signInToEnrollAction`（callback 經 `classDetailHref`＋`sanitizeCallbackUrl`）。已登入讀不到仍 not-found。
- 團主分享：`src/app/organizer/classes/_components/ClassShareLink.tsx`，完整網址欄位（網域取自瀏覽器，`useSyncExternalStore`）、複製為主要按鈕、成功／失敗 aria-live、開啟課程頁、看報名名單（`#roster`）；說明依 `isPublic` 區分「也公開在課程列表／只透過連結招募」，並明說連結可轉傳、不另驗證公司或社團成員。
- 不做：Google 一鍵登入捷徑、新 login provider、公開規則或報名規則變更。
- 驗證：tsc、eslint、build 通過；新增 `tests/smoke/organizer-class-sharing.spec.ts`（匿名五種情況的狀態碼／文字／標題完全相同且不含課程內容、公開課照常顯示、不安全 returnTo、不公開不出現在探索、會員經連結讀取並報名、已登入讀不到仍 404、最後一席並發只成功一筆、團主複製完整連結並讀回剪貼簿、開啟課程頁、名單與他人 404）8 passed；更新 `enrollment.spec.ts`（完整網址）與 `public-classes-discovery.spec.ts`（匿名改為登入引導）。回歸 13 檔 184 passed＋更新的 2 檔 52 passed（port 3200）。

<!-- codex-peer-reviewed: 2026-10-05T13:30:51Z rounds=1 verdict=approved -->
