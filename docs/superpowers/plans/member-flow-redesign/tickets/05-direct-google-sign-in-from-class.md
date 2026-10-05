# 05: 從課程直接 Google 登入

**What to build:** 訪客在課程詳情按「登入後報名」，直接進入既有的 Google 登入，不再先經過站內登入頁。按鈕附近清楚說明「第一次使用會自動建立帳號」。登入成功回到同一堂課，並保留原本的找課條件；取消或失敗時也能回到原課重試。回來後重新檢查課程與名額，學員仍要自己勾同意並按報名。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（Auth 登入入口與 callback）

**Risk flags:** Auth、callback 安全（含既有 open redirect 修正）、登入失敗處理。

**Source:** `docs/member-flow-redesign-plan.md` Q6、Q12、分批表第 3 批；`docs/backlog.md` 第 15 項。

## 已決定的規格（不重問）

- 只用既有 Google provider；不新增 provider、session／角色模型或帳號連結策略。
- 不自動報名，不預勾 basicConsent。
- callback 只接受站內合法路徑。
- 回來時課程已額滿、已開始或不可報名，顯示當下狀態與「找其他課程」，不暗示有保留名額。

## 既有 callback 漏洞（Codex 審查發現，2026-10-04 已驗證）

`src/lib/auth/callback-url.ts` 的 `sanitizeCallbackUrl` 只檢查「以 `/` 開頭、不以 `//` 開頭」。`/\evil.example/` 會通過檢查，但瀏覽器把反斜線當斜線，`new URL("/\\evil.example/", 站內網址)` 解析為 `https://evil.example/`。已登入者開 `/sign-in?callbackUrl=...` 時，sign-in 頁會直接 `redirect()` 到這個值，形成 open redirect。HEAD 已存在，不是第一批造成。

本票必須修正：以站內網址為基底解析 callback，要求解析後 origin 與站內相同，再組出正規化後的 path＋query＋hash；拒絕反斜線、控制字元與其他解析後跨站的值。另外，正規化本身可能產生新的 `//` 開頭路徑（例如 `/a/..//evil.example/`、`/a/%2e%2e//evil.example/` 解析後 pathname 為 `//evil.example/`），所以要對**最終回傳字串**再檢查一次：不得以 `//` 開頭，且以它重新解析後仍與站內同源，否則拒絕。

## Builder plan（2026-10-04，待 Human Gate）

查證結果（next-auth 5.0.0-beta.31／@auth/core 0.41.2）：
- Google 登入路徑本身同源：Auth.js 預設 `redirect` callback 對 `/` 開頭的值回傳 `${baseUrl}${url}`，`/\evil.example/` 只會變成本站路徑。open redirect 實際發生在 `src/app/sign-in/page.tsx`：已登入者開 `/sign-in?callbackUrl=...` 時直接 `redirect(safeCallbackUrl)`，回傳相對 Location，瀏覽器把 `/\evil.example/` 解析成外站。
- `src/auth.ts` 沒有設定 `pages`，Google 取消或失敗時落在 Auth.js 內建英文頁面，沒有回課程的出口。
- Auth.js 依錯誤種類選頁面：`OAuthCallbackError`（含在 Google 按取消）、`OAuthAccountNotLinked` 屬於 `SignInError`（kind `signIn`），導向 `pages.signIn`；其他導向 `pages.error`。兩者都只帶 `?error=<代碼>`，不會帶原本的 callbackUrl（`@auth/core/index.js`）。
- Auth.js 的 PKCE／state／nonce cookie 有效 15 分鐘；`signIn` 收到的 `redirectTo` 存在 Auth.js 自己的 `authjs.callback-url` cookie。

做法：
1. **callback 過濾（`src/lib/auth/callback-url.ts`）**：改成
   - 拒絕空值、非 `/` 開頭、`//` 開頭、含反斜線（含 `%5c`）或控制字元（`\u0000-\u001f`、`\u007f`）的值；
   - 以固定站內 base 解析，origin 不同就拒絕；
   - 回傳 `pathname + search + hash` 的正規化結果，並再檢查一次：不得以 `//` 開頭，重新解析後仍同源，否則拒絕。
   所有既有呼叫端（sign-in 頁）不用改介面。
