# Impeccable 視覺改版 — Handoff

> 狀態：待接手。建立日期：2026-10-18。
> 接手對象：另一個 Claude Code 帳號（在同一個 repo 工作）。
> 任務等級：STANDARD（只動畫面與樣式，不動 Auth、Prisma schema、權限、狀態機）。若途中發現必須動到上述任何一項，立刻停下來問產品主人。

## 0. 接手前先讀

1. `AGENTS.md`：產品範圍、品牌憲法、UI 避免清單、品質關卡、回報格式。
2. `docs/context/brand-rules.md`、`docs/context/visual-direction.md`、`docs/context/voice-and-tone.md`、`docs/context/founder-intent.md`：品牌依據。
3. `src/app/globals.css`：既有品牌色票（`cream` #f7f4ee、`sand`、`sage`、`ink`、`pine`、`clay` 系列）。
4. `docs/harness/brand-review-checklist.md`、`docs/harness/rwd-checklist.md`。
5. `docs/superpowers/plans/2026-08-02-brand-visual-design-system-plan.md`：之前的品牌視覺計畫，目前「部分完成」，已有色票，沒有引入 shadcn/ui。
6. 跑 `git status` 和 `git log --oneline -10`。**工作樹裡已經有別的工作階段留下、還沒 commit 的 docs 改動**（`docs/domain/*`、`docs/superpowers/plans/*` 多份、`docs/engineering/hosting-comparison.md`、`docs/visual-acceptance-checklist.md`）。那些不屬於這個任務，不要修改、還原或一起 commit。

## 1. 產品主人的合作方式（換帳號不一定會自動帶過來）

產品主人 Franz 沒有寫程式背景，但想邊做邊學技術詞彙。如果新帳號沒有讀到 `C:\Users\franz\.claude\CLAUDE.md`，請照下面做：

- 用繁體中文回覆。技術名詞保留英文，第一次出現時附一句白話解釋，格式是「英文原詞（中文說法，一句白話解釋）」。
- 每個動作講兩件事：做了什麼、為什麼。小步前進，做一步回報一步。
- 不要用「已優化」「更穩健」「顯著提升」這類空話，要講具體改了什麼、看起來差在哪。
- 每次回覆結尾寫三件事：我做了什麼、有沒有成功、你接下來要做的一件具體的事。
- **產品主人明確說了才可以 commit 或 push**，而且每次授權只算那一次。push 前一刻要重新列 `git log origin/main..main`，因為可能有其他工作階段同時在 commit。
- 目前只有本機環境，還沒有正式上線。

## 2. 目標

用 impeccable（https://github.com/pbakaus/impeccable ，一套教 AI 做出更好前端設計的 skill）調整飛索網站的視覺：拿掉「AI 生成網站」的常見套路，讓畫面更貼近品牌要的溫柔、清楚、寬敞、可信任、女性化、現代靈性。

**不是**整站重做，也**不是**換掉既有品牌色。做法是先教 impeccable 認識飛索，再診斷，最後一頁一頁小範圍修改。

## 3. 範圍

### 第一輪先做（公開頁）

- `/`（`src/app/page.tsx`）
- `/about`、`/faq`
- `/classes`、`/classes/[classSessionId]`、`/classes/series/…`（系列頁）、`/classes/terms/[recurringClassSeriesId]`（期班頁，`/classes` 的期班卡片會連過來，和其他課程頁共用 `EnrollRow`、`EnrollReveal`、`ClassInfoSections` 等元件）
- `/teachers/join`、`/teachers/[teacherProfileId]`
- `/organizers/request`
- 共用元件 `src/app/_components/`（例如 `public-header.tsx`、`public-header-menu.tsx`、`public-footer.tsx`），只限公開頁會用到的

