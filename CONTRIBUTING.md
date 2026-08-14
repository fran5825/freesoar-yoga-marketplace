# Contributing

給第二個（或第三個）要一起開發 Free Soar Yoga Marketplace 的人看的。如果你是要請 AI agent 幫忙開發，先看 `README.md` 裡「How to use this repo with AI agents」那節——這份文件是給人類開發者的本機環境設定與協作慣例，兩份互補，不重複。

## 本機開發環境設定

```bash
git clone https://github.com/fran5825/freesoar-yoga-marketplace.git
cd freesoar-yoga-marketplace
npm install
cp .env.example .env   # 填好下面說明的值
npx prisma migrate dev
npm run dev
```

打開 `http://localhost:3000`。

### `.env` 怎麼填

- **`DATABASE_URL`**：每個人跑**自己本機的 Postgres**，不要共用同一個資料庫。這個專案的 smoke test 會在資料庫裡建立/刪除大量測試帳號與資料，共用資料庫會讓大家的測試互相打架、資料互相污染。
- **`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`**：Google OAuth 的 redirect URI 固定是 `http://localhost:3000/api/auth/callback/google`，跟誰在跑無關，所以**可以共用同一組**——跟專案負責人要，透過密碼管理工具（1Password 之類）分享，不要貼在聊天群組或 commit 進 git。
- **`AUTH_SECRET`**：自己隨機產生即可（例如 `openssl rand -base64 32`），不需要跟其他人一致，這只是用來加密自己本機的 session。
- **`RESEND_API_KEY`／`AUTH_LINE_*`／`AUTH_FACEBOOK_*`**：V1 尚未接線，留空即可。

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 本機開發伺服器（hot reload） |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript 型別檢查，不輸出檔案 |
| `npx prisma migrate dev` | 套用/建立 schema migration |
| `npx prisma studio` | 圖形介面直接查看/編輯資料庫（例如把某個帳號設成 Admin：`User.isAdmin` 打勾） |
| `npm run test:smoke` | 跑全套 Playwright smoke test（見下方「smoke test 的一個地雷」） |

## Git 工作流程

現在是**直接 commit 到 `main`**——這是單人開發時期的做法，優點是快，但兩人以上同時改同一個 repo 容易互相覆蓋對方的變更。

多人協作建議改成 **feature branch + PR**：

```bash
git checkout -b your-name/short-description
# 改完
git push -u origin your-name/short-description
gh pr create
```

這個 repo 的 commit message 習慣寫得很詳細（改了什麼、為什麼、怎麼驗證），拿去當 PR description 幾乎不用重寫。想要更嚴謹的 review，可以在 PR 上跑 `/code-review` 或 `ultrareview`（在 Claude Code 裡對這個 PR 執行，細節問 repo 負責人）。

**大 schema 異動之前先說一聲**：兩人都在改 `prisma/schema.prisma` 時，誰先 `npx prisma migrate dev` 誰先產生 migration 檔案；另一人要先 `git pull` 拿到最新的 migration 再繼續，不要各自跑出兩份互相衝突的 migration。也不要手動編輯已經產生的歷史 migration 檔案。

## 這個專案的開發紀律（重要，不是形式）

`AGENTS.md` 與 `docs/harness/` 定義了一套 spec → plan → build → test → review → ship 的流程：Product Owner Decision Gate（有分歧的設計決定要先讓產品負責人拍板，不能自己假設）、一次只做一個 vertical slice、capability-based（不是 RBAC）的權限模型、規劃文件要先過 `codex-peer-review` 才能動工。這套紀律不是官僚形式，是這個 repo 到目前為止能維持品質的原因——**改動之前先讀過 `AGENTS.md`、`docs/context/*`、`docs/scope/*`、`docs/domain/*`、`docs/harness/*`**，尤其是：

- `docs/domain/permissions.md` / `permissions-matrix.md`：權限模型，改動前確認會不會踩到 Security Review Required 清單。
- `docs/domain/state-machines.md` / `data-model.md`：目前哪些狀態轉換已經落地、哪些是刻意保留但未接線——不要在不知情的狀況下把「刻意簡化」的部分當成 bug 修掉。
- `docs/product/route-map.md` / `current-functional-architecture.md`：現況導覽，改動 route 或跨角色流程時要同步更新。

## Smoke test 的一個坑

`playwright.config.ts` 的設定是 `reuseExistingServer: !process.env.CI`——如果本機已經有一個 `npm run start` 在跑（例如背景還留著上一次跑測試時啟動的），Playwright 會直接沿用那個**舊的 production build**，不會自動重新編譯你剛改的程式碼。改完東西要測之前，先確認 port 3000 沒有殘留的舊 process，或直接 `npm run build` 一次再跑 `npm run test:smoke`（`test:smoke` 本身的 `pretest:smoke` hook 會先 build，但如果 server 已經在跑，那個 build 產出也不會被拿去用）。
