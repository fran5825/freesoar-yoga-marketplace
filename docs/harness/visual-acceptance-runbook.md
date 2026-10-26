# 畫面驗收操作手冊（給 Claude）

產品主人親自看畫面時，用這份準備環境。各輪要看哪些畫面寫在該輪的票券或驗收清單裡（例如 `docs/superpowers/plans/<feature>/tickets/` 的最後一張票）；這份只講「怎麼準備、用什麼帳號、哪裡容易卡」。

來源：2026-10-25 teacher-first-run 畫面驗收的 retro；2026-10-26 wrong-route-fixes retro 補上「開發伺服器出狀況」與「Claude in Chrome 填表」。

## 開始前

1. Docker Desktop 要開著，Postgres 容器 `freesoar-yoga-marketplace-postgres` 才連得到。
2. 開發伺服器請產品主人自己 `npm run dev`（3000 埠）。先用 `netstat -ano | Select-String ":3000 .*LISTENING"` 確認有沒有在跑。
3. 對照驗收清單，先列出每一項需要的**帳號身分**與**測試資料**，缺什麼一次跟產品主人講，不要驗到一半才發現。常見缺的：
   - 學員帳號（老師報名自己的課不會產生給老師的通知）。
   - 管理員帳號（公開需求、審核老師）。
   - 待審的團體需求、期班、草稿系列、「剛通過審核、沒有課」的老師。

## 合併、migration 與開發伺服器

- 合併分支、跑 `prisma migrate deploy`、`prisma generate` 之前，先請產品主人停掉開發伺服器（3000）。開著時 `prisma generate` 會因為檔案被鎖住失敗（`EPERM ... query_engine-windows.dll.node`）。
- 停掉後再用 `netstat` 確認 3000 **真的沒有程序在聽**；有時另一個視窗還開著一個。不是自己開的程序不要關，請產品主人關。
- 重開後很多頁面回 Next.js 預設的「404 This page could not be found」（不是網站自己的 404 頁），而且同一份程式在 worktree 的正式 build 測試是過的：通常是開發伺服器的編譯快取 `.next/dev` 壞了。請產品主人停掉伺服器、確認 3000 沒人在聽，再刪掉 `.next/dev`、重開。刪之前一定先確認伺服器已停，刪到一半還在跑的伺服器會讓請求全部逾時。

## 用哪個瀏覽器

- **用 Claude in Chrome**（`mcp__claude-in-chrome__*`）。內建瀏覽器面板的登入和產品主人的 Chrome 分開，Google 登入要在面板裡重來一次，而且產品主人習慣用自己的 Chrome。
- **一個身分一個 Chrome 設定檔**（同一台電腦上的不同 Chrome 使用者）。三個設定檔都要各自安裝 Claude in Chrome，並在側邊面板用**同一個 Claude 帳號**登入，否則 `list_connected_browsers` 看不到。
- 換身分用 `select_browser` 切換，不用登出登入。`list_connected_browsers` 的 Browser 1／2／3 編號會隨連線順序變，**以 deviceId 為準**，切換後先看頁面上的登入信箱確認身分。
- Google 登入、登出一律請產品主人自己按。
- **勾選與單選用點的**：`form_input` 改核取方塊、選項按鈕時，畫面看起來勾了，網站卻沒收到（React 沒更新）。改用 `find` 找到那個 label，再用 `computer` 的 `left_click` 點它。文字欄、日期、下拉選單用 `form_input` 可以。送出前一定讀「建立前核對」或「還缺 N 項」確認。
- 某個設定檔截圖一直逾時（`Page.captureScreenshot timed out`）時不要重試，改用 `find`、`get_page_text` 確認畫面內容，請產品主人親眼看位置。

## 測試帳號（開發資料庫 `freesoar_yoga_marketplace_dev`）

| 帳號 | 身分 | 注意 |
| --- | --- | --- |
| pattern178 | 已通過的老師，**也是團主** | 多重身分：通知連結的錯誤會在這個帳號出現 |
| tks83u | 學員；2026-10-25 起也有團主資料（「驗收測試團主」） | 可當報名的學員，也可送測試需求 |
| fran.zheng | 管理員（`User.isAdmin = true`） | 公開需求、審核用 |

帳號身分會變；不確定時用唯讀查詢確認，例如：

```
docker exec freesoar-yoga-marketplace-postgres psql -U postgres -d freesoar_yoga_marketplace_dev -c "select email, \"isAdmin\" from \"User\" where \"isAdmin\" = true;"
```

## 建測試資料

- 名稱一律帶「驗收測試」，說明欄寫「請勿當成真實需求回應」，之後好認、好清。
- 表單常會**自動帶入**上一次的值或 Google 姓名、信箱（建課的地點與名額、團主資料）。輸入前先全選清空，送出前看「建立前核對」或讀欄位值確認。
- 聯絡資料用測試值（例如 `acceptance-organizer@example.test`、`0900000000`），不要填產品主人的真實資料。
- 要暫時改產品主人的資料來觸發畫面（例如清空收款帳號看提醒），先記下原值、驗完填回去。原值用 base64 存進 scratchpad，填回後再逐字比對：
  - 存：`psql ... -tAc "select encode(convert_to(\"paymentAccountInfo\",'UTF8'),'base64') from \"TeacherProfile\" where id='<id>';" > <scratchpad>/<名稱>.b64`
  - 填回：`update ... set "paymentAccountInfo" = convert_from(decode('<base64>','base64'),'UTF8')`
  - 產品主人驗收時自己在畫面上填了測試值也一樣要填回原值。
- 按送出後頁面沒變：先看開發伺服器 log（`mcp__terminal__read_terminal`）有沒有那個 POST，再決定重按，避免重複建立。

## 紀錄

- 每驗完一個畫面就把結果寫進該輪的票券（通過、發現、未驗），用 Edit／Write 工具寫 markdown；不要用 PowerShell 字串拼接（會吃掉反引號、段落黏在一起）。
- 發現要分清楚：產品主人提出的、Claude 自己的判斷、範圍外的。
- 驗收完把所有測試資料列在紀錄裡，清理時才找得到。

## 自動化測試另外跑

畫面驗收用的是 3000 的開發伺服器；Playwright 一律用獨立埠（3100 起，先用 `netstat` 確認沒人在聽）和獨立測試資料庫（`DATABASE_URL` 指向測試庫，例如 `freesoar_tfr_int`），見 `docs/backlog.md`「小提醒」。`playwright.config.ts` 會擋：實際的 `DATABASE_URL`（環境變數優先，其次 `.env`）是 `*_dev` 時直接報錯不跑。