**同一個網址有兩種畫面：** 這些頁面會依登入狀態換外框（`src/app/_components/site-shell.tsx` 登入後改用 `TeacherShell`／`LastRoleShell`／`MemberShell`），`/teachers/join` 登入後甚至會直接換成申請表單。所以每頁都要分「訪客」和「登入後」兩種狀態診斷、驗收。改到共用元件時，登入後的畫面也算受影響範圍，即使專區頁本身這輪不改。

### 這一輪不做

- 登入後的各角色專區（`/member`、`/teacher`、`/organizer`、`/admin`）。等公開頁完成並驗收後，再由產品主人決定要不要做第二輪。
- 任何 Server Action、表單送出邏輯、資料讀取、權限、資料庫。
- 新功能、新頁面、`overdrive`（炫技特效）類的改動。
- 正式 logo 美術。

## 4. 不能破的品牌規則（impeccable 的建議和這裡衝突時，以這裡為準）

- 保留 `globals.css` 的色票。奶油色背景和圓角膠囊按鈕（`rounded-full`）是既有品牌設計，不要因為 impeccable 覺得「常見」就拿掉。
- `AGENTS.md` 的 UI 避免清單：標題裡不要用斜體強調某幾個字、不要用 01／02／03 編號當區塊標籤、不要用等寬字體（monospace）做小標籤。
- 語氣要溫柔、有留白。`bolder`、`overdrive` 和這個方向相反，不要用。可以用的是 `quieter`、`distill`、`layout`、`typeset`、`clarify`、`adapt`、`harden`、`polish`。
- **字體是產品主人要決定的事。** 目前用 `Geist`，後備字體是 Arial（見 `src/app/layout.tsx`），也沒有指定中文字體。impeccable 很可能會標記這點。請整理 2 個候選方案（例如加入一套中文字體），各寫一行 trade-off（取捨，選了得到什麼、失去什麼），交給產品主人選，**不要自己直接換**。
- 新增或改掉任何顏色 token、改變全站字體、改變導覽結構，都算品牌決策，要先問。

## 5. 任務清單（完成一項勾一項，途中發現的新事項補在最下面）

### 階段 A：安裝（動手前先徵得產品主人同意）

- [x] A1. 跟產品主人說明安裝會帶來什麼：會從 npm 下載 `impeccable` 套件、在 repo 新增 `.claude/` 底下的 skill 檔，並在 `.claude/settings.json` 加一個 hook（每次改 UI 檔案都會自動跑偵測規則）。拿到同意才繼續。
- [x] A2. 安裝前先備份 `.claude/settings.json` 的內容。現在裡面有一個 `Stop` hook（`python .claude/hooks/codex-review-gate.py`，Codex 審查關卡），**安裝後一定要還在**。
- [x] A3. 在 repo 根目錄跑 `npx impeccable install`，選 `claude`。
- [x] A4. 用 `git diff .claude/settings.json` 確認 Codex 的 Stop hook 還在，再用 `git status` 列出新增的檔案，回報給產品主人看。
- [x] A5. 關掉匿名使用數據回傳：`npx impeccable telemetry off`。
- [x] A6. 把 `.impeccable/` 底下的暫存檔加進 `.gitignore`；`config.json` 和 `critique/*.md` 照 impeccable 的建議保留追蹤。
- [x] A7. 請產品主人重新載入 Claude Code，讓 `/impeccable` 指令生效。

### 階段 B：教 impeccable 認識飛索

- [x] B1. 跑 `/impeccable init`，產生 `PRODUCT.md`。回答問題時的內容來源是 `AGENTS.md` 的品牌憲法（自由、覺醒、成長、身心整合、自主人生、共創社群）和第 0 節列的 `docs/context/*`。受眾是團主、瑜伽老師、學員。
- [x] B2. 跑 `/impeccable document`，從現有程式碼產生 `DESIGN.md`。檢查裡面的色票和 `globals.css` 一致，並把第 4 節的品牌規則補進去。
- [x] B3. 把 `PRODUCT.md`、`DESIGN.md` 給產品主人看過、修正。**這兩份會決定後面所有建議的方向，沒確認前不進階段 C。**

