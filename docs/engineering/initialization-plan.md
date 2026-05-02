# Initialization Plan 技術初始化計畫

## 目的

本文件定義 Free Soar Yoga V1 的技術初始化計畫。

這一步只規劃如何初始化專案，不執行初始化、不安裝套件、不建立功能程式碼。所有實作仍需遵守 `spec → plan → build → test → review → ship` 工作流程。

V1 目標是建立品牌驅動的瑜伽團課 marketplace，不在初始化階段加入 Wellness、Academy、Retreat、advanced AI matching、複雜金流、Native app 或大型 enterprise 架構。

## 1. 建議技術棧

### Core Stack

- Next.js
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Resend
- Playwright
- Vitest
- Vercel

### Next.js 架構建議

建議使用 Next.js App Router。

原因：

- 適合 public landing pages、dashboard routes 與 nested layouts。
- 能清楚區分 public、teacher、organizer、member、admin route groups。
- 支援 Server Components，適合資料讀取與 SEO。
- 保留未來 App-ready API/service boundary。

### Server Actions 或 API Routes

V1 建議採取混合策略：

- Server Actions：用於同站內表單提交，例如 teacher application、organizer demand request、enrollment。
- Route Handlers / API Routes：用於未來可能被外部系統、mobile app、webhook 或 notification service 呼叫的介面。

初始化階段不要過早建立大量 API routes。先建立清楚的 domain / service layer，讓 Server Actions 和未來 API routes 都能共用同一套 business logic。

### Database / ORM

建議使用 Prisma + PostgreSQL。

原因：

- marketplace 資料模型關聯清楚，適合 Prisma schema 管理。
- Prisma migration 適合 V1 到早期成長階段。
- PostgreSQL 適合狀態、關聯、查詢與未來 reporting 延伸。

### Auth Provider 建議

V1 建議使用 Auth.js / NextAuth + Prisma Adapter。

原因：

- 適合 Next.js 與 App Router。
- 可搭配 Prisma 管理 user、account、session 等資料。
- 支援 session、OAuth 與 email 等常見登入方式。
- 避免自行實作登入系統，降低安全風險。
- 能配合本專案的 capability model：`User` 是基本帳號，Teacher / Organizer 能力由 profile 開啟，Admin 是額外管理權限。

Auth 規劃原則：

- `User` 是平台內部使用者，不綁死任何單一登入方式。
- OAuth provider identity 使用 Auth.js / Prisma Adapter 的 `Account` model 管理。
- 未來同一個 `User` 可以連結多個 providers，例如 Google、LINE、Facebook。
- 登入 UX 先預留多 provider 空間，但 V1 初期可以先只啟用一種登入方式，避免初始化階段變複雜。

Provider 規劃：

- Google login 可作為 V1 初期候選，但仍需產品確認後啟用。
- LINE Login 為 future optional，不在初始化階段啟用。
- Facebook Login 為 future optional，不在初始化階段啟用。

Provider 注意事項：

- LINE Login 需要建立 LINE Login channel 與 callback URL。
- LINE 若要取得 email，需要另外申請 email address permission。
- Facebook Login 需要建立 Facebook Developer App 與 callback URL。
- 多 provider login 必須注意 account linking，避免同一個人因不同 provider 產生多個 `User`。

## 2. 專案初始化步驟

以下是未來真正初始化時建議執行的步驟。此文件不執行任何指令。

### Step 0: 初始化前安全檢查

在執行 `create-next-app` 前，必須先確認目前 workspace 狀態。

建議指令：

```powershell
git status --short
git status --branch
```

必須確認：

- `git status` 是乾淨的，或已清楚知道哪些未提交 docs 變更會被保留。
- 目前資料夾已經有 `docs/`，初始化不可覆蓋、刪除或搬移現有 docs。
- 不可用會清空資料夾的方式重新建立專案。
- 若初始化工具提示覆蓋檔案，必須逐一人工確認。

初始化後必須檢查：

```powershell
git diff --name-only
git status --short
```

目的：

- 確認初始化產生與修改了哪些檔案。
- 確認 `docs/` 仍完整存在。
- 確認沒有意外刪除既有文件。

### Step 1: 建立 Next.js 專案

建議指令：

```powershell
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir
```

預期產生：

- `package.json`
- `next.config.*`
- `tsconfig.json`
- `eslint.config.*` 或 `.eslintrc.*`
- `postcss.config.*`
- `tailwind.config.*`
- `src/app/*`
- `src/app/globals.css`
- `public/*`

需要人工確認：

- 是否使用 `src/` directory。
- 是否啟用 App Router。
- Tailwind 是否正確建立。
- 預設首頁是否需要保留或清空。

