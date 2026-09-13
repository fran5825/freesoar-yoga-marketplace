# Teacher Join — Gate the Application Form Behind Sign-In

## 0. 如何閱讀本 plan（給零背景 Builder）

這是一個 UI 重構 + 一個既有 bug 修復，**不動 Prisma schema、不動狀態機、不動權限模型**。核心改動只有一個檔案（`src/app/teachers/join/page.tsx`）跟它旁邊的元件拆分，加上把既有、上個月才做好的 `callbackUrl` 登入導回機制接到這一頁。施工前請先讀完第 4 節的 Gate（已由產品主人核准，見該節記錄），再讀第 7 節的切片順序。

## 1. 背景與範圍

### 問題

`/teachers/join` 目前不論登入與否，一律直接顯示完整的老師申請表單（`src/app/teachers/join/page.tsx`，整頁是 `"use client"`）。匿名訪客可以把所有欄位都填完，但表單本身的內容只存在瀏覽器記憶體裡——直到按下「儲存草稿」或「送出審核」，`saveTeacherProfileDraftAction`／`submitTeacherProfileApplicationAction` 這兩個 server action 才會因為 `requireUser()` 失敗回傳 `authentication_required`，畫面才顯示「請先登入」與一個「前往登入」連結。

這個連結是 plain `<a href="/sign-in">`，沒有帶 `callbackUrl`。點下去會離開這一頁走 Google OAuth，登入完成後被導到 `/account`（`/sign-in/page.tsx` 沒收到 callbackUrl 時的既有預設行為）。因為整頁表單狀態只活在 React component state 裡，這趟 OAuth 往返會讓瀏覽器整頁導航，state 全部歸零——**老師如果填了整份表單才發現要登入，繞一圈回來會發現剛才填的內容全部消失**。

這個現況也不是原始設計：`docs/specs/teacher-onboarding-spec.md` 第 32–38 行的 User Flow 明確寫著「Visitor 進入頁面 → 了解定位與合作方式 → 註冊或登入 → 才填寫申請表」。目前實作沒有照這個順序做，是實作與已核准規格的落差，不是本輪重新發明一個新設計。

### 額外發現：內部開發用語外洩到使用者畫面

現有表單區塊的 eyebrow 文字是英文的「Local-only application form」，內文有兩處直接寫「Phase 1 TeacherProfile」（`page.tsx` 第 650、662、671 行附近）——這些是開發階段的內部代稱，不該出現在老師會看到的畫面上，跟 Free Soar 想維持的「溫和、清楚、可信任」品牌語氣不符。

### 這次要做的事

把 `/teachers/join` 改成依登入狀態分支，同一個網址、不新增 `/teachers/application` 這類新路由：

- **未登入**：顯示品牌定位、合作方式、審核流程、申請會被問到哪些資料（唯讀預覽，不是可填的表單）、簡短 FAQ，以及一個「登入／建立帳號並開始申請」的 CTA。
- **已登入**：顯示現有的完整申請表單（draft 儲存、送審、已送審/已核准/已暫停/已退回四種狀態顯示）——這部分的邏輯與畫面**不變**，只是現在只有登入後才看得到。
- 所有指向 `/sign-in` 的連結（hero CTA、錯誤訊息裡的「前往登入」）一律帶上 `callbackUrl=/teachers/join`，讓老師登入完自動回到這一頁。
- 清掉「Local-only application form」「Phase 1 TeacherProfile」這類內部字眼，換成對外文案（草案見第 5 節）。

## 2. 範圍界線

### In scope