### 階段 C：只診斷，不改程式

- [x] C1. 先跑 `npm run dev` 開本機站（或用 `.claude/launch.json` 的 `dev` 設定）。
- [x] C2. `npx impeccable detect src/`：用固定規則掃一遍，不需要 AI。
- [x] C3. 第 3 節的每個公開頁都跑一次 `/impeccable critique <頁面>` 和 `/impeccable audit <頁面>`。訪客和登入後兩種狀態都要看。寬度照 `docs/harness/rwd-checklist.md`（360／390／768／1024／1440px），375px 另外加看一次。
- [x] C4. 整理成一份診斷報告 `docs/review/2026-10-xx-impeccable-diagnosis.md`（日期填實際日期）。每頁列出問題，每個問題標三件事：
  - 嚴重度：高／中／低
  - 建議用哪個 impeccable 指令修
  - 是否牽涉品牌決策（是的話要列 2 個選項＋你的建議）
  - 這個問題出現在訪客畫面、登入後畫面，還是兩者都有
  - 和品牌規則衝突、決定不採納的建議也列出來，寫清楚為什麼不採納。
- [x] C4b. 修改前先跑一次基準測試：`npm run build` 後跑 `PORT=3100 npx playwright test`，把每個失敗記在診斷報告裡，包含 project、測試名稱、失敗在哪一個 assertion（斷言，測試裡「應該要看到什麼」的那一行）或步驟，以及錯誤訊息中有用的那一行。之後 E2 用這份紀錄分辨「本來就壞」和「這次改壞」，不要靠記憶或舊文件判斷。
- [x] C5. **停下來**，請產品主人看報告、勾選要修哪些。確認單上每個項目要寫明會影響哪些頁面、訪客或登入後哪種狀態。產品主人偏好一次看完、一次放行，所以請把所有決策集中成一張確認單，不要一個一個問。

### 階段 D：照確認單修改（一頁一頁來）

- [x] D1. 每頁依序處理，順序建議：`/` → `/classes` → `/classes/[classSessionId]` → `/classes/series/…` → `/classes/terms/…` → `/teachers/join` → `/organizers/request` → `/teachers/[teacherProfileId]` → `/about` → `/faq`。
- [x] D2. 每頁改完，先跑 `/impeccable polish <頁面>`（只能做確認單上核准的修改範圍），然後：
  - 用瀏覽器截訪客和登入後兩種狀態的畫面，寬度照 C3，給產品主人看改前改後。
  - 改到共用元件時，其他用到它的頁面也要重截一次。
  - 確認沒有橫向捲動，按鈕和連結至少 44px 高。
  - 跑 `npx tsc --noEmit` 和 `npm run lint`。
- [x] D3. 想要比較幾種版本時，可以用 `/impeccable live` 在本機瀏覽器裡產生變體，讓產品主人挑。
- [x] D4. 修改只限 JSX 結構裡的排版、class 名稱、文案、共用顯示元件。不要動資料讀取、表單 action、`src/lib` 底下的 service／domain 層。

#### D 階段細項（依 2026-10-18 C5 確認單，代號對應診斷報告）

- [x] D0. 全站基礎：`globals.css` 新增 `sky-mist`／`sky-ink`／`gold` 系列、`ink-faint` 改成 #686e66、全站 `clay`→`gold` 並移除 `clay`（Q1、Q4）；`body` 字體堆疊加入中文字體（Q2）；移除範本 dark mode 區塊（G10）；成功／錯誤提示改用品牌色（Q5）；同步更新 DESIGN.md 的遷移狀態。
- [x] D0b. 共用元件：header／footer 觸控目標與 focus（G1、G2、G6）。
- [x] D-1 `/`：主按鈕改成老師（Q6，主標改寫稿先給產品主人挑）、加「怎麼運作」晨空藍區塊（Q7）、中文小標（Q3）、品牌圖形斷行（H4）、寫死色碼（G4）。
- [x] D-2 `/classes`：手機篩選收合（C1）、提示字與觸控目標（C2、C3）。
- [x] D-3 課程詳情／系列／期班：底部報名按鈕、返回連結、標籤統一（D1–D3）。
- [x] D-4 `/teachers/join`：重寫首屏（Q8，改寫稿先給產品主人挑）、J2–J5、英文小標（Q3）。
- [x] D-5 `/organizers/request`：O1–O4。
- [x] D-6 `/teachers/[id]`：P1、P2。
- [x] D-7 `/about`：A1、A2、Q3、G4。
- [x] D-8 `/faq`：F1、Q3、G4。

