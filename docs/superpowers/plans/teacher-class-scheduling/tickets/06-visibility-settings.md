# 06：公開設定（系列可公開、建立後可改）

**What to build:** 系列建立時可選「公開列在找課程」或「僅透過連結招募」；單堂與系列建好後都能改公開設定，系列改設定時套用到未開始的場次並成為之後生成場次的預設。

**Blocked by:** 04 單堂改課；05 系列改課（公開設定放在改課介面內）

**Status:** done（2026-10-06，待產品主人看畫面）

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** PRISMA_SCHEMA、MIGRATION（`RecurringClassSeries` 新增是否公開欄位，預設不公開）、PUBLIC_READ

規格：[4.3 公開設定](../../../../specs/teacher-class-scheduling-spec.md)（Q3、Q12、Q17）；情境 S19。

- [x] 實作前更新 `docs/domain/data-model.md`，說明欄位、預設值與 rollback。
- [x] Additive migration：既有系列預設不公開，行為不變。
- [x] 建立系列時可選公開，預設僅透過連結招募；生成更多沿用系列設定。
- [x] 單堂可改公開設定。系列依規格 4.3：持續開課依改課套用範圍（只改這場／這場和之後，更早場次不變）；期班整期一致，從任何一場改都套用到所有未開始、未取消的場次與系列預設（推導規則 8，放行時確認）。
- [x] 本票早於 07，系列尚無型態欄位，所有系列先套用持續開課規則；期班整期一致規則由 07 落地（見 07 驗收）。
- [x] 公開讀取條件不變（公開、開放報名、老師通過審核）；文案清楚區分「公開」與「開放報名」。
- [x] Smoke 測試覆蓋：公開系列場次出現在找課程、改回不公開後消失、從中間場次改時較早／所選／之後場次與系列預設各自正確、既有系列不受影響、他人拒絕；tsc、lint、build、受影響 smoke 通過。

## 開工前設計（2026-10-05，待產品主人確認）

### 資料庫現況（2026-10-05 查證）

- `prisma/schema.prisma` 沒有未提交的修改；另一個 task（團主流程）的 3 個 migration（`20261005000000_organizer_class_proposal`、`20261005100000_class_origin_organizer_direct`、`20261005100100_class_origin_invariants`）已提交，`prisma migrate status` 顯示資料庫與 migration 一致。
- 仍可能動到同一份結構檔的工作：團主流程票 10、12–15（其中票 15 是團體欄位收尾）、學員流程票 03／04（`ClassSession` 與 `RecurringClassSeries` 新增「適合對象」「準備事項」）。本票只動 `RecurringClassSeries` 一個欄位，但與學員流程票 04 改同一個 model，**開工時要確認沒有其他 task 正在改結構檔**，並以當下最新的結構檔為底產生 migration。
- 團主流程票 09 標示「老師端開放／取消的 origin 檢查等老師排課工作 commit 後補」——它在等本計畫票 01–05 的程式提交。

### Migration 計畫

- 只新增一個欄位：`ALTER TABLE "RecurringClassSeries" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;`（additive，不改、不刪既有資料）。
- 既有系列一律 `false`＝僅透過連結招募，與現在行為相同；既有場次的 `ClassSession.isPublic` 不動。
- Rollback：刪除這個欄位即可（`ALTER TABLE "RecurringClassSeries" DROP COLUMN "isPublic";`），只會失去「系列預設是否公開」，已生成場次各自的 `isPublic` 保留。目前沒有正式上線資料。
- 用 `prisma migrate dev` 產生，並更新 `docs/domain/data-model.md`（已先寫為「已核准・未實作」）。

### 行為

| 情境 | 結果 |
| --- | --- |
| 建立系列 | 「報名設定」多一組「公開列在找課程／僅透過連結招募」，預設僅透過連結招募；生成的每一場套用這個設定 |
| 生成更多 | 新場次沿用系列目前的設定 |
| 改單堂課 | 改課頁的「公開列表」從唯讀改成可以選 |
| 改系列場次：只改這一場 | 只改這一場的公開設定 |
| 改系列場次：這一場和之後所有場次 | 這些場次與系列設定一起改；更早的場次不變 |
| 草稿設為公開 | 可以，但要開放報名後才會出現在找課程（既有公開條件不變） |

- 公開讀取條件不變：公開、開放報名、老師已通過審核、尚未開始。
- 不發通知（公開與否不影響已報名的學員）。
- 期班「整期一致」的規則在票 07（期班）落地；本票所有系列先照持續開課的規則。
- 文案：系列頁、建立表單、改課頁中「系列場次不會列在公開課程列表」等固定說法，改成依實際設定顯示。

### 測試規劃

