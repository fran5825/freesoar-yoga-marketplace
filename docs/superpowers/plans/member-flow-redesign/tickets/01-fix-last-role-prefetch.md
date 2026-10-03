# 01: 背景預先載入不再改寫「上次身分」

**What to build:** 老師（或團主、管理員）登入後只是逛了 `/classes` 等套學員外框的頁面、沒有真的點進學員專區，回首頁或開登入頁時仍回到自己上次用的專區總覽；外站 callback 仍被過濾、改回上次身分總覽。真的點進學員專區時，上次身分照常改成學員。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（修改 `src/proxy.ts`，屬 proxy／角色記憶；需產品主人確認修復範圍）

**Risk flags:** proxy、上次身分 cookie、共享導覽行為；不碰 Auth provider／session、callback 過濾、權限判斷。

**Source:** `docs/member-flow-redesign-plan.md` Builder Review Packet「Known limitations」；`docs/signed-in-navigation-plan.md`。

## 定位結果（2026-10-04，read-only）

事實：
- 失敗案例：`tests/smoke/signed-in-navigation.spec.ts` 第 60 行，desktop／mobile 兩支。第一批工作樹 90 passed／2 failed。
- HEAD-only baseline（e7598a3，獨立 worktree、PORT=3200、production build）同一案例 `--repeat-each 3` 共 6/6 通過。
- 同一 HEAD build 跑診斷：老師進 `/teacher/dashboard` 後 cookie `fsy_last_role=teacher`；開 `/classes` 剛載入時仍是 `teacher`，3 秒後變成 `member`。期間瀏覽器送出 `/member/dashboard`、`/member/enrollments`、`/member/notifications` 請求，皆帶 `next-router-prefetch: 1`（Next.js `<Link>` 背景預先載入）。證據：`.ai-runs/member-flow-redesign-01/head-prefetch-diagnostic.log`。
- `src/proxy.ts` 對 matcher `/member/:path*` 等路徑的任何請求都寫入上次身分 cookie，沒有區分 prefetch。
- 學員外框（MemberShell）在 HEAD 與第一批相同，導覽列都有 `/member/*` 連結。

推論：
- 根因在 HEAD 已存在：使用者只是看見學員導覽列，背景預先載入就把上次身分改成學員。這是真實使用者會遇到的 bug，不只是測試問題。
- HEAD 測試會過是時序巧合：舊版 `/classes` 有約 15 個篩選 chip `<Link>`，預先載入排在 `/member/*` 前面，測試換頁前還沒輪到。第一批把篩選改成表單，`/member/*` 更早被預先載入，bug 就穩定出現。第一批的變更本身沒有錯。

## 第一次修復嘗試失敗（2026-10-04）

- 產品主人核准「只改 proxy：看到 `next-router-prefetch` 就不寫 cookie」。實作後在隔離 worktree（HEAD＋第一批 patch＋修改）驗證仍失敗。
- 原因（已查證）：Next.js 16.2.4 `server/web/adapter.js` 在呼叫 proxy 前，會刪除 `FLIGHT_HEADERS`（`rsc`、`next-router-prefetch`、`next-router-segment-prefetch` 等）。proxy 實際收到的「背景預先載入」與「點擊換頁」請求 header 相同（皆 `sec-fetch-dest: empty`），沒有可區分的欄位。證據：`.ai-runs/member-flow-redesign-01/proxy-seen-headers.log`、`header-fix-attempt.log`。
- 已還原 `src/proxy.ts`。新增的回歸測試保留在工作樹，在未修正的程式上 desktop／mobile 皆失敗（預期 `teacher`、實得 `member`），證明測得到這個 bug：`new-test-unfixed.log`。
- 不能只在整頁載入時記錄：「切換身分」選單與 logo 都是 `<Link>` 換頁（`src/app/_components/role-nav.tsx`），這樣切換身分後上次身分不會更新，等於倒退。

## 修訂方案（待 Human Gate）

1. `src/proxy.ts`：只在整頁載入（`sec-fetch-dest: document`，或沒有這個 header 的非瀏覽器請求）時寫 cookie。預先載入一律是 `empty`，不會再改到身分。整頁進入專區仍立刻生效，原有測試的時序不變。
2. 新增小型 client component＋server action（例如 `src/lib/navigation/remember-last-role.ts`），放進四個專區 layout（`src/app/{member,teacher,organizer,admin}/layout.tsx`）：
   - client component 以 `usePathname()` 為 effect 依賴，**每次專區內的 pathname 實際導覽完成**就呼叫 server action（不只 layout 第一次掛載）。原因：Next.js 會在同專區換頁時重用 layout，若只靠 layout 掛載時的 cookie 快照決定，其他分頁改掉 cookie 後，本分頁在同專區換頁不會寫回（多分頁漏記）。
   - server action 讀**當下**的 cookie，與傳入的身分不同才寫入；傳入值必須屬於 `LAST_ROLES`，否則忽略。
   - 預先載入不會畫出畫面，所以不會觸發；點 logo、導覽列或切換身分選單進入專區時會觸發。cookie 仍只是偏好，`getLastRole` 照舊重新確認身分。
   - cookie 屬性與 proxy 完全相同（`httpOnly`、一年 `maxAge`、`path: "/"`、`sameSite: "lax"`、HTTPS 下 `secure`），抽成 `last-role-cookie.ts` 的共用設定，proxy 與 server action 共用，避免兩條寫入路徑不一致。