### 階段 E：收尾

- [x] E1. polish 已經放在每頁的 D2 裡面做，這裡不再重跑。如果收尾時又改了任何畫面，受影響的頁面要重新做一次 D2 的檢查。
- [x] E2. 先跑 `npm run build`，再跑 Playwright：`PORT=3100 npx playwright test`。**一定要用 3100 埠**，直接跑會連到產品主人自己的開發伺服器，造成假失敗。如果有別的工作階段也在用 3100，就改用 3200。跟 C4b 的基準紀錄逐項比對：只有測試名稱、失敗的 assertion 和錯誤原因都跟基準一樣，才算既有問題，其他失敗都算這次造成的，要修好。如果一支測試在基準時就壞在前面，後面的檢查（例如導覽連結、橫向捲動）根本沒跑到，而這些檢查剛好跟本輪修改有關，就要另外用瀏覽器實際驗證，或在 final report 明列「未驗證」。
- [x] E3. 如果改了文案，Playwright 測試裡比對文字的地方也要同步更新。
- [x] E4. 跑 `codex-peer-review` 或請 Codex 做一次獨立 review（Codex 沒額度時，標記「待補審」，不要卡住）。
- [x] E5. 照 `AGENTS.md` 的 Required Self Review 和 Completion Report 格式寫 final report，包含 `Recommended Next Step`。
- [ ] E6. 等產品主人說要 commit 才 commit。commit 只包含這個任務的檔案，用 `git add <具體路徑>`，不要用 `git add -A`。

## 6. 停下來問產品主人的時機

- 安裝 impeccable 之前（A1）。
- `PRODUCT.md`／`DESIGN.md` 完成時（B3）。
- 診斷報告完成時（C5）。
- 任何字體、色票、導覽結構、全站共用元件外觀的改動。
- 發現非改不可的部分牽涉 Auth、schema、權限、狀態機、V1 範圍。
- commit、push 前。

## 7. 已知風險

- **自動 hook 會比較吵**：安裝後每次改 UI 都會跑偵測。多個工作階段同時工作時，可能會看到不屬於自己改動的提醒。
- **偵測通過不代表好看**：impeccable 官方也說，規則全部通過不等於視覺或無障礙沒問題，一定要實際看畫面。
- **impeccable 預設的審美和飛索不同**：它反對「常見」做法，但飛索有些常見做法（奶油色、膠囊按鈕）是刻意的品牌選擇。每個建議都要先對照第 4 節。
- **OneDrive 同步**：repo 放在 OneDrive 資料夾裡，大量新增檔案時，偶爾會遇到檔案被鎖住。遇到時等一下再試，或請產品主人暫停 OneDrive 同步。

## 8. 途中新增事項

（接手者在這裡補充）

