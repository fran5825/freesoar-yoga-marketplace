# Session Capability Helper Strategy

## 1. 目的

本文件規劃 Free Soar Yoga marketplace 未來的 session / capability helper 設計方向。

目標是建立一致的登入狀態與 capability 判斷策略，避免每個 route、server action、service 或 component 各自查 session、各自判斷權限，造成安全邊界不一致。

本文件只做策略規劃，不實作任何程式碼、不新增資料表、不修改 Prisma schema、不修改 Auth.js 設定，也不建立 marketplace flow。

## 2. 核心原則

Free Soar Yoga V1 採用 capability-based model，不引入複雜 RBAC。

- `User` 是平台內部帳號。
- Member 是所有登入者的預設 capability。
- Teacher capability 由 `TeacherProfile` 是否存在，以及未來狀態是否允許決定。
- Organizer capability 由 `OrganizerProfile` 是否存在，以及未來狀態是否允許決定。
- Admin 由 `User.isAdmin === true` 決定。
- 不建立 `Role`、`Permission`、`UserRole`、`RolePermission`。
- helper 應保持薄層、可讀、可測試，不把完整 marketplace business rules 全塞進 helper。
- 本階段不設計完整 marketplace authorization matrix；細節仍以 `docs/domain/permissions.md` 與 `docs/domain/permissions-matrix.md` 為準。

helper 的責任是回答「目前使用者是誰、具備哪些基礎 capability、是否可進入某類區域」。  
更細的 business rule，例如 demand visibility、class capacity、enrollment duplicate check，應留在 domain / service layer。

## 3. 建議 Helper 分層

以下為概念性命名，僅供未來實作時參考。

### Session Helper

Session helper 負責取得目前登入狀態與平台內部 `User`。

概念性 helper：

- `getCurrentSession`
- `getCurrentUser`
- `requireUser`

建議責任：

- 使用既有 Auth.js / NextAuth v5 的 `auth()` 取得 session。
- 必要時從資料庫讀取對應 `User` 與 capability 所需 relation。
- `requireUser` 可在未登入時回傳 redirect、throw controlled error，或由呼叫端決定處理方式。

### Capability Helper

Capability helper 負責把 `User`、`TeacherProfile`、`OrganizerProfile` 與 `isAdmin` 轉成一致的 capability 判斷。

概念性 helper：

- `getUserCapabilities`
- `hasCapability`
- `requireAdmin`
- `requireTeacher`
- `requireOrganizer`

建議 capability：

- `member`
- `teacher`
- `organizer`
- `admin`

未來如果需要區分 teacher 狀態，可再加入更精準的判斷，例如：

- `teacherApproved`
- `teacherSuspended`

但 V1 初期不應為此建立完整 RBAC。

### Route / Service Usage Pattern

未來使用方式應保持一致：

- route handler / server action 先使用 session helper 取得目前 user。
- capability helper 負責粗粒度區域 guard，例如 admin、teacher、organizer。
- domain / service layer 負責細粒度 marketplace rule，例如資料是否屬於本人、狀態是否允許轉換、是否超過 capacity。
- UI component 可以使用 capability 結果顯示或隱藏入口，但不可把 UI 判斷當作安全依據。

## 4. Capability 判斷來源

### Member

來源：authenticated `User`。

只要使用者已登入，就具備 Member capability。  
不需要 `MemberProfile`，也不需要 `User.role = member`。

### Teacher

來源：`TeacherProfile`。

初期可先以 `TeacherProfile` 是否存在作為 teacher area 的基礎判斷。  
未來進入 marketplace flow 時，能否回應 demand request 應再檢查 `TeacherProfile.status`，例如必須是 `approved`，且不可是 `suspended`。

### Organizer

來源：`OrganizerProfile`。

初期可先以 `OrganizerProfile` 是否存在作為 organizer area 的基礎判斷。  
未來若 OrganizerProfile 增加狀態欄位，再由 helper 或 service 補上狀態判斷。

### Admin

來源：`User.isAdmin === true`。

第一個 Admin 如何建立，由 `docs/engineering/first-admin-strategy.md` 規劃。  
helper 只負責在程式中一致判斷 admin capability，不負責建立第一個 Admin。

