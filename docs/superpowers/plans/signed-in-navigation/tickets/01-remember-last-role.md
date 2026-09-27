# 01: 記住上次身分（決策 4、5、8）

**What to build:** 使用者進入學員、老師、團主、管理後台任一專區時，瀏覽器記下這個身分；提供共用函式讀出上次身分，身分已不能用時回學員。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-27）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 新增 `src/proxy.ts`（每次請求前執行）；只寫一個存身分代號的 cookie，不碰登入 session、不存個資。

**Source:** `docs/signed-in-navigation-plan.md`

- [x] 進入 /member、/teacher、/organizer、/admin 底下任一頁後，cookie 記成對應身分
- [x] 讀取函式：cookie 的身分仍有效就回傳它，沒有或失效（例如非管理員卻記成管理後台）回學員
- [x] 不影響登入、登出與既有 cookie
- [x] smoke 測試涵蓋記錄與失效回學員

**實作紀錄：** `src/proxy.ts`（Next.js 16 的 middleware）在 /member、/teacher、/organizer、/admin 底下寫入 `fsy_last_role` cookie（httpOnly、一年、只存身分代號）；`src/lib/navigation/last-role-cookie.ts` 放純資料（proxy 只載入它，不載入資料庫）；`src/lib/navigation/last-role.ts` 的 `getLastRole()` 讀 cookie 並確認身分仍有效，沒有或失效回學員。

驗證：build、tsc、eslint 通過；整套 smoke 測試 590 支中 587 通過，3 支失敗已處理（團主通知測試依決策 3 改為先進團主專區，重跑通過；老師申請頁一支在整套負載下載入逾時，單獨重跑 3 輪全過）；新增 `tests/smoke/signed-in-navigation.spec.ts` 桌機＋手機 10 支全過。