### Step 2: 安裝 Prisma

建議指令：

```powershell
npm install prisma @prisma/client
npx prisma init
```

預期產生：

- `prisma/schema.prisma`
- `.env`

需要人工確認：

- `.env` 是否已加入 `.gitignore`。
- `DATABASE_URL` 是否指向正確 PostgreSQL。
- Prisma provider 是否為 `postgresql`。

### Step 3: 設定測試工具

建議指令：

```powershell
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D @playwright/test
npx playwright install
```

預期產生或需要新增：

- `vitest.config.*`
- `tests/unit/*`
- `tests/e2e/*`
- `playwright.config.*`

需要人工確認：

- Vitest 是否能跑純 domain/service tests。
- Playwright 是否先只做 smoke tests。
- 測試不要在初始化階段綁太多尚未存在的功能。

### Step 4: 設定基本環境檔範例

建議建立：

- `.env.example`

建議包含：

```text
DATABASE_URL=
RESEND_API_KEY=
APP_BASE_URL=
AUTH_SECRET=
AUTH_URL=

# Optional OAuth providers. Enable only after product approval.
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_LINE_ID=
AUTH_LINE_SECRET=
AUTH_FACEBOOK_ID=
AUTH_FACEBOOK_SECRET=
```

需要人工確認：

- 不可提交真正 secret。
- `.env.example` 只能放 placeholder。
- Google / LINE / Facebook login 都是 optional providers，不是初始化階段必須接上的功能。
- LINE / Facebook provider 先保留環境變數 placeholder，不在初始化階段啟用。

### Step 5: 建立初始資料夾骨架

建議建立空資料夾或 placeholder：

- `src/app`
- `src/components`
- `src/domain`
- `src/services`
- `src/lib`
- `src/server`
- `prisma`
- `tests/unit`
- `tests/e2e`

需要人工確認：

- 不要在資料夾骨架階段放入未審核 business logic。
- 不要建立超出 V1 的 modules，例如 wellness、academy、retreat。

## 3. 建議資料夾結構

建議結構：

```text
src/
  app/
    (public)/
    teacher/
    organizer/
    member/
    admin/
  components/
    ui/
    layout/
    forms/
    marketplace/
  domain/
    permissions/
    state-machines/
    marketplace/
    validation/
  services/
    teacher-service.ts
    organizer-service.ts
    demand-service.ts
    class-session-service.ts
    enrollment-service.ts
    notification-service.ts
  lib/
    prisma.ts
    auth.ts
    env.ts
  server/
    actions/
    queries/
prisma/
  schema.prisma
docs/
tests/
  unit/
  e2e/
```

### app routes

`src/app` 負責 route、layout、page composition。

Page component 不應直接放 marketplace business logic。Page 可以呼叫 server action、query 或 service，但狀態轉換與權限判斷不應寫在 page 裡。

Public routes 與 dashboard routes 應分開規劃。

建議：

- `(public)` 放首頁、about、teacher join、organizer request、class detail / share link。
- `teacher`、`organizer`、`member`、`admin` 放登入後 dashboard routes。
- Dashboard routes 可共用 dashboard layout，例如 sidebar、top nav、account menu。
- 初始化階段不需要建立完整 dashboard UI，只需要保留 route / layout 的清楚邊界。

### components

`src/components` 放 reusable UI。

建議分類：

- `ui`: button、input、dialog、tabs 等通用元件
- `layout`: header、sidebar、dashboard shell
- `forms`: 表單 UI 組件
- `marketplace`: teacher card、demand card、class summary 等 marketplace UI

### domain

`src/domain` 放純 business rules：

- permission rules
- state transition rules
- validation schema
- marketplace invariants

Domain code 應盡量不依賴 Next.js page context。

### services

`src/services` 放 use case / workflow logic。

例如：

- submit teacher application
- publish demand request
- submit demand response
- convert matched demand to class session
- create enrollment
- send notification

Services 可以呼叫 domain rules、data access 與 notification service。

### lib

`src/lib` 放基礎工具：

- Prisma client
- auth/session helper
- env validation
- shared utilities

### prisma

`prisma/schema.prisma` 定義資料模型與 enum。

Prisma schema 必須對齊：

- `docs/domain/data-model.md`
- `docs/domain/state-machines.md`
- `docs/domain/state-transition-details.md`
- `docs/domain/permissions-matrix.md`

### tests

建議初期測試分層：

- `tests/unit`: permission、state machine、service logic
- `tests/e2e`: Playwright smoke tests

V1 早期優先測試 domain 與 permission，不急著做大量 UI snapshot。

## 4. Domain / Service / Data Access 邊界

### 不應放在 page component 的邏輯