建立公開系列後場次出現在找課程（開放報名後）、未公開的不出現、生成更多沿用、單堂改公開／改回不公開、系列只改這一場與改之後所有場次（更早場次與系列預設各自正確）、既有系列 migration 後不公開、他人與暫停老師被拒、RWD。

### 待產品主人確認

- **A. 新系列預設「僅透過連結招募」**（建議，沿用現行行為；規格 4.3 也是這樣寫）。
- **B. 開工時機**：建議先把票 01–05 提交（commit），讓團主流程票 09 可以接著補老師端檢查，也讓本票的 migration 以乾淨的結構檔為底。是否 commit、何時 commit 由你決定。

## 執行紀錄（2026-10-06）

產品主人確認 A（新系列預設僅透過連結招募）並放行。第一次開工時發現學員流程的 migration 已套用到共用資料庫但尚未合併進 main，Prisma 要求重設資料庫；當時停下、撤回結構檔修改，等學員流程合併後才繼續。

- Migration `20261005214134_recurring_series_is_public`：`RecurringClassSeries` 新增 `isPublic BOOLEAN NOT NULL DEFAULT false`（檔頭附中文說明與 rollback）。已套用到開發資料庫，`prisma migrate status` 一致。產生 Prisma client 時查詢引擎檔案被其他工作階段的伺服器占用（Windows EPERM），型別與 JS 已更新、引擎檔沿用同版本。
- 建立系列：「報名設定」改成公開／僅透過連結招募兩個選項（預設後者），寫入系列；生成與「生成更多」的場次沿用 `series.isPublic`。
- 改課：單堂與系列改課頁的公開設定可以改；只改這一場只改該場；改這一場和之後所有場次一併更新系列設定。「儲存前核對」會列出「公開設定」。
- 文案：建立系列的核對摘要、建立成功訊息、系列頁說明與全部開放報名視窗都依實際設定顯示；系列內容區新增「公開列表（系列設定，新場次沿用）」。
- 文件：`data-model.md` 的 RecurringClassSeries 說明改為已落地並記錄 migration 名稱。
- 測試：新增 `teacher-series-visibility.spec.ts`（預設不公開、公開系列的場次開放後出現在找課程、只改這一場與改之後所有場次各自正確、生成更多沿用、改回不公開、UI 建立公開系列後訪客找得到、改課頁改公開）；`teacher-class-list-navigation`、`teacher-class-usability` 的舊文字斷言同步更新。
- Checks：`tsc`（排除其他工作階段開發伺服器正在寫的 `.next/dev/types`）、`eslint`（排除 `.claude/worktrees`）通過；`next build` 通過；Playwright 8 個檔 116 個中 114 個通過，2 個失敗：一個是舊文字斷言（已更新，重跑 24 個全過），一個是 `public-classes-discovery` 小螢幕旅程在伺服器連不上資料庫時逾時（單獨重跑通過）。
- RWD：375／768／1440 建立表單的公開選項與系列頁無橫向捲動，選項高度 ≥ 44px。
- 執行時誤停了另一個工作階段在 3200 埠的測試伺服器（已向產品主人說明並記入記憶）；之後改用 3300 埠。

<!-- codex-peer-reviewed: 2026-10-04T00:20:21Z rounds=4 verdict=approved -->

## 公開設定 × 學員資訊整合（2026-10-06）

產品主人於目前 task 選擇 1，核准隔離 worktree 的第一階段檔案整合；未授權 DB、回寫來源工作目錄、commit／push 或部署。本節是整合紀錄，不把來源票的既有 checks 當作整合後驗收。

- [x] 保存兩來源與 task-start baseline、checksum、完整來源差異。
- [x] 整合 schema、validation、action、生成、兩種改課範圍、DTO 與 UI；保留兩份 migration 原位元組。
- [x] 解決表單摘要與 data-model 的兩處文字合併衝突，修正過時改課文案與註解。
- [x] 補公開設定 × 學員資訊交叉測試（本階段只完成測試程式，未執行 DB smoke）。
- [x] Prisma validate／generate、TypeScript、ESLint 通過；10 個不依賴 Prisma／DB 的純函式情境通過，scope／self review 完成。
- [x] 第二階段另取得 A 方案授權，於專屬 DB 完成完整 build、138 smoke 與 24 個 RWD 畫面狀態；第一階段本身未授權 DB。
- [x] 獨立 Reviewer 第一階段初審、P2 修正及再審。
- [x] 第二階段完整驗證完成（詳見下節）；不自動進票 07。
- [ ] 產品主人實際畫面驗收與回寫來源工作目錄放行。

### 第一階段續接（2026-10-06）

