# site-design-review：交接給 Codex（2026-10-26）

給接手的 Codex：這份是 backlog 第 30 項「全站逐頁設計檢視」的起手交接，第一頁做 backlog 第 28 項的老師申請表單。由 Claude 寫，產品主人 Franz 決定交給你做（2026-10-26 更新：Codex 已裝好專案 skills）。先讀這份，再讀 `AGENTS.md`、`docs/backlog.md` 第 28、30 項，最後跑 `git log --oneline -5` 與 `git status` 確認現況。以 git 紀錄與 repo 文件為準，這份只負責導讀。

## 與產品主人合作的方式

`AGENTS.md` 的規則全部照舊。另外補上這幾點（這些在 Claude 那邊是使用者層級設定，Codex 看不到，所以寫在這裡）：

- Franz 沒有寫程式背景，但想邊做邊學。用繁體中文；技術名詞保留英文，第一次出現附一句白話解釋，格式「英文（中文，一句解釋）」；比喻用台灣日常場景（超商、捷運、銀行櫃檯）。
- 每個動作講「做了什麼、為什麼」；小步前進。不用空泛詞（「已優化」「更穩健」「顯著提升」），講具體改了什麼、對使用者差在哪。
- 要他決定時最多兩個選項，各一行 trade-off，並給建議。每個提議標明來源：是 `/impeccable` 或文件的指示，還是你自己的判斷；兩者相反時要明說。
- 只有他明確說了才 commit／push。push 前一刻重列 `git log origin/main..main`：常有多個工作階段（Claude、Codex）同時 commit 到 main，清單跟上次問他時不一樣就再問一次。
- 刪資料、刪資料庫、改 schema、關掉別人的程序、動 repo 以外的東西之前，先用白話講風險、等他同意。不能替他輸入 Google 密碼。

## 這項工作是什麼

- **backlog 第 30 項**：首頁風格已經定下來，規格在 `DESIGN.md`、`PRODUCT.md` 與 `.impeccable/`（目前只有首頁的 surface brief：`.impeccable/surfaces/src-app-page-tsx.md`）。其他頁面都還沒對照首頁調整過。產品主人希望逐頁重新檢視：簡潔、usability、清楚、與首頁風格一致、去 AI 味（`AGENTS.md`「UI 要避免的預設樣式」）。
- **第一頁：老師申請表單**（`/teachers/join` 已登入時的畫面，主要在 `src/app/teachers/join/_components/TeacherApplicationForm.tsx`，約 1400 行，欄位定義在 `src/app/teachers/join/_lib/application-fields.ts`）。產品主人在 2026-10-26 畫面驗收時提的 5 點，都在 backlog 第 28 項：
  - F7-1：各欄下方的橘色提示框，提示文字和功能做法不一致，要統一邏輯。
  - F7-2：點到任何文字欄按 Tab，就把 placeholder 範例或「參考寫法」放進欄位，方便老師改寫（新互動）。
  - F7-3：「擅長類型」加填寫範例。
  - F7-4：「可服務區域」預設勾選新竹縣、新竹市。
  - F7-5：「其他資料（可之後補）」寫清楚之後去哪裡補、不填會少什麼。已查證的事實：審核通過後在「老師資料 → 個人資料」（`/teacher/profile/info`）補；送審前存草稿也能補；這些欄位不擋送審。
  - 注意共用：`application-fields.ts` 也被未登入的介紹頁 `TeacherJoinExplainer.tsx`（資料預覽）用到，改欄位提示要一起檢查訪客畫面。
  - 截圖情境與原話在 `docs/superpowers/plans/wrong-route-fixes/tickets/05-acceptance-and-docs.md` 的「發現」表。

## 需要產品主人決定的（grill 階段要問，不要自己選）