- `src/app/teachers/join/page.tsx`：改成 Server Component 做登入狀態分支（比照 `src/app/classes/[classSessionId]/page.tsx` 在 `teacher-initiated-open-classes` Slice D 已經驗證過的同一個 pattern：用 `getCurrentUser()`，不是會拋例外的 `requireUser()`）。
- 現有表單邏輯（`TeacherApplicationForm` 之類的拆分元件，檔名由 Builder 決定）：從現有 `page.tsx` 抽出來，邏輯**原封不動搬過去**，不重寫 draft/submit/狀態顯示的任何行為。
- 新增一個「未登入訪客看的說明區塊」元件：品牌定位、合作方式、審核流程、資料預覽、FAQ、CTA。
- `src/app/teachers/join/actions.ts`：不需要修改（`getInitialTeacherProfileApplicationSnapshotAction` 已經對未登入呼叫端安全地回傳 `null`，見 `actions.ts` 第 67–79 行的 try/catch）。
- 所有這一頁裡的「前往登入」連結：補上 `callbackUrl=/teachers/join`。**不修改** `src/lib/auth/callback-url.ts` 或 `src/app/sign-in/page.tsx` 本體——`callbackUrl` 機制已經在 `teacher-initiated-open-classes` Slice D 做好且有測試涵蓋，這裡只是新增一個呼叫端。
- 內部開發字眼替換為對外文案。
- `docs/specs/teacher-onboarding-spec.md`：比照這個文件裡其他「落地現況」段落的既有寫法（第 9–16 行的例子），在檔案開頭補一段說明這次改動對齊了原始 User Flow。
- `docs/product/route-map.md`：`/teachers/join` 現有條目補充「依登入狀態分支」的說明。
- 既有 smoke test 的必要調整（見第 8 節），與新增涵蓋新行為的 smoke test。

### Explicitly out of scope

- **不改 `TeacherProfile` 的任何欄位、狀態機或 Prisma schema**——`draft`／`submitted`／`approved`／`rejected`／`suspended` 這五個狀態與其轉換規則完全不動。
- **不改 `/sign-in`、`callbackUrl` 驗證邏輯本身**——沿用既有實作，只是這一頁第一次呼叫它。
- **不做「登入前先在瀏覽器暫存表單內容，登入後自動帶回」的機制**——改成「未登入根本不顯示可填的表單」之後，這個問題從設計上就不存在了，不需要另外做一層草稿暫存。
- **不改 Admin 審核流程、老師 dashboard 或 `/teacher/profile`**——這些頁面不在本輪範圍。
- **不做 `/sign-up` 或其他 auth provider**——沿用現有 Google OAuth。
- **不重新設計整個網站的品牌視覺**——沿用現有 `/teachers/join` 已經在用的色票與版型慣例（`#345343`、`#8a5c49` 等既有 token），`docs/superpowers/plans/2026-08-02-brand-visual-design-system-plan.md` 尚未核准任何新色票，這裡不預先假設。

## 3. 既有程式碼盤點

- `src/app/teachers/join/page.tsx`（1038 行，全部是 `"use client"`）：hero 區塊（品牌定位文案 + 兩個既有 CTA：「登入並準備加入」→ `/sign-in`、「回到首頁」→ `/`）→ `collaborationPrinciples` 三張卡片（既有、內容已經是合適的品牌文案，**保留不動**）→ 「老師申請資料準備區」表單區塊（本輪要改成登入才顯示的部分）→ 「Next steps」時間軸（既有、內容合適，**保留不動**）。
- `src/app/teachers/join/actions.ts`：三個 server action，皆已經是最小、安全的包裝，見上方 in-scope 說明，不需要動。
- `src/lib/auth/callback-url.ts`：`sanitizeCallbackUrl()`，已有單元測試（`tests/smoke/public-classes-discovery.spec.ts`），直接複用。
- `src/app/sign-in/page.tsx`：已支援 `?callbackUrl=` 查詢參數並在 `signIn("google", { redirectTo: callbackUrl })` 使用，不需要修改。
- `src/lib/auth/session.ts`：`getCurrentUser()` 回傳 `CurrentUser | null`，不拋例外，已在 `/classes/[classSessionId]/page.tsx` 驗證過的既有 pattern，直接複用同一種寫法。
- `docs/specs/teacher-onboarding-spec.md`：User Flow（第 32–38 行）是這次改動要對齊的既有規格；State Transitions／Status Definitions／Rejection Reason 三節完全不受影響。

## 4. 產品主人決策 Gate（已核准）