- 產品主人確認目前僅有共用開發 DB；未視為 DB 操作授權。本輪仍未連線 DB、執行 build／fixtures／smoke／RWD。
- 獨立 Reviewer 首次因用量限制未產出結果；產品主人說「請繼續」後續接一次，完成初審，提出一項 P2：系列公開預設不能宣告所有既有場次的公開狀態。
- [x] 修正系列頁 header 與「全部開放報名」dialog，區分新場次預設及各場公開設定；保留 only-this／較早場次的例外，不改 DTO、permission 或 public-read。
- [x] 補公開與不公開系列各一個混合值 UI 回歸測試程式，驗證文案、批次開放保留各場值及公開列表僅含公開場次；尚未執行 DB smoke。
- [x] 最小修正後 TypeScript／ESLint 通過；證據脚本首次觸發 lint 的 CommonJS import 錯誤，已改 ES modules 並重跑通過，未修改或放寬 lint 設定。
- [x] 最小修正後 diff checks／Reviewer 再審：APPROVE 僅限第一階段 source 與非 DB 交付；沒有新的 blocking finding，詳見本 run 的 `07-reviewer-final.md`。
- [x] 具體化獨立 PostgreSQL 測試 DB、指定命令、fixtures 範圍與清理方案；僅草稿，尚待批准，見本 run 的 `06-isolated-db-validation-plan.md`。

證據目錄：`.ai-runs/series-integration-1791245052403`（local-only）；目前狀態：整合候選已完成隔離驗證，尚未回寫 main 或其他工作目錄。

### 第二階段隔離驗證（2026-10-06）

產品主人選擇 1，核准 A 方案與完整驗證草稿；核准紀錄與前後 baseline 存於本 run 的 `09-approved-phase-two.md`／`phase-two`。本階段不改 source，不使用共用 DB，不 commit／push。

- [x] Docker local named-pipe／Linux、資源名稱與 port、candidate／來源 checksum 前置核對。
- [x] 建立專屬 container／volume／空 DB；核對 identifier、label、loopback port 與 mount。
- [x] 28 份既有 migration deploy／status、Prisma generate、三個系列欄位與預設檢查通過。
- [x] 指定 9 份 smoke（pretest 含本輪 build）：138/138 通過，desktop／mobile、workers=1，詳見 `phase-two/build-and-smoke.log`。
- [x] 首輪 RWD 停止原因已記錄：額外腳本第一個斷言誤以為摘要顯示全文，實際顯示已填寫字數；未判定為產品錯誤，當時完整 RWD 未完成。
- [x] 已停止驗證並清理本次 server／container／volume；產品 source 未變，失敗證據另凍結於 `phase-two/rwd-attempt-1`。
- [x] 修正 local-only RWD 腳本斷言，直接驗證欄位全文與摘要兩個字數提示；不改產品 UI 或 source、不重跑已通過 smoke。重跑草稿與後續授權分別保存為 `11-rwd-resume-draft.md`、`12-approved-rwd-resume.md`。
- [x] 產品主人在失敗說明後明確說「請繼續」，放行原 A 方案下的最小 RWD 續接；證據另存 `phase-two/rwd-attempt-2`，保留首輪 138 smoke／build 與失敗紀錄。

- [x] 續接於重新建立的專屬空 DB 完成 28 份 migration deploy／status，沿用 hash 相同的 build 與 138 smoke 證據。
- [x] 375／768／1440 各 8 個狀態，共 24 個畫面：建立每週／指定日期、時間錯誤、修改單場／之後場次、系列、確認 dialog、訪客課程頁；皆無橫向溢出、無 pageerror。各寬度驗證時間錯誤保留已填資訊、Tab／Enter／Escape 與 dialog 焦點。
- [x] 實際檢視手機錯誤表單／確認視窗、桌面改之後場次、平板訪客頁截圖，未發現本切片阻塞性版面或品牌問題；這不取代產品主人驗收。
- [x] 續接完成後清理本次 server／container／volume，未使用共用開發 DB。
- [x] 第二階段證據獨立複審：APPROVE、無 blocking findings；確認 138 smoke、24 個 RWD 狀態、frozen source／migration、來源完整性與清理證據。詳見本 run 的 `14-reviewer-phase-two-final.md`。不等同回寫來源或正式上線批准。

第一階段歷史 checks 使用 bundled Node 24.19.0；Prisma validate／generate 只使用 process-local 靜態佔位 URL（port 1），當時不連線 DB、不建立 env 檔。TypeScript 與 npm run lint 全部通過，未改設定以排除錯誤。當時 DB smoke、完整 build、RWD 尚未執行；第二階段授權與實際驗證結果見上節。兩份 migration 原位元組保留，已審查 manifest／完整 patch 另行凍結，第一階段審查後產品 source 未改，只有本票治理紀錄與 local-only QA 腳本／證據更新。