2. **課程頁直接 Google（`ClassEnrollmentPanel.tsx`＋`src/app/classes/[classSessionId]/actions.ts`）**：
   - 訪客的「登入後報名」從連結改成表單按鈕「使用 Google 登入並報名」，按鈕前文字說明：首次使用會自動建立帳號、登入後回到這堂課、要自己確認才會報名。
   - 新增 server action：讀 `classSessionId` 與 `returnTo`，用既有 `classDetailHref` 組出回課程網址（只會是 `/classes/<id>` 加上安全的找課條件），寫入登入返回 cookie 後呼叫 `signIn("google", { redirectTo })`。
   - `/sign-in` 頁原本的 Google 按鈕 server action 也改為先寫登入返回 cookie 再呼叫 `signIn`。
   - **共用登入選項（2026-10-05 產品主人選 A，為之後的 LINE、Facebook、Email 登入預留）**：
     - 新增 `src/lib/auth/sign-in-providers.ts`：列出目前開放的登入方式（現在只有 `google`，含顯示名稱），並提供「是否為開放的登入方式」的檢查。
     - 新增共用元件 `src/app/_components/sign-in-options.tsx`：依清單畫出登入按鈕，每顆按鈕是一個表單，帶 `provider` 與本次目的地；只有一種方式時按鈕寫「使用 Google 登入並報名」（課程頁）或「使用 Google 帳號繼續」（`/sign-in`），文案由呼叫端傳入。課程頁報名區與 `/sign-in` 頁都改用這個元件。
     - 兩個 server action（課程頁、`/sign-in`）都接受 `provider`，不在清單內就拒絕（回 `/sign-in?error=` 的固定文案，不呼叫 `signIn`）。
     - 本票不新增任何 provider、不改 `src/auth.ts` 的 `providers`；清單內容必須與 `src/auth.ts` 實際設定的 provider 一致。帳號合併等多 provider 決策見 `docs/backlog.md` 第 4 項。
3. **登入返回 cookie（新增 `src/lib/auth/sign-in-return.ts`）**：名稱 `fsy_sign_in_return`，值只存經 `sanitizeCallbackUrl` 過濾的站內路徑，`httpOnly`、`sameSite: "lax"`、`path: "/"`、HTTPS 下 `secure`、20 分鐘有效（長於 Auth.js 流程的 15 分鐘）；讀取時再過濾一次。不存個資。
   - **每一次送出登入都覆寫**：課程頁按鈕、`/sign-in` 頁的 Google 按鈕、錯誤畫面的重試按鈕，都在呼叫 `signIn` 前寫入本次目的地（沒有目的地就寫 `/`），並重新計算 20 分鐘。這樣上一次登入的目的地不會被下一次不同入口的失敗沿用。
   - 不另外清除：每次登入都會覆寫，20 分鐘後自然失效。
4. **取消／失敗出口（`src/auth.ts`、`src/app/sign-in/page.tsx`）**：
   - `src/auth.ts` 加 `pages: { signIn: "/sign-in", error: "/sign-in" }`，兩種錯誤路由都回本站登入頁；不改 provider、session 策略、adapter 或 callbacks。`/sign-in` 不需要登入就能看，不會造成錯誤頁迴圈。
   - sign-in 頁有 `error` 參數時，顯示「登入沒有完成，沒有送出任何報名」與重試按鈕；重試的目的地依序取 `callbackUrl` 參數、登入返回 cookie、`/`。目的地是 `/classes/` 開頭時多顯示「回到課程」連結。
   - 錯誤代碼不顯示給使用者（只用固定文案），避免透露內部資訊。
   - 這個錯誤頁對全站生效：老師申請、發起團課等其他從 `/sign-in` 進來的流程，失敗時也會看到同一個友善頁面；沒有返回 cookie 時只顯示重試。
5. **不變的部分**：不新增 provider、不改 session／角色模型、不自動報名、`basicConsent` 不預勾；登入回來後課程頁照常重新讀取名額與狀態（現有行為）。其他入口（老師申請、發起團課）仍走 `/sign-in?callbackUrl=`。