- **F7-2**：Tab 帶入範例是新互動，會跟鍵盤無障礙衝突（Tab 本來是跳到下一欄）。要給選項（例如另放「套用範例」按鈕），說明 trade-off。
- **F7-4**：預設勾選新竹縣市會套用到所有新老師；外縣市老師要多一步取消。要問。
- **改版深度**：照 `/impeccable` 的分法是 refinement（保留現在的樣子只修細節）還是 redesign（換一套）。首頁已定風格，表單通常是 refinement，但要問。
- **逐頁順序**：第一頁之後要做哪些頁。建議先列清單和優先順序給他挑，不要一次做全站。

## 怎麼走流程

產品主人已在 Codex 裝好專案 skills（2026-10-26，說明在 `docs/engineering/codex-skills-setup.md`）：用 `$feature-loop site-design-review` 走閉環，設計用 `$impeccable`。入口在 `.agents/skills/`，產品方法仍讀 `.claude/skills/`；Claude 專用工具（Skill tool、內建 `/code-review`、Stop hook 的 peer review、subagent）怎麼替換，一律照 `.agents/skills/feature-loop/references/codex-runtime.md`，這份不重寫。

本項的具體約定：

- 階段照 feature-loop：grill（想清楚）→ spec → 切票 → 實作與審查 → 收尾 → 畫面驗收 → retro，每個 🛑 關卡停下來問產品主人。
- spec 放 `docs/specs/site-design-review-spec.md`；票與進度檔放 `docs/superpowers/plans/site-design-review/`（`tickets/`、`loop-status.md`）。
- 風險分級照 `docs/harness/risk-based-workflow.md`。預期是 UI 為主（STANDARD）；若 F7-4 之類的決定要動資料或預設值邏輯，再升級。
- 設計：`$impeccable` 對 `src/app/teachers/join/_components/TeacherApplicationForm.tsx` 跑（context 傳 `--target`）。首頁的 surface brief 是風格基準。Codex 目前沒有自動 detector hook（`.codex/hooks.json` 不存在），UI 修改後要照 runtime 規則手動跑一次 detector。
- 審查（bug 與 spec 兩種）照 runtime 規則；審查材料要包含還沒 commit 的改動與新增檔，不能只看 `<base>...HEAD`。
- **🛑 Claude 設計審查（產品主人指定，每一頁都要做）**：每一頁的設計改完、你自己的 `$impeccable` finish review 與上面兩種審查都處理完之後，進收尾關卡（問 commit）**之前**，停下來交給 Claude 審設計。做法：
  1. 在 `docs/superpowers/plans/site-design-review/claude-design-review/<頁面 slug>.md` 寫一份審查請求，內容：這頁的範圍與產品主人在 grill 的決定、改了哪些檔、worktree 路徑與 branch、截圖路徑（電腦版與手機版，改前與改後）、`$impeccable` 的 direction 與 finish review 結果、自己判斷還沒把握的地方。截圖存在 worktree 外或 `.ai-runs/` 這類不進 git 的位置，請求檔寫完整路徑。
  2. 跟產品主人說：「設計做好了，請把這份請求交給 Claude 審」，附上檔案路徑。Claude 會讀 worktree 裡還沒 commit 的改動與截圖，用 Claude 的 `/impeccable critique` 審，把結果寫回同一份檔案的「Claude 審查結果」一節。
  3. 等產品主人說 Claude 審完，再讀結果：要修的照實作與審查流程修；屬於產品決定的列出來問產品主人。修完不用再請 Claude 審，除非產品主人要求。
  4. 在 `loop-status.md` 記錄這一關（日期、請求檔路徑、Claude 的結論、怎麼處理）。產品主人說這一頁不用 Claude 審，照他的原話記下來再往下走。
- final report 照 `AGENTS.md` 的 Completion Report，包含 `Recommended Next Step`。

## 環境與驗證