- 2026-10-18（A3／A4）：impeccable 4.6.0 用 `npx impeccable install --providers=claude --project -y` 安裝。hook 實際寫進的是 `.claude/settings.local.json`（gitignored，只在這台電腦生效），不是 `.claude/settings.json`；`settings.json` 沒有變動，Codex Stop hook 完整保留。新增的 hook 有三個：SessionStart、PostToolUse（Edit|Write）、Stop（design deep pass），會和 Codex Stop hook 一起執行。換電腦或換 clone 的話，要重跑 install 才會有 hook。
- 2026-10-18（A3）：安裝內容比 A1 說明的多兩樣：`.claude/agents/impeccable-*.md`（4 個 subagent 設定檔），以及 `.claude/skills/impeccable/scripts/bin/windows-x64/impeccable.exe`（偵測 engine v0.1.15）。整個 `.claude/skills/impeccable` 約 21MB，共新增 62 個檔案。commit 時要不要把 `.exe` 也收進 git，需要請產品主人決定。
- 2026-10-18（A5）：telemetry 關閉的設定存在使用者層級的 `C:/Users/franz/.impeccable/config.json`，不在 repo 裡。
- 2026-10-18（A6）：`.gitignore` 新增了 `config.local.json`、`live/`、`review/`、`mocks/`、`build/`；`config.json`、`design.json`、`critique/` 保留追蹤。
- 2026-10-18（B1）：產品主人的訪談回答：這一輪公開頁**優先打動老師**（先招募老師）；**目前沒有任何真實素材**（沒有老師照、現場照、心得引言，不可捏造）；課程先從**新竹縣市、竹北**的公司、社區或教室開始。三項都已寫進 `PRODUCT.md`。
- 2026-10-18（B1→B2 待處理）：`docs/context/visual-direction.md` 建議的色系（天空藍、白、金、淡紫粉、深灰）和 `globals.css` 實際使用的色票（cream、sand、sage、ink、pine、clay）不一致。B2 寫 DESIGN.md 時要列出差異，請產品主人決定以哪一邊為準，或是否更新 `visual-direction.md`。
- 2026-10-18（B2 決定）：產品主人決定**色票走「A 演進」、頁面底色維持奶油色**：保留 cream／sand／sage／ink／pine；新增晨空藍（`sky-mist` #e4ecef、`sky-ink` #2c4552）與晨光金（`gold` #7d5a2a、`gold-deep` #5e4320、`gold-tint` #f4ecdc、`gold-glow` #c8a35a，最後一個只當裝飾）；`clay` 系列標為退場中，階段 D 換成 `gold`。創意北極星是「展翅前的靜 The Stillness Before Flight」，元件手感是「柔軟而篤定」。新色碼都經過 WCAG 對比度檢查。**這是品牌色票變更，第 2 節原本寫「不是換掉既有品牌色」，現在範圍已經改成「演進既有色票」**，階段 D 改 `globals.css` 前仍要放進 C5 確認單。
- 2026-10-18（B2 待決）：`docs/context/visual-direction.md` 的建議色（藍、白、金、紫粉、深灰）還沒同步成 A 演進的結果，B3 請產品主人決定要不要更新。中文字體的兩個方案已寫在 `DESIGN.md` Typography 段落，同樣等產品主人決定。
- 2026-10-18（B2→C 診斷素材）：抽取樣式時發現的現有問題，C4 要列入診斷：(1) `globals.css` 殘留 Next.js 範本的 dark mode 區塊，深色模式時 body 底色會變黑（2026-10-18 實測：公開頁外框有自己的奶油色底，目前看不出差異，屬於隱患）；(2) `ink-faint` 放在奶油底上的對比度只有 3.90（未達 4.5），全站用了 16 次，首頁寫死的 `#6d7d70` 也只有 3.97；(3) 公開頁有 10 種寫死色碼，分散在首頁、`/about`、`/faq`、footer、老師申請表單。
- 2026-10-18（C 階段）：C1 用產品主人已經開著的 3000 埠 `next dev`（沒有另外啟動，也沒有關掉）。critique 沒有用兩個子助手，改在同一個對話裡執行，報告標示 DEGRADED。登入後狀態用 2 個本機測試帳號（`impeccable-diag-*@example.test`）檢查，診斷完已刪除；瀏覽器 cookie 也已清除。完整的 Playwright 共 1564 個測試，序列執行大約要 3–4 小時。
- 2026-10-18（D 階段）：
  - **文案定稿**：首頁主標「讓好的瑜伽老師，被需要的團體找到」、老師加入頁主標「把你的教學，帶給真正需要的團體」；地區說法統一為「大新竹生活圈」（PRODUCT.md 已同步）。
  - **新元件**：`StickyEnrollBar` 取代課程詳情頁與期班頁手機底部的底線連結。卡片裡的報名區還在畫面上時，底部按鈕會藏起來。
  - **全站 clay→gold**：共 71 個檔案，包含登入後專區，因為 Q1 核准全站替換。
  - **沒有實際跑 `/impeccable polish` 流程**：只做確認單核准的修改，每頁用瀏覽器量測與截圖驗收。
  - **後續項目，未放行所以沒改**：`/classes` 篩選卡片內的「更多篩選」框（卡片套卡片）、老師加入頁「申請前可以先準備這些」色帶沒有左右內距、`/about` metadata 描述仍有「marketplace」。
  - **craft-floor 衝突**：impeccable 的 craft-floor 禁止標題上方小標，但產品主人 Q3 選擇「改成中文小標」，依「產品主人的方向優先」保留中文小標。