Allowed files：`src/lib/auth/callback-url.ts`、`src/lib/auth/sign-in-return.ts`（新）、`src/lib/auth/sign-in-providers.ts`（新）、`src/app/_components/sign-in-options.tsx`（新）、`src/auth.ts`（只加 `pages.signIn` 與 `pages.error`）、`src/app/sign-in/page.tsx`、`src/app/classes/_components/ClassEnrollmentPanel.tsx`、`src/app/classes/[classSessionId]/actions.ts`、`tests/smoke/callback-url.spec.ts`（新，純函式）、`tests/smoke/class-direct-sign-in.spec.ts`（新）、`tests/smoke/public-classes-discovery.spec.ts`（原本斷言「登入後報名」連結 href、進入站內登入頁、登入頁的 Google 按鈕、在登入頁加 session 後 reload 回課程的中繼步驟，改為直接 OAuth 入口與 Auth.js 回程目的地的斷言；篩選保留、同意未預勾、報名結果、RWD 等實質斷言不刪）、`docs/engineering/auth-entry-strategy.md`、本票。

測試計畫：
- 純函式：上面所有惡意值都回 `null`；正常站內路徑（含 query、hash、中文）照常保留。
- 已登入開 `/sign-in?callbackUrl=<惡意值>`：都導到上次身分總覽，不離站。
- 訪客在課程頁（帶找課條件）按 Google 按鈕：攔截瀏覽器往 `accounts.google.com` 的導向（不真的連 Google），驗證 Auth.js 的 `authjs.callback-url` cookie 是本站的這堂課＋完整找課條件，且登入返回 cookie 相同；接著加上模擬 session、前往該回程網址，確認回到同一堂課、條件保留、未自動報名、同意框未勾。
- 不在清單內的登入方式：直接對課程頁與 `/sign-in` 的 server action 送 `provider=github`（或任意值），不會呼叫 `signIn`、不會離開本站，落在 `/sign-in?error=` 固定文案。
- 惡意 callback 走 Google 送出路徑：訪客開 `/sign-in?callbackUrl=<每個惡意值>` 按 Google，`authjs.callback-url` 與登入返回 cookie 都是本站 `/`。
- 跨入口不沿用：先從課程 A 送出登入，再從 `/sign-in?callbackUrl=/teachers/join` 送出，之後打取消 callback，錯誤畫面重試目的地是 `/teachers/join`、沒有「回到課程」連結。
- 取消／失敗：先從課程頁送出登入（讓 Auth.js 建好這次流程的 cookie），再打本站 `/api/auth/callback/google?error=access_denied`，驗證落在本站 `/sign-in?error=...`（不是 `/api/auth/signin`）、顯示固定文案、「回到課程」指向原課程與找課條件、重試按鈕存在、沒有建立報名；另打一個屬於 `pages.error` 的錯誤（例如 `/api/auth/error?error=Configuration`）也落在本站登入頁。
- 模擬登入完成（既有 session cookie 做法）回到課程：不自動報名、同意框未勾、額滿或已開始時顯示正確出口。
- 原有 public-classes-discovery、enrollment、signed-in-navigation、teacher-join、organizers-request 相關 smoke 一次執行全過。
- 網路前提：Google provider 在送出登入與 callback 時，伺服器會連 Google 的 OIDC discovery；瀏覽器攔截擋不到這個伺服器端請求。smoke 需要能連外網，若 discovery 連線失敗，報告列為環境問題，不判定為產品回歸。
- 真實 Google OAuth 手動驗收另列，需產品主人操作：成功首次建帳號、成功既有帳號、在 Google 畫面取消、取消後 15 分鐘內按「回到課程」與重試。

## Acceptance criteria

