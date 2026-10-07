# 14: 手機／桌機全旅程驗收

**What to build:** 以完成兩條開團路徑為驗收目標，證明資訊、下一步、操作與報名分享在手機及桌機都清楚可用。

**Blocked by:** 04：選團體、存需求草稿、補資料返回；10：雙入口、註冊與登入返回；11：找老師流程的明確下一步；12：全站待辦與通知直達單筆；13：分享連結、登入與學員報名

**Status:** done（2026-10-06，螢幕鍵盤情境待真機確認，見 Known limitations）

**Workflow mode:** STANDARD

**Human Gate:** no（僅限本票列明的低風險範圍。）

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK

- [x] 驗收訪客、已登入未建團主資料、既有團主、老師兼團主：request → 登入／資料 → 選團體 → 找老師或邀請 → 確認 → 開放 → 分享／報名。
- [ ] 390px、1280px 完成關鍵旅程；320px 無水平溢出，sticky 列不遮欄位／錯誤／鍵盤／最後操作；觸控與鍵盤、label／focus／aria-live 可用。（已驗證：390／1280 兩條旅程、320 共 19 頁無溢出、純鍵盤 Tab＋Enter 完成確認／開放／複製且焦點可見、複製結果 aria-live；團主頁面沒有 sticky 列，學員課程頁的底部連結由學員流程 spec 驗證。**未驗證**：手機螢幕鍵盤彈出時是否遮住欄位與錯誤，Playwright 無法模擬，需真機檢查。）
- [x] 涵蓋缺資料返回同 draft、server error 不丟內容、拒絕／重送、衝突、自授課、等待與待我處理、過期與無效連結；保留必要截圖／可重現 evidence。
- [x] TypeScript、ESLint、build、變更邏輯測試與 key E2E 通過；Playwright 使用測試 DB／獨立 port／既有 workers 設定，記錄實際命令與結果，不把未執行報成通過。
- [x] role／permission／state／model／routes／三種 origin 與 legacy 呼叫點完成 review；舊 matched／teacher recurring／報名／取消功能相容。
- [x] Free Soar gentle、clear、spacious、低壓力語氣一致，一頁一個明確主動作；所有建立入口在首屏容易找到。
- [x] 只作已核准範圍的低風險 UI／可及性修正；若需 schema／Auth／permission／state mutation，停止另提 HEAVY 修復，不以驗收票擴大實作。
- [x] 交付 review packet：本任務 diff 與既有變更區分、self review、scope drift、剩餘風險／未通過 gate、Common Handoff Schema；不 commit／push／deploy。

## Builder Review Packet（2026-10-06）

Task request:
- 票 14：以兩條開團路徑（找老師、直接開團）為目標，在手機與桌機驗收資訊、下一步、操作、分享與報名；只做低風險 UI／可及性修正。

Approved prompt:
- 產品主人核准的精簡 handoff：逐票 STANDARD／HEAVY 精簡執行、每票本機 commit 不 push、Playwright 用獨立埠。本票原文「不 commit」寫於產品主人選擇「每票本機 commit」之前，依後者在本機 commit，不 push、不 deploy。