## 5. 使用場景範例

以下為 pseudo code，僅說明未來方向，不代表本階段要新增實際程式碼。

### Server Action 中要求登入

```ts
const user = await requireUser();
```

用途：

- 建立需要登入的表單提交。
- 讀取自己的 account 或 enrollment。
- 避免每個 server action 自己處理 session 空值。

### Admin-only Dev / Internal Route

```ts
const user = await requireUser();
await requireAdmin(user);
```

用途：

- 未來 admin dashboard。
- 內部審核頁。
- dev-only 或 internal-only 工具頁。

Admin route 不應只靠前端隱藏按鈕保護，必須在 server-side 檢查。

### Teacher Area Guard

```ts
const user = await requireUser();
await requireTeacher(user);
```

用途：

- teacher dashboard。
- teacher profile 編輯。
- teacher availability 管理。

是否允許回應 demand request，未來應再由 service layer 檢查 teacher 是否 `approved` 與 demand 是否 eligible。

### Organizer Area Guard

```ts
const user = await requireUser();
await requireOrganizer(user);
```

用途：

- organizer dashboard。
- organization / organizer profile。
- own demand request 管理。

是否能查看或修改某一筆 demand，應由 service layer 檢查 ownership 與狀態。

### UI 顯示用 Capability 判斷

```ts
const capabilities = await getUserCapabilities(user);
```

用途：

- 顯示 dashboard entry。
- 顯示 admin link。
- 顯示 teacher / organizer onboarding 狀態。

注意：UI 判斷只是體驗優化，不是安全邊界。所有敏感資料與狀態變更都必須在 server-side 再檢查。

## 6. 本階段不做的事情

本階段只新增策略文件，不做以下事項：

- 不新增資料表。
- 不修改 Prisma schema。
- 不修改 Auth.js / NextAuth 設定。
- 不新增 middleware。
- 不實作 helper code。
- 不建立 RBAC。
- 不建立 `Role`、`Permission`、`UserRole`、`RolePermission`。
- 不設計完整 marketplace flow authorization。
- 不建立 teacher onboarding、organizer dashboard、demand、class、enrollment flow。
- 不處理 LINE / Facebook provider。
- 不處理 Resend notification permission。
- 不處理 payment 權限。

## 7. 與 First Admin Strategy 的關係

`docs/engineering/first-admin-strategy.md` 解決的是「第一個 Admin 如何被建立」。

本文件解決的是「Admin 建立後，程式如何一致判斷目前使用者是否具備 admin 與其他 capability」。

兩者邊界如下：

- First Admin Strategy：建立策略、local/dev 參考流程、production 安全原則。
- Session Capability Helper Strategy：session 取得、current user 取得、capability 判斷、route / service 使用模式。

helper 不應負責授權某人成為 Admin。  
Admin assignment 本身是高風險操作，未來若要實作，必須先更新 docs 並做 security review。

## 8. 風險與注意事項

- 若每個 route 自行查 session，容易造成登入判斷不一致。
- 若每個 service 自行判斷 admin / teacher / organizer，容易造成權限漏洞。
- 若過早導入 RBAC，會讓 V1 初始化變重，也可能偏離目前 capability-based model。
- 若把 marketplace business rules 放進 capability helper，helper 會變得難以測試與維護。
- 若只在 UI 隱藏入口，沒有 server-side guard，會造成安全風險。

## 9. 建議下一步

未來進入第一個需要 protected route 或 server action 的 vertical slice 前，再實作最小 helper。

建議順序：

1. 先建立 session helper：`getCurrentUser`、`requireUser`。
2. 再建立 capability helper：`getUserCapabilities`、`requireAdmin`。
3. 第一個 admin-only route 出現前，先寫 `requireAdmin` 的最小測試。
4. Teacher / Organizer helper 等對應 dashboard 或 onboarding 進入 build 階段再補。
5. 每次新增 capability 或 permission rule，都要同步檢查 `docs/domain/permissions.md` 與 `docs/domain/permissions-matrix.md`。

在進入 marketplace flow 前，不需要一次實作完整 authorization framework。
