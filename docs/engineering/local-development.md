# Local Development

## 目的

本文件說明 Free Soar Yoga Marketplace 的本機開發環境設定。

目前只建立本機 PostgreSQL dev database 設定，不執行 Prisma migration，不建立 marketplace flow。

## PostgreSQL Dev Database

本機開發資料庫使用 Docker Compose 啟動 PostgreSQL。

設定：

- service name: `postgres`
- image: `postgres:16`
- database: `freesoar_yoga_marketplace_dev`
- user: `postgres`
- password: `postgres`
- port: `5432:5432`

啟動指令：

```powershell
docker compose up -d postgres
```

停止指令：

```powershell
docker compose down
```

如需連同本機資料 volume 一起移除，需另外明確執行：

```powershell
docker compose down -v
```

請注意：移除 volume 會刪除本機 dev database 資料。

## Environment Variables

`.env` 不可 commit。

`.env.example` 只放 placeholder，不放真實 secret。

本機 `.env` 的 `DATABASE_URL` 必須指向 local/dev database，不可指向 production database。

本機 dev 範例：

```text
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/freesoar_yoga_marketplace_dev?schema=public"
```

Auth 相關值也應只放在本機 `.env`：

```text
AUTH_SECRET=
AUTH_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

LINE / Facebook provider 目前只是 future optional，不在初始化階段啟用。

## Migration Safety

執行 Prisma migration 前必須確認：

- `.env` 存在。
- `.env` 有 `DATABASE_URL`。
- `DATABASE_URL` 指向 local/dev PostgreSQL。
- 目前不是 production database。

若無法確認，必須停止，不可執行 migration。

本階段尚未執行 migration。
