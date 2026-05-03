# Prisma Auth Initialization Plan

## 1. 目標

本文件規劃 Free Soar Yoga V1 的 Prisma + Auth 初始化方式。

這一步只做初始化前規劃，不安裝套件、不建立 Prisma schema、不執行 migration、不實作登入流程，也不建立任何 marketplace flow。

V1 仍聚焦在品牌驅動的瑜伽團課 marketplace，不在 Auth / Prisma 初始化階段加入 Wellness、Academy、Retreat、advanced AI matching、複雜金流、Native app 或 enterprise 架構。

## 2. Auth 架構

V1 建議使用：

- Auth.js / NextAuth
- Prisma Adapter
- PostgreSQL

帳號與能力模型：

- `User` 是平台內部帳號。
- 所有登入者預設具備 Member capability。
- Teacher capability 由 `TeacherProfile` 開啟。
- Organizer capability 由 `OrganizerProfile` 開啟。
- Admin 是額外管理權限，例如 `User.isAdmin`。
- OAuth provider identity 由 Auth.js / Prisma Adapter 的 `Account` model 管理。

### 初期登入方式建議

V1 初期建議先只啟用一種登入方式，避免初始化階段過度複雜。

建議選項：

- 優先候選：Google login，方便一般使用者與營運測試。
- 也可選擇先只建立 Auth 架構，不啟用 OAuth provider，待產品主人確認後再開啟。

不建議初始化階段同時啟用 Google、LINE、Facebook 多 providers。

### Future Optional Providers

未來可預留：

- Google
- LINE
- Facebook

LINE / Facebook provider 標示為 future optional，不在初始化階段啟用。

注意事項：

- LINE Login 需要建立 LINE Login channel 與 callback URL。
- LINE 若要取得 email，需要另外申請 email address permission。
- Facebook Login 需要建立 Facebook Developer App 與 callback URL。
- 多 provider login 必須設計 account linking policy，避免同一個人因不同 provider 產生多個 `User`。

### Account Linking 原則

初始化階段先不實作複雜 account linking UI。

規劃原則：

- `User` 是平台內部身份，不等於單一 OAuth provider。
- `Account` 記錄 provider identity。
- 同一 email 嘗試使用不同 provider 登入時，需有明確策略：自動連結、提示登入原 provider、或由 Admin 協助處理。
- 任何自動 account linking 都需要 security review，避免錯誤合併不同使用者。

## 3. Prisma Schema 初始範圍

Prisma schema 應以 V1 必要模型為主，不過度工程化。

### Auth.js / Prisma Adapter 必要模型

初始化階段必要：

- `User`
- `Account`
- `Session`

視登入方式需要：

- `VerificationToken`

如果 V1 初期不啟用 email magic link，`VerificationToken` 可先作為 Auth.js 相容模型保留，或依實際 Auth.js provider 需求建立。

### Free Soar Yoga V1 Domain Models

本階段產品決策採用最小 capability base schema。

初始化階段必要：

- `TeacherProfile`
- `OrganizerProfile`
- `Organization`

後續 marketplace vertical slice 再建立：

- `ServiceType`
- `DemandRequest`
- `DemandResponse`
- `ClassSession`
- `Enrollment`
- `Notification`
- `TeacherAvailability`
- `AvailabilityException`
- `AdminNote`

原因：這些屬於 marketplace flow 或 teacher availability flow，應在對應 spec / vertical slice 進入 build 前再加入 schema，避免初始化階段過度工程化。

### Placeholder / Later

可作為 later，不建議初始化階段實作：

- `PaymentIntent`
- `Review`
- advanced reporting models
- audit log models
- enterprise organization hierarchy
- CRM / sales pipeline models
- Wellness / Academy / Retreat models

`PaymentIntent` 與 `Review` 可在 docs 保留 future 概念，但不應在初始化 schema 中建立，除非產品主人明確批准。

## 4. Enum 規劃

Enum 必須對齊：

- `docs/domain/data-model.md`
- `docs/domain/state-machines.md`
- `docs/domain/state-transition-details.md`
- `docs/domain/permissions-matrix.md`

建議 enum：

### TeacherProfileStatus

- `draft`
- `submitted`
- `approved`
- `rejected`
- `suspended`

### DemandRequestStatus

- `draft`
- `submitted`
- `under_review`
- `published`
- `teacher_responded`
- `matched`
- `converted_to_class`
- `completed`
- `cancelled`
- `expired`
- `rejected`

### DemandResponseStatus

- `submitted`
- `shortlisted`
- `selected`
- `declined`
- `withdrawn`
- `expired`

`expired` 必須包含，因為 state machine 與 consistency review 已定案。

### ClassSessionStatus

- `draft`
- `pending_confirmation`
- `open_for_enrollment`
- `confirmed`
- `completed`
- `cancelled`

### EnrollmentStatus

V1 主要狀態：