- 2026-10-18（B1）：init 的 live mode 設定（`.impeccable/live/config.json`）這次先不做，等 D3 真的要用 `/impeccable live` 時再設定。這個環境沒有圖片生成工具，所以採 code-first，`buildPath` 沒有寫進 config。

## 9. 進度紀錄

（接手者每完成一個階段，在這裡寫一行：日期、完成了什麼、下一步）

- 2026-10-18：A1–A6 完成（產品主人已同意安裝），尚未 commit。下一步是 A7：產品主人重新載入 Claude Code，接著進入 B1 `/impeccable init`。
- 2026-10-18：A7、B1 完成，`PRODUCT.md` 已建立在 repo 根目錄，尚未 commit。下一步：產品主人看過 PRODUCT.md 後，進入 B2 `/impeccable document`。
- 2026-10-18：B2 完成，`DESIGN.md`（repo 根目錄）與 `.impeccable/design.json` 已建立；現有 11 個色票和 `globals.css` 逐項比對一致，另外 6 個新色只在 DESIGN.md。尚未 commit。下一步是 B3：產品主人看過 DESIGN.md，並決定 visual-direction.md 要不要同步、中文字體走哪個方案。
- 2026-10-18：B3 完成（visual-direction.md 同步成 A 演進，中文字體定案為方案一）。C1–C4 完成，診斷報告是 `docs/review/2026-10-18-impeccable-diagnosis.md`（critique 26/40、audit 12/20），內含 C5 確認單：Q1–Q8 需要產品主人決定，另有一批非品牌修正建議一次放行。C4b 基準測試在背景執行中。下一步：產品主人勾選確認單；C4b 跑完並補進報告後，才能進入階段 D。
- 2026-10-18：C5 產品主人放行（Q1–Q8 全採推薦，第二部分一次放行）。C4b 完成：1527 通過、23 失敗、14 跳過，逐項記在診斷報告。下一步：從 D0 全站基礎開始改。
- 2026-10-18：階段 D、E1–E5 完成。D3 是選用步驟，這次沒有用 `/impeccable live`，兩處主標改寫稿改由產品主人在對話中挑選。E2 和基準比對後，沒有本輪造成的失敗（詳見診斷報告「E2 測試比對與 E4 獨立審查」）。E4 Codex 第二輪 APPROVED。尚未 commit。下一步：E6，等產品主人決定是否 commit，以及 `impeccable.exe` 要不要收進 git。
- 2026-10-18：E6 完成，commit `62143a4`（不含 `impeccable.exe`，`scripts/bin/` 與 `.impeccable/hook.cache.json` 已加入 `.gitignore`），沒有 push。
- 2026-10-18～19：第二輪「首頁重新提案」（`/impeccable` new-work，comp-first，`.impeccable/config.json` 的 `buildPath: comp`；效果圖由 `codex exec` 內建生圖產生，存在 gitignored 的 `.impeccable/mocks/decision/`，每張都有 prompt sidecar 並已 embed-prompt）。產品主人限定：主角是老師、保留主標「讓好的瑜伽老師，被需要的團體找到」、不要健身房／神祕靈性／科技 SaaS／美容 SPA 感。經過 4 輪擲骰（seed:2e9c7c7e4354adb9），產品主人都沒有選定新世界，最後改走方案 A：不再擲骰，以「畫面直接看得到一群人一起練瑜伽」為前提。**最後 6 張候選**：`kept/canon.png`（業界標準原版照片）、`canon-v1.png`（照片＋綠色文字區）、`a-canon-illustrated.png`（插畫版業界標準）、`canon-v1-illustrated-warm.png`（插畫＋綠色文字區，溫潤版）、`a-papercut-group-young.png`（剪紙團課，20–50 多歲版）、`kept/challenger-papercut.png`（剪紙原版）。照片類 AI 人物圖目前標示「示意圖」，插畫風不需標示。產品主人正在透過私人 Artifact 收集隊友意見，**尚未選定**。下一步：產品主人選定一張後，執行 `build-phase start --decision-comp <該圖>`，再生兩張不同構圖讓他三選一，然後才進入實作。這一輪沒有改任何程式。
- 2026-10-19：產品主人選定方向「剪紙團課（年輕與中年版）」，`build-phase start` 已執行（comps 關卡開啟，構圖 1＝`.impeccable/mocks/decision/a-papercut-group-young.png`，構圖 2、3＝`.impeccable/mocks/comp-2.png`、`comp-3.png`）。產品主人在構圖階段**改變首頁按鈕方向**：主按鈕改為「發起團課」、次按鈕「找一堂課」（旁邊加一行「也有老師開的每週固定課」，讓個人散客知道找得到常態課），老師入口降為按鈕下方一行小字「你是瑜伽老師？了解如何加入 →」。另外要求構圖 4（構圖 1 的人物稍微多一點個別差異）與兩張新構圖（構圖 5「兩扇門」、構圖 6「三個角色同框」）。**待辦**：(1) 這個改動推翻了 C5 Q6「主按鈕給老師」的決定與 PRODUCT.md「這一輪優先打動老師」，最後構圖定案後要同步更新 PRODUCT.md 與診斷報告；(2) 主標「讓好的瑜伽老師，被需要的團體找到」是對老師說話，和新的團主／學員按鈕不一致，生圖時先保留，等產品主人看圖後決定要不要換（要準備 2 個候選）。
- 2026-10-20：產品主人定案**構圖 4**，主標改成「找到對的瑜伽老師，讓一群人一起練習」（候選一），按鈕改成「我要發起團課」（主）與「我要找一堂課」（次），首頁主軸定為**團課**、老師是次要入口；PRODUCT.md Users 段已同步更新。依這些文字生成 `.impeccable/mocks/comp-4b.png`（只改字），sidecar 標 `approved: true`，`build-phase advance` 已把 comps 關卡關閉，現在在 spec（量測）關卡。尚未寫任何首頁程式。
- 2026-10-20（續）：產品主人再改兩處：拿掉次按鈕裡的「也有老師開的每週固定課」，以及品牌字改成構圖 2 的粗字重、貼近畫面左邊（刻意差異，已寫進 build-phase note 與 surface brief）。**核准構圖改為 `.impeccable/mocks/comp-4e.png`**（4b、4d 已標 superseded）。產品主人另外決定：主標字體只為主標做子集字體檔（Noto Sans TC 800，font-match 已量測選定），內文維持系統字；新配色**先只用在首頁**。spec 關卡已通過（18 個區塊、4 張 plate、9 段文字已量測），目前在 plates（素材）關卡，由 Codex 依參考裁切重新生成 4 張 plate。surface brief：`.impeccable/surfaces/src-app-page-tsx.md`。尚未寫任何首頁程式。
- 2026-10-20（續二）：plates 關卡通過（第二輪素材檢查四張全部核准；step-2 依構圖放大，step-3 重新生成，拿掉不屬於任何人的手）。第二個刻意差異：次按鈕箭頭和主按鈕一樣貼右（產品主人選做法 1）。**hero 關卡已寫程式**：`src/app/page.tsx`（首屏＋步驟區）、`public-header.tsx` 加 `variant="home"`、`globals.css` 加 `home-*` 色票與 `font-home-display`、`layout.tsx` 載入 Noto Sans TC 800（`preload: false`，依 unicode-range 只下載用到的字）、plate 複製到 `public/home/`（大插圖壓成 437KB 調色盤 PNG 並重新 embed-prompt）。兩支首頁 smoke 測試已改新文案，`npm run build` 後在 3200 埠 28 個全過；tsc、eslint 通過。**hero 關檢查停在 72%（門檻 72%，仍判 FAIL）**：扣分來自無障礙下限（按鈕 44px、引言 15px 變三行）把下方步驟區推出首屏，以及兩個刻意差異；以 430px 手機寬截圖比對（`.impeccable/review/hero-repro.png`）。產品主人選擇縮小：引言 14px、按鈕 40px（低於 PRODUCT.md 44px 下限，產品主人明確決定）。總分升到 74%，但逐區比對仍判 FAIL：引言在 430px 寬仍是三行（構圖第二行 28 字需約 12.5px），步驟區與主按鈕位置偏下。28 個首頁測試、tsc、eslint 通過。之後產品主人再把引言縮到 12.5px（變兩行），並收緊步驟區與頂部列（首頁選單按鈕 40px）：總分 75%，逐區比對仍 FAIL，步驟區整塊仍比構圖低約 25px（按鈕 40px 仍高於構圖的約 36／32px）。28 個測試、tsc、eslint 通過。再把按鈕縮到 36px：總分 76%，逐區比對仍 FAIL，步驟區仍比構圖低約 23px（老師小字連結保留 44px 點擊範圍、頂部列 40px）。產品主人要求「一直調到一模一樣」並指出四處差異（小標留白、老師連結大小／留白／顏色、引言粗體與顏色、步驟標題下方留白）。依構圖逐區量測修正：引言與老師連結改用構圖取色的 `home-indigo`（#141d63）、引言 semibold 並在「清楚，」後換行、老師連結 11px 不再保留 44px 點擊高度、選單圖示依量測縮小左移、步驟標題 19px、步驟標籤 12.8px 粗體、第二張步驟插圖照構圖墨跡尺寸裁切。**hero 關 PASS 80%，已 advance 到 sections 關**。剩下差異主要是系統字（微軟正黑體）與構圖生圖字型的筆畫不同。28 個測試、build、tsc、eslint 通過。尚未 commit。
- 2026-10-20（續三）：產品主人再指出五處差異（主標、引言偏小；按鈕偏高；老師連結要粗體與構圖色；步驟區標題太貼插圖、插圖大小不齊、標籤上方留白）＋次按鈕顏色。逐區量測後修正：主標 33.3px、引言 12.7px（與構圖 686×171／834×76 幾乎一致）、主按鈕 37px、次按鈕 32px（靛藍字與邊框、暖白底）、按鈕字改 Noto Sans TC 800、老師連結 12px 粗體、步驟區固定 430px 寬（插圖不隨畫面放大）、三張插圖底部對齊、第三張照構圖右側留邊。**hero 關 PASS 83%（match）**。之後依產品主人再調：小標綠改構圖取色 #07662f、首頁文字深藍 `home-ink` 改 #061b45、`home-indigo` 改 #0b1459、品牌字後半段改 Noto 800 14px＋點放大、引言 13px。注意：埠 3000 的 dev server 沒吃到 CSS 變數更新，比對改用 `.claude/launch.json` 新增的 `prod-3200`（`npm run start` 3200 埠）。

<!-- codex-peer-reviewed: 2026-10-18T06:53:13Z rounds=3 verdict=approved -->