3. 回歸測試（`signed-in-navigation.spec.ts` 只新增案例，原有不改）：
   - 已寫的案例：預先載入後 cookie 仍是 teacher；點 logo 進學員專區後以 `expect.poll` 等 cookie 變成 member。
   - 多分頁案例：同一 browser context，分頁 A 整頁進老師專區 → 分頁 B 整頁進學員專區（cookie 變 member）→ A 點老師導覽列進另一個 `/teacher/*` 頁 → `expect.poll` cookie 回到 teacher，首頁導向老師總覽。
   - 切換身分選單案例：老師用選單 client 換頁切到學員，再切回老師，每次切換後 cookie 與首頁導向都跟著更新（既有 `role-switch.spec.ts` 只驗 URL 與選單，未驗角色記憶）。
4. 文件：`docs/signed-in-navigation-plan.md` 補記「整頁載入由 proxy 記錄，站內換頁由專區 layout 記錄，預先載入不算進入」。

不採用：在導覽列 `<Link>` 關掉 prefetch。要改所有外框與公開頁上通往專區的連結，之後新增任何一個連結都可能讓 bug 復發，換頁也會變慢。

Allowed files（修訂）：`src/proxy.ts`、`src/lib/navigation/last-role-cookie.ts`（只加共用 cookie 設定）、新增的 remember-last-role 檔案、四個專區 `layout.tsx`、`tests/smoke/signed-in-navigation.spec.ts`（只新增案例）、`docs/signed-in-navigation-plan.md`、本票。

## 原始方案（已證實不可行，保留紀錄）

- `src/proxy.ts`：請求帶 `next-router-prefetch` header 時不寫上次身分 cookie；真正的頁面請求（含 client 端點擊導覽的 RSC 請求，無 prefetch header）照舊寫入。
- 回歸測試：在 `signed-in-navigation.spec.ts` 新增一支案例——老師進老師專區 → 開 `/classes` 並等待實際的 `/member/*` prefetch 回應完成（以請求事件判斷，不用固定秒數）→ 首頁仍回老師總覽；並驗證點導覽列「總覽」真的進學員專區後，上次身分變為學員。原有案例與斷言不修改。
- 文件：`docs/signed-in-navigation-plan.md` 補記「預先載入不算進入專區」。
- 不採用的做法：在 MemberShell 等導覽列關掉 prefetch。這要改所有角色外框，換頁也會變慢，而且沒有修到根因。

Allowed files：`src/proxy.ts`、`tests/smoke/signed-in-navigation.spec.ts`（只新增案例）、`docs/signed-in-navigation-plan.md`、本票。

## Acceptance criteria

- [x] 只逛套學員外框的公開頁、且 `/member/*` prefetch 已完成後，首頁／`/sign-in` 仍回上次專區總覽
- [x] 實際點進學員專區後，上次身分改為學員（既有行為不變）
- [x] 外站 callback 仍被過濾；站內 callback 仍優先（原案例通過；`/\evil.example/` 等繞過屬票 05）
- [x] 原 signed-in-navigation 案例在包含第一批變更的 build 上 desktop／mobile 全過，未改既有斷言、未靠重試
- [x] 新增回歸案例在 HEAD 版 proxy 上會失敗、修復後通過（證明測得到這個 bug）
- [x] tsc、lint、build 通過；proxy 修改完成 security self review（cookie 仍只是偏好，不涉權限）

## 實作結果（2026-10-04，未 commit）

**Status 補充：** 已實作並驗證，待產品主人 review；未 commit／push。

Changed files：`src/proxy.ts`、`src/lib/navigation/last-role-cookie.ts`、`src/lib/navigation/remember-last-role-action.ts`（新）、`src/app/_components/remember-last-role.tsx`（新）、`src/app/{member,teacher,organizer,admin}/layout.tsx`、`tests/smoke/signed-in-navigation.spec.ts`（新增 3 案例，原案例未改）、`docs/signed-in-navigation-plan.md`、本票。

驗證（隔離 worktree：HEAD e7598a3＋第一批 patch＋本票修改；PORT=3200；production build）：
- tsc、eslint（變更檔）、`next build` 通過。
- 預先載入案例在未修正程式上 desktop／mobile 皆失敗（預期 teacher、實得 member）。
- signed-in-navigation＋role-switch 一次執行 24/24 通過（含原本失敗的角色返回案例）。
- 三個新案例 `--repeat-each 5` 共 30/30 通過。第一次重跑時多分頁案例 mobile 1/18 失敗，原因是分頁 A 掛載時的記錄請求晚於分頁 B 抵達；測試改為先等分頁 A `networkidle` 再開分頁 B（斷言不變），之後穩定。
- 相關套件一次執行（signed-in-navigation、role-switch、四種總覽、public-classes-discovery、class-discovery-filters、enrollment、enrollment-approval）：148 passed／2 failed。
  - `enrollment.spec.ts:142` mobile：失敗步驟是 `page.goto` 整頁開 `/classes/[id]`，該頁不在專區 layout，不含本票元件，判定與本票無關；單獨重跑 4 次全過。
  - `admin-dashboard.spec.ts:178` desktop：單獨重跑 4 次、整組 `--repeat-each 4` 56/56 通過，判定為偶發。期間 PORT 3100 另有工作階段在跑測試、共用同一 DB，是可能干擾來源；未完全排除與本票的關聯。
- 證據：`.ai-runs/member-flow-redesign-01/`。

Security self review：server action 不需登入也能呼叫，但只能把呼叫者自己的偏好 cookie 設成合法身分代號；`getLastRole` 讀取時仍重新確認身分，無權限影響。Next.js server action 內建 origin 檢查。

已知代價：專區內每次換頁多一個很小的 server action 請求（cookie 相同時不寫入、不觸發重新整理）。


<!-- codex-peer-reviewed: 2026-10-03T22:08:18Z rounds=2 verdict=approved -->