- `pending`
- `confirmed`
- `cancelled`

Future / admin-only 後續能力：

- `attended`
- `no_show`

是否在初始 enum 中包含 `attended` / `no_show` 需要產品主人確認。若包含，UI 不一定要實作；若不包含，未來加入會需要 migration。

### OrganizationType

- `company`
- `company_club`
- `community`
- `family_group`
- `other`

### NotificationStatus

- `pending`
- `sent`
- `failed`
- `cancelled`

### NotificationChannel

V1：

- `email`

Future optional：

- `in_app`
- `line`
- `sms`

初始化 schema 可先只放 `email`，或保留 future enum 值但不實作 channel。若保留 future enum 值，文件需明確標示不是 V1 功能。

## 5. Migration 策略

### 初始 schema 範圍

建議初始化時先建立 Auth 必要模型與最小 capability base schema，不要一次建立所有 marketplace flow schema。

可分兩段：

1. Auth base schema：`User`、`Account`、`Session`、必要時 `VerificationToken`。
2. Capability base schema：`TeacherProfile`、`OrganizerProfile`、`Organization`。

Demand / Class / Enrollment / Notification 等 marketplace flow models 留到後續 vertical slice。

### Production Migration

初始化階段先不執行 production migration。

只在 local dev 或 preview database 進行 schema 驗證。Production migration 必須等產品主人確認 schema、權限與 state machine 後再執行。

### Local Dev

Local dev 可使用：

```powershell
npx prisma migrate dev --name init_auth_marketplace
```

或在 schema 尚未穩定時先使用：

```powershell
npx prisma db push
```

但 `db push` 不應作為正式 migration 策略。

### Migration 命名建議

建議命名：

- `init_auth`
- `init_auth_marketplace_core`
- `add_teacher_availability`

避免模糊名稱，例如：

- `update_schema`
- `fix_models`
- `changes`

### Docs First

任何 schema 變更前，必須先更新相關 docs：

- `docs/domain/data-model.md`
- `docs/domain/permissions-matrix.md`
- `docs/domain/state-machines.md`
- `docs/domain/state-transition-details.md`
- 相關 flow spec

## 6. 環境變數

`.env.example` 建議包含：

```text
DATABASE_URL=
AUTH_SECRET=
AUTH_URL=
APP_BASE_URL=
RESEND_API_KEY=

# Optional OAuth providers. Enable only after product approval.
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_LINE_ID=
AUTH_LINE_SECRET=
AUTH_FACEBOOK_ID=
AUTH_FACEBOOK_SECRET=
```

提醒：

- 不可 commit `.env`。
- `.env.example` 只能放 placeholder。
- Optional providers 不代表初始化階段啟用。
- LINE / Facebook provider 必須等 callback URL、provider app/channel、permission 申請確認後再啟用。

## 7. 檔案與資料夾規劃

未來 Prisma / Auth 初始化可能新增或修改：

- `prisma/schema.prisma`
- `src/lib/prisma.ts`
- `src/lib/auth.ts`
- `src/auth.ts`，如 Auth.js 設定需要
- `src/app/api/auth/[...nextauth]/route.ts`，如 Auth.js route handler 需要
- `.env.example`
- `package.json`
- `package-lock.json`

可能新增 dependencies：

- `prisma`
- `@prisma/client`
- `next-auth`
- `@auth/prisma-adapter`

此文件只規劃，不建立上述檔案，不安裝上述套件。

## 8. 風險與決策點

需要產品主人確認：

- 初期啟用 email login、Google login，還是先只建立 Auth 架構。
- Admin 第一個帳號如何建立：seed、手動資料庫更新、或受控 admin setup flow。
- 初始化 schema 要一次建立完整 domain schema，還是先建立 Auth + `TeacherProfile`。
- LINE / Facebook 何時啟用。
- 是否需要 account linking policy，以及採用自動連結或人工確認。
- `EnrollmentStatus` 初始 enum 是否包含 `attended` / `no_show`。
- `NotificationChannel` 是否只放 `email`，或先保留 future enum 值。

高風險點：

- 錯誤的 role model 會影響所有 dashboard、permission、enrollment。
- 錯誤的 Auth schema 會影響 provider linking 與 User identity。
- 過早啟用多 providers 會增加 account linking 風險。
- schema 未對齊 state machine 會造成 service layer 實作混亂。

## 9. 建議下一步

最小安全行動：

1. 產品主人確認初期登入方式。
2. 安裝 Prisma + Auth.js dependencies。
3. 建立 `prisma/schema.prisma` draft。
4. 建立 Prisma client helper 與 Auth config draft。
5. 先不 migrate production。
6. 跑 lint / typecheck。
7. 做 schema self review，確認對齊 docs。

下一步仍不應做：

- teacher onboarding UI
- admin dashboard
- demand request flow
- payment
- LINE / Facebook provider 啟用
- production migration