- [x] 開工前提供具體 Builder plan（含 callback security review 重點），經 Human Gate 確認（2026-10-05 產品主人選 A，含共用登入元件）
- [x] 訪客從詳情一鍵進 Google，成功後回同一堂課，並保留列表條件（自動化：Auth.js 回程網址＝課程＋找課條件；真實登入待手動驗收）
- [x] 首次建帳號的說明在按鈕前就看得到
- [x] 取消／失敗回原課，可重試，不送出報名（自動化：模擬 callback 錯誤落在本站 `/sign-in?error=`、「回到課程」與重試正確、無報名；真實 Google 取消：2026-10-05 產品主人手動驗收通過）
- [x] 回來後名額與狀態重新讀取；額滿／已開始時顯示正確出口（沿用第一批頁面，public-classes-discovery、enrollment 既有斷言通過）
- [x] 外站或非法 callback 被拒絕；回歸案例至少包含 `https://evil.example/`、`//evil.example`、`/\evil.example/`、`/a/..//evil.example/`、`/a/%2e%2e//evil.example/`、含 tab／換行等控制字元的值，且已登入開 `/sign-in` 與 Google 登入兩條路徑都驗證
- [x] `docs/engineering/auth-entry-strategy.md`、`docs/domain/permissions.md` 視需要同步（auth-entry-strategy 新增第 7 節；權限模型未變，permissions.md 不需改）
- [x] tsc、lint、build；站內 session 模擬 smoke 通過
- [x] 報告分開寫：本站 session 模擬 smoke 結果，以及真實 Google OAuth 手動驗收結果（見下方兩段）
- [x] 真實 OAuth 手動驗收未完成時，可交付實作與限制報告，但本票驗收維持未完成，票 06 不得據此宣稱完整旅程已通過（已完成，見下方）

## 實作結果（2026-10-05，未 commit）

**Status 補充：** 驗收完成（2026-10-05）。實作已 commit 並 push（`048b878`）。

Changed files：`src/lib/auth/callback-url.ts`、`src/lib/auth/sign-in-return.ts`（新）、`src/lib/auth/sign-in-providers.ts`（新）、`src/app/_components/sign-in-options.tsx`（新）、`src/auth.ts`（只加 `pages`）、`src/app/sign-in/page.tsx`、`src/app/classes/_components/ClassEnrollmentPanel.tsx`、`src/app/classes/[classSessionId]/actions.ts`、`tests/smoke/callback-url.spec.ts`（新）、`tests/smoke/class-direct-sign-in.spec.ts`（新）、`tests/smoke/public-classes-discovery.spec.ts`、`docs/engineering/auth-entry-strategy.md`、`docs/backlog.md`（第 4 項補充）、本票。

**本站 session 模擬 smoke（自動化）**：隔離 worktree（main `518016b`＋本票 11 個程式／測試檔），PORT=3300，production build。
- tsc、全專案 eslint、build 通過。
- callback-url＋class-direct-sign-in＋public-classes-discovery＋enrollment＋signed-in-navigation＋teacher-join＋organizers-request 一次執行 **122/122 通過**。
- 測試過程修正的都是測試寫法：Google 攔截改回傳假頁面並等瀏覽器停在該頁；`role="alert"` 改以文字篩選（Next.js 自帶一個 route announcer）；Auth.js 錯誤轉址以環境設定的站台網址組成（本機為 `localhost:3000`，與測試埠不同），改讀轉址目標再於測試埠打開。
- 模擬限制：測試自己組的取消 callback 沒有 Google 會帶的 `state`／`iss`，Auth.js 記為 `CallbackRouteError`（error 類），仍落在本站 `/sign-in?error=`。真實 Google 取消會是 signIn 類錯誤，靠 `pages.signIn` 落到同一頁，需手動驗收確認。
- 證據：`.ai-runs/member-flow-redesign-05/`。

**真實 Google OAuth 手動驗收**：2026-10-05 產品主人在本機開發伺服器（`localhost:3000`）手動操作後回報「驗收完成」。驗收步驟為：課程頁按「使用 Google 登入並報名」→ 在 Google 畫面取消 → 回到「登入沒有完成」畫面並有「回到課程」→ 重試完成登入 → 回到同一堂課、同意框未預勾。此結果為產品主人回報，Claude 未直接觀察操作過程；首次建帳號（可選步驟）是否另外測試未說明。

Security self review：callback 過濾已涵蓋反斜線、控制字元、正規化繞過；Google 路徑由 Auth.js 預設 redirect callback 保證同源；server action 只接受清單內的登入方式；登入返回 cookie 只存過濾後的站內路徑、`httpOnly`；錯誤代碼不顯示給使用者。未新增 provider、未改 session／角色模型、不自動報名、同意框不預勾。

可補強的 smoke（Codex 實作 review 建議，非阻擋）：登入開始後才讓課程額滿或開始，再模擬返回；取消後實際按重試並核對兩個 cookie。可在票 06 驗收時一併補上。

<!-- codex-peer-reviewed: 2026-10-04T21:49:20Z rounds=1 verdict=approved -->