以下四個 Gate 已由產品主人於本輪對話中拍板，Builder 可直接依此施工，不需要再次確認。

| Gate | 決策 | 理由 |
|---|---|---|
| G1 未登入訪客看到的內容範圍 | 沿用現有 hero 與 `collaborationPrinciples` 區塊（不重寫），新增「審核流程」「申請會被問到什麼」（唯讀預覽，複用現有 `applicationSections`／`fieldLabels` 定義產生文字，不另外維護一份重複的欄位清單）與簡短 FAQ 三個新區塊 | 現有素材已經覆蓋品牌定位與合作原則，真正缺的是審核流程說明與資料需求預覽，範圍小而明確 |
| G2 登入狀態判斷搬到 Server Component | 是——把 `page.tsx` 最外層改成 Server Component，用 `getCurrentUser()` 判斷後渲染對應的子元件；現有表單邏輯整段搬進一個新的 Client Component | 避免「先閃一下表單、才發現要登入」的畫面閃爍；跟 `teacher-initiated-open-classes` Slice D 在 `/classes/[classSessionId]` 已經驗證過的做法保持一致，不是本輪發明新 pattern |
| G3 所有「前往登入」連結補 `callbackUrl` | 是——hero CTA 與儲存/送出失敗訊息裡的登入連結，一律 `href="/sign-in?callbackUrl=/teachers/join"` | 這是本輪要修的核心 bug |
| G4 內部開發字眼替換 | 是，文案草案見第 5 節，Builder 施工時可直接採用，不需要另外送審文案 | 品牌一致性，風險低、範圍小 |

## 5. 文案草案（給 Builder 直接採用，非最終定案——若你想改字句，Builder 可以微調語氣但不能改變資訊本身）

**未登入訪客看到的 CTA（沿用既有 hero 位置與樣式）**：「登入／建立帳號並開始申請」，取代現有「登入並準備加入」（原文案偏隱晦，新文案直接說明按下去會發生什麼）。

**新增：審核流程區塊**：
> 標題：審核怎麼進行
> 內文：送出申請後，平台會確認你的教學背景與服務範圍是否符合 Free Soar 的合作定位。審核期間你可以隨時回來查看進度；如果需要補充資料，我們會清楚告訴你需要調整的地方，你可以直接修改後重新送出，沒有次數限制。

**新增：申請會被問到什麼（唯讀預覽，資料來自既有 `applicationSections`，只列必填/建議，不做輸入框）**：
> 標題：申請前可以先準備這些
> 逐條列出現有 `requiredFields` 對應的欄位標籤（公開顯示名稱、教學年資、老師簡介、教學風格、擅長類型、可服務區域、授課形式），標註「送審必填」；`certifications`／`priceRange`／`profilePhotoUrl` 標註「建議，可留空」。

**新增：簡短 FAQ（2–3 題，Builder 可視版面調整題數）**：
> Q：審核大概要多久？A：目前沒有固定的審核時間承諾，平台會盡快確認並在完成後透過站內通知告訴你結果。
> Q：沒有通過會怎樣？A：會收到具體的退回原因，你可以依照說明修改後重新送出，沒有次數限制。
> Q：我需要先有正式證照才能申請嗎？A：不一定，平台重視教學風格與經驗說明是否清楚，證照與訓練背景是加分的建議欄位，不是必填門檻。

**表單區塊 eyebrow 文字替換**：「Local-only application form」→「老師申請」。

**表單區塊說明文字替換——這份清單是逐字對照現有 `page.tsx`（施工當下版本）找出的全部出現處，不是舉例；Builder 完成後仍必須額外執行「驗證」小節那條指令確認沒有遺漏**：