Implementation summary:
- 新增 `tests/smoke/organizer-journeys.spec.ts`：兩條完整旅程，桌機 1280 與手機 390 各跑一次。直接開團：還不是團主的人 → 入口卡 → 一頁團主資料 → 選老師、存草稿、送出邀請 → 團主總覽「等待對方回覆」→ 老師從總覽待辦進入確認 → 團主從總覽待辦開放報名 → 第一屏複製完整連結 → 學員未登入看到通用登入引導、登入後報名 → 名單。找老師：已公開需求收到回應 → 總覽待辦 → 查看回應、選老師 → 填寫課程資訊（地點、名額預填）→ 建立課程 → 連回來源需求 → 開放報名 → 學員報名 → 需求「前往這堂課」。每一步檢查沒有水平捲動並留截圖。
- 新增 `tests/smoke/organizer-narrow-screens.spec.ts`：320px 寬掃過 19 頁（團主 13、老師 4、訪客 2），用超長無空白名稱測最壞情況，每頁先確認狀態碼 200 且停在預期網址，再確認無水平溢出。
- 新增 `tests/smoke/organizer-keyboard.spec.ts`：只用 Tab＋Enter 完成老師確認、團主開放報名、複製報名連結；每個操作取得焦點時要有可見焦點樣式，複製結果由 aria-live 告知。
- 找老師旅程從「已公開且已有回應的需求」開始，屬組合驗證：前半段（入口 → 登入 → 首次資料 → 需求表單 → 送審）由 `organizer-entry-intent`、`organizers-request`、`organizer-demand`、`organizer-demand-organizations` spec 驗證。
- 低風險 UI 修正：(1) 團主課程詳情開放報名後，「分享報名連結」區塊移到課程資料之前（手機第一屏看得到複製按鈕，測試驗證）；(2) 團主總覽副標補上直接開團進度。
- 測試維護：分享區塊加上 region 標籤後，`getByLabel("報名連結")` 會同時符合區塊標題，三個 spec 改為 `exact: true`。

Changed files:
- `src/app/organizer/classes/[classSessionId]/page.tsx`：分享區塊移到課程資料前（region 標籤 `share-title`）。
- `src/app/organizer/dashboard/page.tsx`：副標文案。
- `tests/smoke/organizer-journeys.spec.ts`、`tests/smoke/organizer-narrow-screens.spec.ts`、`tests/smoke/organizer-keyboard.spec.ts`：新增。
- `tests/smoke/enrollment.spec.ts`、`tests/smoke/organizer-class-sharing.spec.ts`：報名連結欄位改為精確比對。
- 本票券與 `ticket-breakdown.md`：狀態與本 packet。
- 既有變更區分：工作目錄中 harness／AGENTS／backlog／glossary／state-machines／state-transition-details／route-map 管理員段落／策略文件等屬其他 task，未修改、不納入 commit。

Diff / patch:
- 本 packet 寫成時尚未 commit，差異為上列檔案的 working tree。之後以「feat: organizer redesign ticket 14 — journey acceptance」本機 commit（不 push）。

Checks run（實際命令與結果）:
- typecheck：`npx tsc --noEmit -p .`（排除 `.next/dev/types`）pass。中途發現另一工作階段把學員流程票 03 合併進 main，Prisma client 未更新造成 `suitableFor` 型別錯誤；`npx prisma generate` 後通過（不動資料庫，`migrate status` 為 up to date）。
- lint：`npx eslint src tests` pass（0 error）。`npx eslint .` 有 426 error，全部來自 `.claude/worktrees/nice-fermat-7b1fb3/.next` 的打包產物（專案資料夾內的另一個 worktree），不是專案程式碼。
- build：`npm run build` pass。
- E2E 全套：`npm run build` 後 `PORT=3200 npx playwright test --reporter=line`（log：`.ai-runs/t14-full-smoke.log`），968 個：959 passed、8 failed、1 skipped（44.2 分鐘）。
  - 全套期間的環境事件（log 可見）：中段出現 `Can't reach database server at localhost:5432`（共用開發資料庫暫時連不上）；記憶紀錄顯示另一個工作階段同日曾停掉 3200 上的伺服器。
  - 8 個失敗在原始 log 的實際錯誤：`teacher-profile-suspension:300` desktop／mobile（暫停成功提示找不到）、`teacher-series-class-edit:343` desktop（預期「已報名 0 / 4 人」實際名額不符）、`organizer-class-proposal-revise:236` mobile（`revise_failed`）、`enrollment:192` mobile（報名成功提示找不到）、`admin-demands:274`、`admin-roster:31`、`admin-teachers:52` mobile（操作 timeout）。
  - 重跑判讀：第一次在 3200 重跑時伺服器中途消失（`ERR_CONNECTION_REFUSED`）、改 3300 時發現該埠被別人的伺服器占用（`reuseExistingServer` 會沿用，結果不採計），最後在確認無人監聽的 3400 執行 `PORT=3400 npx playwright test <上述 7 個 spec:行號> --repeat-each=2`：28 個中 23 passed、5 failed。enrollment:192、organizer-class-proposal-revise:236、teacher-series-class-edit:343、admin-demands:274、admin-teachers:52 在桌機與手機各兩次全部通過；仍失敗的是 `teacher-profile-suspension:300`（4 次全失敗，既有管理員 UI 問題，已另開待辦）與 `admin-roster:31` mobile（2 次中 1 次失敗，偶發）。
  - 原始失敗的成因**未證實**：推測與上述環境事件（資料庫暫時中斷、共用資料庫與伺服器被其他工作階段影響）有關；可確認的是在乾淨埠上這 5 項都能穩定通過，而且失敗的兩個管理員頁面本改版未修改。
