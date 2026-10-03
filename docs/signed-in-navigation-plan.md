# 登入後導覽與身分流程計畫（2026-09-27，規劃中，等使用者確認票單後才動工）

這份記錄 2026-09-27 跟 Franz 用 grill 方式討論出的決策。起因：一個老師申請審核中的帳號，登入後在「老師合作」頁看到的是公開 header，沒有身分切換，也回不去自己的專區；每次打開網站都要從首頁開始。

目標：登入後不會再「掉回」行銷網站，每一頁都能切換身分；打開網站直接從上次身分的總覽開始。用詞見 `docs/context/glossary.md`（公開 header、專區導覽列、上次身分）。

**範圍限制**：不動資料庫結構、不動狀態機、不動權限（每頁原本的身分檢查不變，這次只決定導覽列顯示什麼、登入後導到哪裡）；不動 V1 scope；不改 `RoleShell`／`RoleNav` 的參數格式（各角色 Shell 不用跟著改）。

## 現況（2026-09-27 查證）

- 首頁 `/`：登入後仍停在首頁，不會自動進總覽。
- `/teachers/join`：只有已通過、已暫停的老師導到老師總覽；草稿、審核中、被退回留在公開頁，看到公開 header。
- `/organizers/request`：已是團主導到 `/organizer/demands/new`；其他人留在公開頁。
- `/classes`、`/classes/[id]`：不論登入與否都用公開 header；學員導覽列的「找課程」點下去會離開學員專區。
- 登入完成預設進 `/member/dashboard`；沒有記住上次身分。
- `/notifications`：外框依「團主 → 老師 → 學員」優先順序決定。
- 已登入開 `/sign-in`：顯示「前往我的專區」按鈕，要多按一下。

## 定案決策

| # | 決策 |
| --- | --- |
| 1 | 公開 header 只給沒登入的訪客；登入後每一頁都用專區導覽列（有角色切換）。「我的專區」按鈕從公開 header 移除。 |
| 2 | 登入後各頁的專區：搜尋課程、課程詳情 → 學員；老師合作 → 有老師資料（草稿、審核中、退回）用老師專區、頁面內容不變，已通過或已暫停照舊導到老師總覽，沒有老師資料用學員專區；發起團課 → 已是團主照舊導到發起新需求，還不是用學員專區。 |
| 3 | 關於、FAQ、已登入時的其他共用頁 → 用上次身分的專區。通知：老師 session 已新增 `/teacher/notifications`、`/organizer/notifications`（從哪個專區點通知就留在哪個專區，內容共用 `OwnNotificationsContent`）；學員比照新增 `/member/notifications`，學員導覽列的「通知」改指向它；舊的 `/notifications` 改成依上次身分挑外框，不再「團主優先」。 |
| 4 | 上次身分＝最後一次進入的專區（切換身分或點連結進去都算）。 |
| 5 | 上次身分存在瀏覽器 cookie，不改資料庫；存資料庫的版本列 `docs/backlog.md` 第 14 項。 |
| 6 | 已登入開首頁 `/` → 直接導到上次身分的總覽。Google 登入完成 → 上次身分的總覽；從某堂課被帶去登入時（有 callbackUrl）回那堂課。 |
| 7 | 已登入開 `/sign-in` → 直接導到 callbackUrl，沒有就導到上次身分的總覽。 |
| 8 | 上次身分已不能用（例如管理員權限被取消、老師資料不存在）→ 回學員總覽。 |
| 9 | 專區導覽列的 logo 改連到目前身分的總覽，避免點 logo 被首頁導來導去。 |
| 10 | 兩種導覽列的手機選單按鈕都用 ☰ 圖示（`aria-label` 保留「選單／關閉選單」）；沒登入時公開 header 不顯示「我的專區」。（2026-09-27 產品主人決定 1A、2A，實作在 member-usability 票 08。） |

## 需要注意的前置查證（動工前先做）

- 決策 4、5：Next.js 16 用 `src/proxy.ts`（原 middleware）在進入 `/member`、`/teacher`、`/organizer`、`/admin` 時寫 cookie；確認不影響 Auth.js 的登入流程與既有 cookie。cookie 只存身分代號，不存任何個資。
  - 2026-10-04 修正（`docs/superpowers/plans/member-flow-redesign/tickets/01-fix-last-role-prefetch.md`）：背景預先載入（prefetch）不算「進入」。原本 proxy 對所有 `/member/*` 等請求都寫 cookie，老師只是逛了套學員外框的 `/classes`，導覽列連結被 Next.js 預先載入就變成學員。Next.js 會在 proxy 之前拿掉 prefetch header，proxy 分不出預先載入與站內換頁，所以拆成兩條路：
    - 整頁載入：`src/proxy.ts` 只在 `sec-fetch-dest: document`（或沒有這個 header 的非瀏覽器請求）時寫入。
    - 站內換頁（點 logo、導覽列、切換身分選單）：四個專區 layout 放 `RememberLastRole`（`src/app/_components/remember-last-role.tsx`），畫面實際出現、且每次專區內換頁完成時呼叫 server action `rememberLastRole`（`src/lib/navigation/remember-last-role-action.ts`）。server action 讀當下 cookie，不同才寫，避免其他分頁改過後本分頁漏記；只接受合法身分代號。
    - 兩條路共用 `lastRoleCookieOptions`（`src/lib/navigation/last-role-cookie.ts`），cookie 屬性一致。
- 決策 2：`/classes` 系列的訪客分支（`getPublicClassSessionDetail`）與登入分支要分別套不同外框，不能讓訪客資料路徑改變。
- 決策 3：角色切換的「目前身分」現在靠網址前綴判斷，`/classes`、`/about` 這類頁面沒有前綴，要改成依外框傳入的身分判斷。
- 決策 8：上次身分失效的判斷要沿用 `getRoleSwitchOptions` 已有的身分判斷，不另寫一套。

## 協調

`role-nav.tsx`、`role-shell.tsx`、`/teachers/join` 與 `/organizers/request` 的外框、`/notifications` 屬於多個 session 共用；2026-09-27 已通知老師、團主、Admin session 暫停改動，改完要再通知。