| 位置 | 原文 | 新文 |
|---|---|---|
| 「老師申請資料準備區」說明，`mutationBlockedCopy` 分支 | 「這份 TeacherProfile 目前已有狀態紀錄。此頁只做初始資料與狀態呈現，不開放此狀態的草稿儲存、重新送審或 Admin review 操作。」 | 「你的申請資料目前已有紀錄。此頁只顯示目前狀態，不提供這個狀態下的草稿儲存或送審操作。」 |
| 同區塊，`isRejectedProfile` 分支 | 「這份 TeacherProfile 已退回修正。你可以依平台提供的修正方向更新內容，儲存修正後再重新送出審核。」 | 「這份申請已退回修正。你可以依平台提供的修正方向更新內容，儲存修正後再重新送出審核。」 |
| 同區塊，預設分支 | 「你可以先在這裡整理 Phase 1 TeacherProfile 需要的內容，並在登入後手動儲存草稿。儲存草稿只會建立或更新 draft，不會送出審核，也不會進入 Admin review。」 | 「你可以先在這裡整理申請需要的內容，並在登入後手動儲存草稿。儲存草稿只會建立或更新草稿，不會送出審核，也不會進入平台審核。」 |
| 「準備狀態」區塊說明，`mutationBlockedCopy` 分支 | 「目前狀態不開放在加入表單中更新或送出。你仍可查看已保存的 Phase 1 TeacherProfile 內容。」 | 「目前狀態不開放在加入表單中更新或送出。你仍可查看已保存的申請內容。」 |
| 同區塊，預設分支 | 「「檢查準備狀態」不是正式送出；「儲存草稿」也不會送審。這裡只是協助你用低壓方式整理 Phase 1 申請內容。」 | 「「檢查準備狀態」不是正式送出；「儲存草稿」也不會送審。這裡只是協助你用低壓方式整理申請內容。」 |

**驗證（Slice 3 完成後必須執行，不是選做）**：`rg -n "TeacherProfile|Phase 1" src/app/teachers/join` 確認搜尋結果只剩程式碼識別字（型別名稱、變數名、註解），沒有任何出現在 JSX 文字節點裡——上面這份表格是施工當下窮舉的結果，如果 Builder 開工時 `page.tsx` 內容已經跟這份 plan 寫的時間點不同，必須以這條指令的實際搜尋結果為準，不能只照表格逐條核對。

## 6. RWD Requirements

沿用 `docs/specs/teacher-onboarding-spec.md` 既有的 360px／390px 要求；新增的三個說明區塊（審核流程、資料預覽、FAQ）比照現有 `collaborationPrinciples` 卡片的既有 RWD 慣例（`grid md:grid-cols-3`），不新增新的排版模式。

## 7. 實作切片

### Slice 1 — 拆分現有表單為獨立元件（不改行為）

把現有 `page.tsx` 裡表單相關的 state／handler／JSX 整段搬到一個新的 Client Component（例如 `_components/TeacherApplicationForm.tsx`），`page.tsx` 暫時原封不動 import 並渲染它。這一步驗收標準是**行為零改變**——跑一次既有 `tests/smoke/teacher-join.spec.ts` 應該原封不動全綠，證明搬移沒有動到邏輯。

**順便把 `applicationSections`／`fieldLabels`／`requiredFields` 這些純資料定義抽到一個不含 `"use client"` 的獨立模組**（例如 `_lib/application-fields.ts`），讓 Slice 2 的訪客預覽區塊與 `TeacherApplicationForm` 共用同一份欄位定義來源。這不是為了預留彈性——這是避免 Builder 在 Slice 2 被迫二選一：要嘛複製一份欄位清單（兩份清單之後改欄位容易漏改其中一份），要嘛把純靜態、不需要互動的訪客預覽內容也做成 Client Component（沒有理由的多餘 JS bundle）。

### Slice 2 — Server Component 分支 + 未登入說明頁

`page.tsx` 改為 `async function`，用 `getCurrentUser()` 判斷；未登入渲染新的說明頁元件（審核流程／資料預覽／FAQ／CTA，內容見第 5 節），已登入渲染 Slice 1 拆出來的 `TeacherApplicationForm`。

### Slice 3 — `callbackUrl` 接線 + 內部字眼替換

補上第 4 節 G3 的 `callbackUrl`，替換第 5 節 G4 列出的內部字眼。

### Slice 4 — 文件同步