- **先確認 skills 與本 handoff 已進 git**：`.agents/`、`docs/engineering/codex-skills-setup.md`、`docs/superpowers/plans/2026-10-26-codex-skills-setup-plan.md` 與本 handoff 在交接時（2026-10-26）還是 untracked。從 main 開的 worktree 看不到 untracked 檔，所以開 worktree 之前先看 `git status`；還沒 commit 就請產品主人決定要不要先 commit（只 commit 這些檔），不要自己 commit。grill 只讀檔、不改程式，可以先在主資料夾做。
- **不要在 main 工作區直接改**：用自己的 git worktree 與 branch（例如 `C:\Users\franz\fsy-sdr`、branch `site-design-review`）。main 工作區常有其他工作階段沒 commit 的檔案（例如 `docs/domain/state-machines.md`、一批 `docs/superpowers/plans/2026-07-*` 檔），不要碰、不要 commit。
- worktree 需要自己的 `node_modules`（`npm ci`）與 `.env`。`.env` 的 `DATABASE_URL` 指向測試資料庫，不要指向開發資料庫 `freesoar_yoga_marketplace_dev`：可以用 Docker 容器 `freesoar-yoga-marketplace-postgres` 裡的 `freesoar_tfr_int`，或從它複製一份（`CREATE DATABASE <名稱> TEMPLATE freesoar_tfr_int;`）。建測試資料庫要先跟產品主人講；用完要刪也要先問。
- 驗證：`npx tsc --noEmit`、`npm run lint`、`npm run build`，加上相關 smoke（例如 `tests/smoke/teacher-join.spec.ts`、`signed-in-navigation.spec.ts`）。Playwright 一律用獨立埠：先用 `netstat` 確認沒人在聽，PowerShell 寫法 `$env:PORT = '3330'`（不是 Bash 的 `PORT=3330 command`）。`playwright.config.ts` 會擋：實際的 `DATABASE_URL` 是 `*_dev` 時直接報錯不跑。
- 已知 smoke 失敗：backlog 第 27 項已標 `test.fixme` 的那些不是新問題。
- GitHub Actions CI 只跑 tsc＋lint。

## 畫面驗收

**先讓新版跑在 3000**：畫面驗收用產品主人的開發伺服器（3000 埠，主資料夾 main，開發資料庫），所以 worktree 的改動要先進 main 才看得到。照 feature-loop 第 5 步，收尾關卡問產品主人「要不要 commit 並合併進 main（不 push）」；他同意後才合併，並照手冊「合併、migration 與開發伺服器」那節請他先停、再重開開發伺服器。重開後先確認：`git log -1` 是剛合併的 commit、3000 埠的程序是主資料夾的 Next.js、要用的帳號在開發資料庫裡身分正確（手冊有唯讀查詢範例）。他不同意合併，就不做畫面驗收，在進度檔寫明原因。

照 `docs/harness/visual-acceptance-runbook.md` 準備帳號與資料，但手冊寫的「Claude in Chrome」是 Claude 專用：Codex 這邊請產品主人在自己的 Chrome 親自看 3000 埠的開發伺服器（他自己 `npm run dev`），一個畫面回報一次；你負責準備測試資料、列驗收清單、記錄結果。看申請表單需要一個**已登入、沒有老師資料**的帳號（目前 tks83u 符合）。手冊裡「合併、migration 與開發伺服器」那節（開發伺服器快取壞掉時怎麼辦）一樣適用。

## 不在這一輪

- backlog 第 29 項（通知未讀小紅點、團主需求表單欄位重複）、第 31 項（通知 target 自動防呆）。
- 首頁本身不改。
- 不新增套件；要裝新的 npm 套件屬於 HEAVY，要先問。

## 給 Codex 的起手 prompt（產品主人可以直接貼）

```text
任務：backlog 第 30 項「全站逐頁設計檢視」，第一頁做 backlog 第 28 項的老師申請表單（/teachers/join 已登入畫面）。
$feature-loop site-design-review
背景：先讀 docs/superpowers/plans/site-design-review/handoff-to-codex.md，裡面有合作方式、流程、環境與要我決定的事項。
限制：每個 🛑 關卡停下來問我；這一輪先做 grill：列出要我決定的問題（含你的建議），不要改任何檔案。不要 commit、不要 push。
```


<!-- codex-peer-reviewed: 2026-10-26T05:07:03Z rounds=4 verdict=approved -->
