# Auth Entry Strategy

## 1. 目的

本文件記錄目前 Auth entry 與 authenticated smoke pages 的工程定位與邊界。

這不是完整 Auth 產品規格，也不是正式 dashboard、會員中心或多 provider 登入設計文件。目標是避免後續 AI 或開發者誤解 `/account`、`/sign-in`、`/dev/auth`、`/dev/admin` 的用途。

## 2. 目前 Auth entry 範圍

目前已存在的相關 routes：

- `/`
- `/dev/auth`
- `/dev/admin`
- `/account`
- `/sign-in`

這些 routes 只支援目前 Auth / session / capability 的最小驗證，不代表完整 marketplace user flow 已完成。

## 3. Route 定位

### `/`

`/` 是 minimal product entry smoke。

- 用來提供目前最小產品入口。
- 目前只提供 `/sign-in` 與 `/account` links。
- 不使用 `auth()`。
- 不做登入狀態判斷。
- 不是正式 landing page。
- 不是正式品牌首頁。
- 不承擔課程探索、老師導覽、完整品牌敘事或正式使用者 flow。

### `/dev/auth`

`/dev/auth` 是 development-only 的 Auth.js、Prisma Adapter、session smoke test。

- production 使用 `notFound()` 隱藏。
- 用來驗證 Google sign-in、sign-out 與 session 顯示。
- 不是正式登入頁。
- 不應被產品導覽或正式使用者流程引用。

### `/dev/admin`

`/dev/admin` 是 development-only 的 `requireAdmin()` smoke test。

- production 使用 `notFound()` 隱藏。
- 用來驗證 server-side admin guard 與 `User.isAdmin` 判斷。
- 不是正式 admin dashboard。
- 不代表 admin review workflow 已完成。

### `/account`

`/account` 是 minimal authenticated account smoke page。

- 用來驗證 `requireUser()`。
- 顯示目前登入 user 的 basic info。
- 顯示最小 capability smoke。
- 不是正式會員中心。
- 不是正式 dashboard。
- 不包含 account editing、enrollment、Teacher onboarding、Organizer onboarding 或 dashboard navigation。

### `/sign-in`

`/sign-in` 是 minimal sign-in entry。

- 提供 Google sign-in。
- 已登入時顯示簡單登入狀態。
- 提供前往 `/account` 的 link。
- 提供 sign out button。
- 不是完整 Auth UI system。
- 不包含 `/sign-up`、多 provider UI、account linking 或完整錯誤處理頁。

## 4. Capability Smoke 邊界

目前 capability smoke 只顯示最小狀態：

- Member：登入者預設 `yes`。
- Admin：依 `User.isAdmin` 顯示 `yes` / `no`。
- Teacher：目前不載入 relation。
- Organizer：目前不載入 relation。

這不是完整 authorization matrix，也不代表 Teacher / Organizer onboarding 或審核流程已完成。

Teacher / Organizer capability 未來應依 `TeacherProfile` / `OrganizerProfile` 與對應狀態判斷，且需要在進入相關 vertical slice 前再次 review。

## 5. Redirect 策略

目前最小 Auth entry 階段採用：

- sign in 後導向 `/account`。
- sign out 後導向 `/sign-in`。

這只是目前階段的最小策略。未來若導入正式 dashboard、onboarding 或 account landing flow，可再調整 redirect 目標。

## 6. 本階段不做的事

目前 Auth entry 階段不做：

- 完整 Auth UI system
- 正式 landing page
- 正式品牌首頁
- shared header / navigation
- `/sign-up`
- 多 provider UI
- account linking
- 完整錯誤處理頁
- 正式會員中心
- 正式 admin dashboard
- Teacher onboarding
- Organizer onboarding
- 課程、活動、預約、金流、email
- RBAC

PRD 可能提到 `/sign-up` 或 dashboard，但目前尚未進入此 Auth entry slice。

OAuth 登入目前可同時建立帳號，因此不急著實作完整 `/sign-up` UI。

## 7. 後續決策點

後續需要產品主人確認：

- 何時將 `/` 轉為正式 landing page / brand home。
- 是否需要正式 `/sign-up`。
- 是否需要正式 dashboard。
- 是否讓 `/account` 轉為正式會員入口。
- 何時載入 `TeacherProfile` / `OrganizerProfile` capability。
- 何時加入 LINE / Facebook 或其他 provider。
- 是否需要 shared header / navigation。

任何影響 Auth provider、account linking、role / permission model、core user flow 的決策，都需要另行 review。