更新 `docs/specs/teacher-onboarding-spec.md`（落地現況段落）與 `docs/product/route-map.md`（`/teachers/join` 條目）。

## 8. Verification Planning

### 既有測試會受影響，需要更新

- `tests/smoke/public-trust-pages.spec.ts` 第 89 行附近的 `"preserves existing organizer and teacher entry controls"`：目前在**未登入**狀態下斷言 `/teachers/join` 顯示「儲存草稿」「檢查準備狀態」「送出審核」三個按鈕——這個斷言在本輪之後會失敗（未登入不再顯示這些按鈕），需要改成斷言看到新的說明頁 CTA。
- **`tests/smoke/teacher-join.spec.ts` 的第一個測試（`"shows teacher application controls and submit confirmation"`，第 45–73 行）目前完全沒有建立 session**（測試函式簽章是 `async ({ page }) => {}`，沒有 `context`，沒有任何 cookie 設定），是在**匿名訪客**狀態下直接斷言「儲存草稿」「檢查準備狀態」「送出審核」三個按鈕可見並點擊——這個測試現在能過，是因為現行頁面本來就不分登入狀態都顯示表單。本輪之後這個前提不成立，此測試必須改寫，不是「確認仍然全綠」就結束。**改法**：比照第二個測試（rejected）的既有 session 建立方式（`createRejectedTeacherProfileSession` 那段 pattern），新增一個「已登入但尚未建立過 `TeacherProfile`」的 helper（`status` 欄位對應到 draft 之前、也就是資料庫裡根本沒有這筆 `TeacherProfile` 記錄的情境），建立 session、加 cookie，再執行原本那段按鈕可見性與確認送審流程的斷言。這樣改完之後，這個測試剛好變成驗證「一個全新老師第一次登入、看到表單、走過確認送審 UI」的核心情境，比原本的匿名版本更貼近這次改動真正要保護的行為。
- `tests/smoke/teacher-join.spec.ts` 的第二個測試（`"lets rejected teachers edit and resubmit"`）已經是已登入 context（`createRejectedTeacherProfileSession` + `addCookies`），Slice 1 若做到位不需要改內容，只需要確認仍然全綠。
- `tests/smoke/admin-teachers.spec.ts:144`、`tests/smoke/notification.spec.ts:84` 兩處 `page.goto("/teachers/join")`：需要 Builder 開工前各自確認呼叫當下是否已登入，若是未登入情境下順手觸發了表單相關斷言，需要一併調整。

### 新增測試

新增 `tests/smoke/teacher-join-gating.spec.ts`（或併入既有 `teacher-join.spec.ts`，Builder 決定），至少涵蓋：

- 未登入訪客造訪 `/teachers/join`：看不到任何表單輸入框，看得到審核流程／資料預覽／FAQ／CTA。
- CTA 的 `href` 精確等於 `/sign-in?callbackUrl=%2Fteachers%2Fjoin`（或等價的未編碼形式，視 Builder 實作方式而定）。
- 已登入（含 `draft`／`submitted`／`rejected`／`approved`／`suspended` 各狀態）造訪 `/teachers/join`：行為與畫面跟本輪改動前完全一致——這是最重要的回歸測試，證明 Slice 1 的搬移沒有破壞任何既有邏輯。

### Checks

```
npx tsc --noEmit
npm run lint
npm run build
npm run test:smoke
```

## 9. Definition of Done

- 未登入訪客造訪 `/teachers/join` 看不到任何可以送出但送不出去的表單。
- 已登入老師（任何既有狀態）的體驗與本輪之前完全一致。
- 任何「前往登入」連結登入完成後都會回到 `/teachers/join`，不會回到 `/account`。
- 沒有任何內部開發字眼（"Local-only application form"、"Phase 1 TeacherProfile"）出現在使用者畫面。
- `docs/specs/teacher-onboarding-spec.md`、`docs/product/route-map.md` 反映新行為。
- 全套既有 smoke test（含本輪更新過的）與新增測試全數通過。

<!-- codex-peer-reviewed: 2026-09-12T16:24:15Z rounds=2 verdict=approved -->