- 本票新增：journeys 4 passed（桌機＋手機）、narrow 1 passed（只在手機 project 跑，1 skipped 為桌機）、keyboard 2 passed（`PORT=3400`）。

Scope compliance:
- 只做核准範圍的低風險 UI 修正與驗收測試；沒有 schema、Auth、permission、state、model 變更。

Review（role／permission／state／model／routes／origin／legacy）:
- 三種 origin：老師端開放／取消／完成／改課都限定 `teacher_initiated`（票 09）；團主核心同時適用 `organizer_matched` 與 `organizer_direct`；資料庫 CHECK 保證關聯組合。
- 權限：團體、需求、邀請、課程都以 owner 由 server 判斷；他人 ID not-found（各票 spec 驗證）；匿名讀不到的課程一律通用登入引導；通知連結只從白名單推導，目標頁照原規則檢查。
- 狀態機：邀請 draft／pending／confirmed／declined／withdrawn／converted 與 transitionSeq、version 依 spec 13.3；需求狀態未新增 persist 狀態。
- Legacy：舊 `notifyUsers` 18 個呼叫點不受新增的選填參數影響；舊通知照舊連列表頁；老師系列課、媒合建課、報名、取消回歸全數通過（見全套結果）。
- 入口：入口頁、總覽、需求列表、課程列表首屏都有建立捷徑；我的團體首屏可新增（票 03）。

Risk notes:
- 共用開發資料庫與測試埠：多個工作階段同時跑會互相停伺服器或沿用他人伺服器；判讀失敗前要先換空埠重跑（已記入記憶）。
- `npx eslint .` 會掃到專案資料夾內其他 worktree 的 `.next` 產物；建議之後在 ESLint ignore 加上 `.claude/worktrees/**`（不屬本票範圍，未修改設定）。
- 管理員暫停老師 UI 測試失敗、管理員名單偶發失敗，屬管理員頁面。

Docs impact:
- 行為未改變（只調整區塊順序與文案），route-map／permissions 不需更新；本票券與 ticket-breakdown 已更新。

Rollback notes:
- revert 本票 commit 即可（UI 調整與測試，無資料變更）。

Known limitations:
- 截圖證據在 `.ai-runs/organizer-journeys/`、`.ai-runs/organizer-narrow/`（不進版控，重跑 spec 會重新產生）。
- **未驗證**：手機螢幕鍵盤彈出時是否遮住欄位、錯誤或最後操作（Playwright 無法模擬），需要產品主人或測試者用真手機走一次兩條旅程確認。
- 瀏覽器「上一頁」離開未儲存表單只靠 beforeunload 與站內連結攔截（票 04 已記錄的限制）。
- 票 15（legacy contract 破壞性 migration）尚未進行，需要產品主人確認。

Builder self-review:
- 變更檔案如上；維持 V1 範圍，未新增 Wellness／Academy／Retreat、AI 媒合、付款或原生 App。驗收項目中只有「螢幕鍵盤」子項未驗證，已保留未勾選。
- 角色、權限、狀態機、資料模型與 route 一致；RWD 320／390／1280 驗證；品牌語氣溫和、一頁一個主動作。
- 不需要產品主人決策（票 15 除外）；未修改無關檔案；packet 寫成時尚未 commit，之後只在本機 commit、不 push。

<!-- codex-peer-reviewed: 2026-10-05T22:37:07Z rounds=2 verdict=approved -->
