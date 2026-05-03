# First Admin Strategy

## 1. 目的

本文件規劃 Free Soar Yoga V1 第一個 Admin 帳號的建立與管理策略。

這一步只做工程與營運策略說明，不實作 seed、不修改 Prisma schema、不建立 admin setup UI、不修改 Auth config，也不建立任何 marketplace flow。

## 2. 目前權限模型

Free Soar Yoga V1 採用 capability-based model，而不是複雜 RBAC。

- `User` 是平台內部帳號。
- 所有登入者預設具備 Member capability。
- Teacher capability 由 `TeacherProfile` 開啟。
- Organizer capability 由 `OrganizerProfile` 開啟。
- Admin 是額外管理權限，目前以 `User.isAdmin` 表示。
- OAuth provider identity 由 Auth.js / Prisma Adapter 的 `Account` model 管理。
- 目前不建立 `Role`、`Permission`、`UserRole`、`RolePermission`。

因此，V1 初期判斷 Admin 的最小方式是檢查目前登入 `User` 的 `isAdmin` 是否為 `true`。

## 3. 第一個 Admin 的建議策略

### 手動 DB update

做法：第一個使用者透過 Google login 建立 `User` 後，由開發者或授權維運者直接在資料庫將該 user 的 `isAdmin` 設為 `true`。

優點：

- 最小、直接，適合 local/dev 與初始化階段。
- 不需要建立公開 setup route。
- 不需要新增 seed script 或額外 UI。

限制：

- 需要直接操作資料庫。
- production 使用前必須有明確的操作人、操作環境與確認流程。
- 不適合作為長期營運管理方式。

### Seed script

做法：建立受控 seed script，依指定 email 將對應 `User.isAdmin` 設為 `true`。

優點：

- 比手動 SQL 更可重複。
- 可降低手動操作錯誤。
- 適合 local/dev 或 preview environment。

限制：

- 需要另外建立 script 與執行規則。
- 如果 production 使用，必須避免把真實 admin email 或 secret 寫進 repo。
- 本階段暫不實作。

### 受控 admin setup flow

做法：建立受保護的 setup flow，由一次性 token、部署環境變數或內部流程建立第一個 Admin。

優點：

- 較適合正式 production onboarding。
- 可加入 audit、token expiry、操作紀錄。

限制：

- 複雜度較高。
- 若設計不當，反而會形成高風險公開入口。
- 不適合目前 V1 初始化階段。

### V1 初始化階段建議

- local/dev 可使用手動 DB update。
- 日後如需要，可補 seed script，但要先經產品主人確認。
- production 不應使用公開 admin setup 頁面。
- production 第一個 Admin 建立方式應在部署前另外確認。
- 本階段不實作任何 admin setup UI。

## 4. Local/dev 建議流程

以下流程只供 local/dev 參考，不代表 production 流程。

1. 使用 Google login 建立第一個 `User`。
2. 確認該 `User` 的 email。
3. 在 local/dev DB 中設定 `isAdmin = true`。
4. 重新登入或刷新 session。
5. 之後再驗證 admin-only route。

local/dev 參考 SQL：

```sql
UPDATE "User"
SET "isAdmin" = true
WHERE "email" = 'your-local-dev-email@example.com';
```

檢查結果：

```sql
SELECT "id", "email", "isAdmin"
FROM "User"
WHERE "email" = 'your-local-dev-email@example.com';
```

注意事項：

- 不要將真實 email、secret 或 production database connection string 寫進文件或 repo。
- 執行前必須確認目前連線的是 local/dev DB。
- 如果無法確認資料庫環境，必須停止，不可執行更新。

## 5. Production 原則

production 第一個 Admin 建立方式尚未定案，必須在部署前由產品主人確認。

production 不建議：

- 開放公開 `/admin/setup` 頁面。
- 使用任何人可猜測或可重複使用的 setup token。
- 將 admin email hard-code 在 repo。
- 將 production secret 放進 `.env.example`、docs 或 commit。

production 可評估：

- 一次性受控 seed，由部署操作者在安全環境執行。
- 受保護的內部 setup procedure。
- 由資料庫管理者或平台維運者手動設定，並留下操作紀錄。

任何 production Admin 建立流程都需要 security review。

## 6. 後續決策點

以下事項需要產品主人確認後才可實作：

- 第一個 production Admin 要採用手動 DB update、seed script，還是受控 setup flow。
- 是否需要 admin assignment audit log。
- 是否允許既有 Admin 授權其他 Admin。
- 是否要從 `User.isAdmin` 升級到更完整的 permission model。
- production 上線前是否需要建立 emergency admin recovery procedure。

在 V1 初期，`User.isAdmin` 足以支援最小 Admin 判斷；不應因第一個 Admin 建立問題提前引入複雜 RBAC。
