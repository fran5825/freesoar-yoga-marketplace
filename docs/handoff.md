# 交接摘要（2026-09-19）

給接手的 Claude：先讀這份，再讀 `AGENTS.md`、`docs/backlog.md`，最後跑 `git log --oneline -10` 看最近的改動。以 git 紀錄為準，這份只是導讀。

## 使用者與合作方式

- 使用者（Franz）沒有寫程式背景，希望邊做邊學技術詞彙。用繁體中文回覆，技術名詞保留英文並附一句白話解釋；每個動作講「做了什麼、為什麼」；小步前進，做一步回報一步。
- 這些偏好在使用者電腦的 `C:\Users\franz\.claude\CLAUDE.md`（全域設定），同一台電腦會自動生效。
- 每次回覆結尾：做了什麼、有沒有成功、使用者接下來要做的一件具體的事。
- **只有使用者明確說了才 commit / push**，而且授權只算那一次。
- 有風險的動作（刪資料、動正式環境、關掉程序）先停下來說明風險。我曾嘗試關閉舊的開發伺服器被系統拒絕（存取被拒），這類情況請使用者自己在終端機處理。

## 目前狀態

- 分支 `main`，已推上 GitHub（`fran5825/freesoar-yoga-marketplace`）。
- 這一輪完成的事：
  - 首頁改版：標題「連結好老師與你的瑜伽團課平台」，三個平等的入口卡片（團主／學員／老師），拿掉舊的「溫柔，不等於模糊」區塊。
  - Header：兩行品牌署名（Free Soar Yoga／飛索・瑜伽團課共創平台）＋新導覽（發起團課、搜尋課程、老師合作、關於飛索）＋登入與我的帳戶按鈕。
  - 統一品牌色：定義在 `src/app/globals.css` 的 `@theme`（`ink`、`pine`、`clay`、`cream`、`sand`、`sage` 等），公開頁與約 37 個登入後頁面都已改用；黃色警示、綠色成功、紅色錯誤刻意保留。
  - `/sign-in` 改成中文與品牌風格（仍只有 Google 登入）。
  - 老師後台標題改為「老師總覽」，並修好該頁的舊測試。

## 已定案的決策（別重新討論）

- 首頁採「團主／學員／老師三方平等」，不採 copy deck 的「老師優先」版面。主 CTA 是「我想發起團課 →」，次要是「找一堂適合我的課」。
- 視覺沿用網站既有的品牌色、字體、圓形色塊；不採用規劃資料夾裡的版面與視覺。圓形色塊的字級、尺寸不要動，只換文案。
- 手機號碼＋密碼登入**不做**；LINE／Facebook 登入排在品牌質感之後（見 backlog）。
- 「關於首頁露頭」：首頁第一屏下方露出一截深綠色區塊就好，不強求小標可見。

## 文案來源與規則

規劃文件在專案**外面**：`C:\Users\franz\OneDrive\Documents\free-soar-yoga-planning-reference\2026-09-16\`（5 個檔案：messaging-house、site-copy-rules、homepage-copy-deck、teacher-class-hub-direction、teacher-review-standard）。換電腦要一起複製。

使用方式（使用者指定）：
- 品牌定位、Messaging House、用語原則、老師課程管理方向與審核制度：保留並遵守。
- homepage-copy-deck.md：只參考文案內容，而且「真的需要才用」，不為了塞文案而放。
- 不沿用其中的版面、字體、配色、視覺；視覺從目前 git 上的網站基準開始。

必守的用語規則（摘自 site-copy-rules）：
- 品牌署名固定兩行：「Free Soar Yoga」／「飛索・瑜伽團課共創平台」。
- 中文統一用「瑜伽」，不用「瑜珈」。首頁 Hero 不用 `marketplace`。
- 不可說「Free Soar 認證老師」「保證安全」「最優質老師」。審核只能用現階段句子：「老師申請資料會由平台確認，通過後才可回應需求或建立公開課程。」
- 不提前承諾未完成的功能（Email 提醒、出席請假、收款等），不虛構案例與數字。
- teacher-review-standard 是「尚未實作的產品政策」，不構成工程授權；改資料庫、權限、狀態機前要先取得使用者確認。

## 怎麼跑與驗證

- 開發：`npm run dev`（專案設定在 `.claude/launch.json`）。Next.js 一個專案只能開一個開發伺服器。改了 `globals.css` 後如果畫面沒有顏色，是舊伺服器沒重編譯：重開，並在瀏覽器 Ctrl+Shift+R。
- 型別與規範：`npx tsc --noEmit`、`npm run lint`。
- 測試：`npm run test:smoke`（會先 build）。**用開發模式跑 `teacher-join` 會因為頁面還沒載入完就被點擊而失敗**，請用正式建置：`npx next build`，再 `PORT=3200 npx playwright test ...`。
- 完整測試目前有一大批失敗，原因是測試把開課日期寫死成 `2026-09-01`（已過期），與畫面無關，記在 backlog 1b。修完之前，判斷改動是否安全請跑「會碰到頁面的那幾組」：public-brand-pages、public-trust-pages、teacher-dashboard、teacher-join、account-dashboard-navigation、member-dashboard、organizer-dashboard（最近一次 76 個全過）。
- 登入需要 Google 帳號，助手不代替使用者登入；看登入後頁面的畫面要請使用者自己看並截圖。

## 下一步

見 `docs/backlog.md`。優先順序：
1. 請使用者抽看幾個登入後頁面（團主後台、學員課程頁、管理員頁）確認品牌色沒有怪的地方。
2. 修舊測試的日期（backlog 1b）。
3. 隱私權政策與服務條款頁面 → Google Cloud Console 品牌頁 → LINE／Facebook 登入。