以下邏輯不能放在 page component：

- permission checks
- state transition validation
- enrollment capacity check
- duplicate enrollment check
- teacher approval check
- demand visibility check
- class session creation rules
- notification recipient rules
- Prisma mutation business rules

Page component 只負責：

- 組合 layout
- 顯示資料
- 呼叫 action / query
- 呈現 loading、empty、error state

### Permission logic 放哪裡

建議放在：

```text
src/domain/permissions/
```

可以依 resource 拆分：

- `teacher-permissions.ts`
- `demand-permissions.ts`
- `class-session-permissions.ts`
- `enrollment-permissions.ts`
- `admin-permissions.ts`

Permission logic 必須對齊 `docs/domain/permissions-matrix.md`。

### State transition logic 放哪裡

建議放在：

```text
src/domain/state-machines/
```

可以依 model 拆分：

- `teacher-profile-state.ts`
- `demand-request-state.ts`
- `demand-response-state.ts`
- `class-session-state.ts`
- `enrollment-state.ts`

所有狀態變更都應經過 domain rule，不直接在 Server Action 或 page component 裡改 status。

### Notification logic 放哪裡

建議拆成兩層：

```text
src/services/notification-service.ts
src/domain/marketplace/notification-events.ts
```

Domain 定義事件與收件者規則，service 負責建立 `Notification` record 與呼叫 Resend。

V1 只做 basic email notification，不做 LINE deep integration、SMS、複雜 notification center。

### Data access 放哪裡

建議放在：

```text
src/server/queries/
src/services/
src/lib/prisma.ts
```

原則：

- `src/lib/prisma.ts` 只建立 Prisma client。
- Query function 負責讀取資料。
- Service function 負責 use case 與 mutation。
- Domain function 負責規則，不直接知道 HTTP route。

## 5. V1 第一個 Vertical Slice 建議

建議第一個 vertical slice 從 Teacher Onboarding 開始，但再拆成兩個階段。

### 第一階段

```text
Public teacher join page
→ Teacher application form
→ 建立 TeacherProfile draft/submitted
```

第一階段目標是驗證：

- form validation
- Auth / User 基本資料
- `TeacherProfile` 建立
- `draft → submitted` state transition
- basic notification record 或待寄通知事件

### 第二階段

```text
Admin review list
→ Admin approve/reject
→ TeacherProfile submitted → approved/rejected
```

第二階段才處理 Admin review，避免第一個 slice 同時打開太多 admin UI 與 permission surface。

原因：

- Teacher approval 是 marketplace 品質閘門。
- 後續 demand response 必須依賴 approved teacher。
- 可以早期驗證 role/capability model。
- 可以測試 form validation、permission、state transition、Admin route protection、notification。
- 比完整 enrollment flow 更小，但已包含 V1 最重要的架構邊界。

不建議第一個 slice 從完整 class session / enrollment 開始，因為它依賴 teacher、organizer、demand、matching，多個 domain 邊界會同時打開，風險較高。

可替代方案：

- 如果想先驗證品牌與 UI，可先做 public landing page，但它對 permission / state machine 驗證較少。
- 如果想先驗證 marketplace demand，可從 organizer demand request 開始，但 teacher approval 尚未完成時，後續 demand pool 會卡住。

## 6. 初始化風險

### 一旦選錯會影響後面的決策

- Auth provider：會影響 session、Admin permission、profile onboarding。
- Role model：必須使用 capability model，不要回到單一 `User.role`。
- Prisma schema：enum、relations、status 欄位若錯，後面 migration 成本高。
- App Router route structure：public / teacher / organizer / member / admin 邊界要清楚。
- Server Actions 與 API Routes 邊界：不要讓 business logic 綁死在某一種 transport。
- Permission layer：若散落在 page component，未來會很難審查。

### 可以先簡化

- Auth provider 可先選一個適合 V1 的方案，不在初始化階段抽象過度。
- Notification 先只做 email。
- Admin dashboard 先做待審與基本列表，不做 advanced analytics。
- Public `/classes` 列表先 optional / later。
- Attendance 先不做完整 Teacher workflow。
- PaymentIntent 保留 future placeholder，不實作金流。

### 初始化階段不要做

- 不做 Native app。
- 不做 Wellness / Academy / Retreat modules。
- 不做 advanced AI matching。
- 不做 full payment / refund automation。
- 不做 LINE deep integration。
- 不做 microservices、Kubernetes、event sourcing。
- 不做複雜 organization CRM。
- 不做 Teacher SaaS tools。
- 不做大型 design system。

初始化階段的目標是建立穩定、清楚、可演進的 V1 web app 基礎，而不是一次完成所有 marketplace 功能。
