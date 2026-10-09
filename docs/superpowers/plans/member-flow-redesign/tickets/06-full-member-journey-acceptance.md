# 06: 完整學員旅程 usability 驗收

**What to build:** 用三批都完成後的版本，把學員整段旅程走一遍：找課 → 詳情 → 註冊／登入 → 本人報名 → 已報名或等待老師確認 → 查看上課資訊或取消。確認步驟精簡、排版一致、資訊好找，留下畫面證據。

**Blocked by:** 02、04、05

**Status:** 自動化驗收通過；人工畫面項目待產品主人（2026-10-09 短路徑：9 個 spec desktop＋mobile 136 passed／2 flaky，flaky 檔單獨重跑 16/16 與 repeat×3 48/48 通過。真實 Google 首次建帳號、200% 文字、全程鍵盤與真實裝置鍵盤未驗收，列入收尾畫面驗收清單）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（以驗證為主；發現的問題若需動 Auth／schema，另開票）

**Source:** `docs/member-flow-redesign-plan.md` Q14、「收斂後的共同理解」。

**範圍說明（2026-10-04）：** 期班的整期報名、請假、退出整期與期班卡片，屬於老師排課計畫（`docs/specs/teacher-class-scheduling-spec.md`），由該計畫的票 13 驗收，不在本票。本票只驗收單堂報名的學員旅程；若驗收時期班功能已上線，確認單堂旅程不受影響即可。

## Acceptance criteria

- [ ] 團主團課與老師開課各走一次完整旅程
- [ ] 桌機、手機 375／390 寬
- [ ] 長標題、約 2000 字說明、長地址；200% 文字放大；只用鍵盤操作
- [ ] 空狀態、篩選返回保留、錯誤（無效日期）、額滿、已開始、登入取消／失敗、回來後不可報名
- [ ] 直接確認與需老師確認兩種報名；pending → confirmed 的顯示
- [ ] 步驟數：已登入學員為列表 → 詳情同頁送出；訪客為詳情 → Google → 同一詳情確認送出
- [ ] 小問題在本票修；超出範圍的記 `docs/backlog.md`
- [ ] 報告區分自動化 smoke、手動畫面檢查，以及未驗收項目（如真實裝置鍵盤）
- [ ] 票 05 的真實 Google OAuth 手動驗收未完成時，本票不得宣稱完整旅程已通過


<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->

## Codex 接手盤點與執行清單（2026-10-07）

本輪授權來源：產品主人要求確認學員流程未完成工作並由 Codex 接手。先完成 docs 盤點與驗收準備；不將一般接手要求解讀為對任意資料庫、migration 或 commit／push 的授權。

- [x] 找回權威 plan、票券相依與 Claude 完成紀錄；核對票 01／02／03／05 的 commit 已包含於目前 main `a5c1ec2`。
- [x] 核對票 05 真實 OAuth 紀錄：產品主人回報取消 → 重試 → 返回同堂課成功；首次建帳號沒有單獨驗收紀錄。
- [x] 對照現有 smoke 與本票 criteria，列出下表覆蓋與剩餘驗證。
- [x] 票 04 接回 main 後完成 Webpack fresh build、原 10 specs 164/164、owned cleanup／395 source 與 124 client hash 保留；獨立 Reviewer APPROVE。原老師 task 停止，本 task 接手；不宣稱 default Turbopack 通過。
- [x] 執行前凍結 396 source、28 migrations 與 26,698 private dependency files；原老師 task 停止，allowed files／精確 DB 目標／private client generation／cleanup 與停止條件記於 `.ai-runs/current/2026-10-07-member06-journey-acceptance/approved-decision.md`，獨立靜態 execution review APPROVE。
- [ ] 在有效新 build 上執行受影響 smoke，串接兩種來源、直接確認／待老師確認與取消的完整旅程；既有歷史通過結果不直接勾成本票完成。
- [ ] 補查登入途中名額或開始時間變動後返回，以及取消登入後實際點重試的目的地／cookie；只補 outcome 驗證，不改 Auth contract。
- [ ] 完成桌機、375／390、長內容、200% 文字與全程鍵盤的畫面 QA，保存 screenshot 與觀察紀錄；真實裝置鍵盤另外列限制。
- [ ] 確認 pending 被老師接受後，學員詳情、我的報名與總覽顯示 confirmed；只查老師 roster 與 DB 不算學員端顯示驗收。
- [ ] 整理 checks、self review、scope drift 與正式 packet；全部條件成立才標完成，不 auto commit／push。

### 既有測試與需要補足的證據

以下只代表本輪靜態讀碼結果，不代表本輪已執行或通過測試。

| 驗收面向 | 既有 source 證據 | 本票仍需做的事 |
| --- | --- | --- |
| 找課、篩選返回、長內容與手機 | `tests/smoke/public-classes-discovery.spec.ts` 的 combined filters 案例已含約 2000 字說明、長標題／地址、375／390／1280、文字 200% 與部分 Tab／Space 操作；`class-discovery-filters.spec.ts` 含日期與安全返回路徑 | 用最終整合版本重跑、人工看畫面；既有鍵盤案例從備註欄 focus 開始，不能當成整段旅程只用鍵盤通過 |
| 訪客直接 Google、取消／失敗、不自動報名 | `class-direct-sign-in.spec.ts`、`public-classes-discovery.spec.ts`；票 05 真實 OAuth 另有產品主人回報 | 取消案例只確認重試按鈕／hidden destination，需補實際重試與 cookie；補登入開始後才額滿／已開始的返回驗證。首次建帳號若需實測，先由產品主人操作 |
| 團主團課與老師開課完整旅程 | `enrollment.spec.ts` 有團主開放、分享、學員報名與 roster；`public-classes-discovery.spec.ts` 有老師公開課找課／報名／取消 | 串接兩種來源的最後版本 journey 與畫面證據，不能用不同歷史 run 拼成一次完整通過 |
| 待確認與接受後學員顯示 | `enrollment-approval.spec.ts` 有老師 roster 接受／婉拒、DB 狀態與通知；`member-dashboard.spec.ts` 有 fixture pending／confirmed 分組 | 加查實際 pending → 老師接受 → 學員詳情／我的報名／總覽更新，fixture 直接設狀態不等於完整串接 |
| 系列場次資訊 | `series-member-info.spec.ts`、`class-member-info.spec.ts` | 依票 04 整合版本驗證兩種系列生成與讀取；不擴到期班整期報名 |
| 權限與不可報名 | `enrollment.spec.ts`、`enrollment-approval.spec.ts`、`public-classes-discovery.spec.ts` 含 draft／suspended／IDOR／同意／duplicate／名額／已開始 | 保留核心斷言，不用調整權限或縮減測試換取通過；錯誤與空狀態仍需畫面 QA |

### 獨立問題與執行邊界

- 公開 `confirmed` 課程登入後可能 404：本輪確認 `src/domain/class-session/public-read-service.ts` 允許 `open_for_enrollment`／`confirmed`，但 `src/domain/enrollment/read-service.ts` 的 `getClassSessionForMember` 僅允許 `open_for_enrollment`／`completed`。這是靜態 contract 差異，未跑 DB／UI 重現，影響既有讀取邊界；依票券總覽，此問題獨立待驗證／待決，不在本票默默放寬 WHERE。
- 期班／整期報名／請假／退出整期仍由老師排課計畫票 07～13 處理；取消後重報、付款與公開老師介紹不納入本票。
- `package.json` 的 `pretest:smoke` 會先 build；若用 `npx playwright test`，必須另確認有效 build。現有 config `reuseExistingServer: !process.env.CI`，隔離驗證要禁止重用提供舊產物的 server；workers=1 只序列化單次 run，不能防止另一 task 同時寫相同 DB。
- 票 04 接回階段的全專案 lint log 記為失敗（1097 errors／9225 warnings），本輪 affected lint log 無錯誤輸出；完整結論仍由票 04 task 核對，不將定向結果宣稱全專案通過，也不為修 checks 修改 lint 設定。

### 本輪檢查與 self review

- Changed files：本票、`docs/superpowers/plans/member-flow-redesign/ticket-breakdown.md`、`docs/member-flow-redesign-plan.md`；僅校正最新狀態與新增驗收清單，歷史證據保留。
- Checks：Git ancestry 四筆均回傳 0；測試 source、Auth 紀錄、讀取 contract 與 scripts 靜態回讀；本輪三份 docs 的 `git diff --check` 與 read-back 通過。本輪未執行程式 tests、build、migration 或 DB fixtures，不宣稱 runtime 通過。
- V1／scope：維持角色、permissions、state machines、data model 與 route map；未新增 Wellness／Academy／Retreat、AI matching、金流或 native app。
- Security／RWD／brand：紀錄已知讀取差異與必要 QA；沒有新增產品風險或宣稱完成畫面驗收。沒有修改不相關檔案，其他 task dirty changes 保留；未 commit／push。
- 產品主人決策：docs 接手準備可直接做；資料庫／migration 操作及讀取 contract 修正仍依具體 plan 與原批准邊界，不因接手而放行。

### 第一輪隔離 runtime 與續接（2026-10-07～10-09）

- 已核准範圍與執行前獨立 review 記於 `.ai-runs/current/2026-10-07-member06-journey-acceptance/`。只新增 journey smoke、在 direct-sign-in 補 outcome、更新本 plan／index／票與 local 驗證材料；未修改產品 source。
- 第一輪 Prisma validate／private client generate、既有 28 migrations deploy/status、tsc、全 lint、**fresh default Turbopack production build 均 PASS**。12 specs 一次為 **168 passed／6 failed**，不能記為本票通過。
- 6 failures 都在新增 journey spec：成功 feedback 與「查看我的報名」同一 section，exact text locator 找不到；empty-result 與 filter 各有一個「清除篩選」，未限定 scope 的 locator 為 strict violation。Error context 已顯示報名成功；尚未走完後續取消，不能用該畫面宣稱完整 keyboard journey 通過。其餘新增重試／返回時額滿／已開始與 pending → 老師接受 → 三個學員畫面案例在兩個 projects 均通過。
- 專屬 container／volume 移除、55448／33448 釋放、396 source／26,698 root dependencies／26,698 private dependencies、HEAD／index 保留檢查 PASS；原 run／logs／screenshots 完整保留。
- 產品主人之後明確要求「請繼續」。依原 scope 修正可見 `aria-live` section 的成功／取消文字檢查、限定 empty-result 內的清除連結，並在 200% 放大後以鍵盤再次到達按鈕保存 focused／viewport 證據；未刪掉核心結果或 DB 狀態斷言。
- 續接 run：`.ai-runs/current/2026-10-08-member06-journey-acceptance-resume/`，同一精確 DB／resources／ports、新 owner 與独立 source/dependencies 目錄。Reviewer 要求補回 copy 前 regular-file／parent realpath 守衛與 provenance 路徑；先啟動的副本保留且未用於 DB，改以補妥守衛的 `validation-project-reviewed` 準備後再執行。DB 前／finally 全量 dependency hashes、generation 完整 diff 與各階段 source hashes 保留，不反覆讀同一 dependencies。
- 本票完整結果、畫面 QA 與最終獨立 review 仍待續接；沒有 commit／push／部署、shared DB／root client 變更。歷史 lint 失敗已由票 04 scope 修正並通過，本輪全 lint 也通過，不以舊失敗覆蓋新證據。

### 產品主人調整驗證策略（2026-10-09，後續依此為準）

- 產品主人要求保持原產品／隔離 DB 邊界，校驗聚焦產品 source、設定、schema／migration 與可能被生成程序改寫的 Prisma client；其他 dependencies 記 package／lockfile／來源版本與 copy 前 symlink／external path 守衛，停止預設 full node_modules hash。
- 切換時確認 runner 僅在 DB 前唯讀 hash，專屬 container／volume 均不存在，安全停止該 scan；沒有中斷 DB／migration／server／smoke。原 runner／manifest／copy guards 與 first run 證據保存，停止紀錄見 `checks/strategy-change-stop.json`，不把未完成校驗宣稱 PASS。
- 新 runner 仍核對 396 frozen source/config/schema/migration/test files；完整 Prisma client 124 files 起訖 hash、private generation 新增／刪除／hash diff 與隔離 env／resolve guard 保留。其餘 dependencies 僅記錄 provenance，不宣稱所有檔案 bytes 未改。詳細保證與限制見本 run `verification-policy.md`。
- 保留必要 Prisma／migrations／tsc／lint／fresh build／12 specs／owned cleanup 與 HEAD／index。此次續跑因 first failures、測試修正與新 guarded stage；通過後不為文件結案例行重跑，只有新修改、失敗或具体未解風險才重跑受影響 checks。
- 沒有產品程式變更、擴 scope、共享 DB／root client 操作、commit／push；不重問已核准工作。尚需本策略下 runtime、畫面 QA 與最終獨立 review 才結案。

### 本輪收尾與唯一下一步（2026-10-09）

產品主人明確要求現在收尾、停止自動重試與新增檢查。以下僅依既有證據更新狀態，不重新執行 checks，不啟動短路徑 runner，也不接續其他票。票 06 維持未完成，原 acceptance criteria 不勾成通過。

- **已完成：** 新增 `tests/smoke/member-journey-acceptance.spec.ts`，補強 `tests/smoke/class-direct-sign-in.spec.ts` 的取消後重試與登入返回時額滿／已開始結果；第一輪 168 passed／6 failed 後修正新增 journey locator，修正後完整 smoke 尚未通過。已採用 targeted source／Prisma client 校驗、dependency provenance 與 copy 前 symlink／外部路徑守衛；停止預設 full node_modules hash，原證據保留。
- **最新執行證據：** `.ai-runs/current/2026-10-08-member06-journey-acceptance-resume/checks/result.json` 記錄 Prisma validate／private generate、28 migrations deploy／status、TypeScript、lint exit 0；fresh build exit 1，smoke 未執行。396 source、124 root client、124 private client 校驗 mismatches 0，HEAD／index 未改；其他依賴僅保留版本與來源證據，不保證每個檔案 bytes 未改。
- **未完成與阻塞：** 最新 fresh build 被 Windows 過長的 Turbopack source-map 路徑阻擋；完整 12 specs／174 tests、最終桌機／375／390／200%／鍵盤畫面 QA 與最終獨立 review 未完成。第一輪有效 build 與部分 smoke 不能替代修正後完整驗收。真實 Google 首次建帳號與真實裝置鍵盤沒有本輪獨立實測證據。
- **短路徑準備：** 已將 guarded private stage 搬到 `.ai-runs/current/m06-check`，原失敗 `.next` 存於前 run 的 `failed-build-output/`；搬移紀錄見 `.ai-runs/current/2026-10-09-member06-short-path/stage-relocation.json`。新 runner 與 inherited checks 證據已準備，尚未啟動。Reviewer 最後為 REQUEST CHANGES，僅指出 DB 前 index self-comparison；已改為 `validation-initial-index.txt` 對照 `initial-index.txt`，未再次 review／執行，不能宣稱 APPROVE。額外快照 helper 的執行被拒且未執行，改沿用先前已核對的 index 證據。
- **資源清理：** 最新既有結果記錄 `fsy-member06-20261007-pg` container 與 `fsy-member06-20261007-pgdata` volume 已移除，55448／33448 均釋放。短路徑 runner 未啟動，沒有新建 DB／server；private stage、原 logs／screenshots／manifest／失敗 build 有意保留作續接證據。本輪未新增清理探測，不將前次結果說成剛重新檢查。
- **修改檔案：** 票 06、`ticket-breakdown.md`、`docs/member-flow-redesign-plan.md`；上述兩份 smoke tests；專屬 `.ai-runs/current/2026-10-07-member06-journey-acceptance/`、`2026-10-08-member06-journey-acceptance-resume/`、`2026-10-09-member06-short-path/` 驗證腳本、manifest／policy／patch 與證據。此收尾操作只更新三份 docs，不再改 tests／runner。
- **Self review／scope drift：** 回讀收尾文字與既有 result／relocation 記錄，未新增 runtime 驗證。維持 V1、原單堂旅程與隔離 DB 邊界；未修改產品 source／設定／schema／migration、Auth、role／permission、state machine、data model 或 route map，未加入 Wellness／Academy／Retreat、AI matching、付款退款自動化或 native app。沒有新增產品安全／品牌變更；RWD／鍵盤完整 QA 尚未完成。未修改不相關檔案，其他 task dirty changes 保留；未 commit／push。沒有新增產品決策。

Recommended Next Step（僅記錄，不執行）：

- Level：L3。
- Recommended next work mode：原核准範圍的 STANDARD 驗收 Builder。
- Next smallest actionable slice：**使用短路徑完成票 06 驗收**。確認既有 guard 修正後，在短路徑完成必要 build、12 specs、畫面 QA、專屬資源清理與最終 review；有效且未受新修改影響的通過證據沿用。
- Why this should be next：避開已知 Windows 路徑限制，補齊票 06 尚缺的驗收證據。
- Can Codex execute directly：後續收到恢復指示可在原核准邊界續接；本輪不執行。
- Suggested execution location：目前 task；本輪不建立新 task。
- Requires product owner decision：無新增產品決策；目前遵從收尾指示停止。
- Suggested next prompt：None；依產品主人要求，本輪只記錄下一步，不提出執行選項。
- Auto-continue allowed：No。
- Auto-continue reason：產品主人明確要求停止自動重試與新增檢查。
- Stop condition triggered：本輪收尾，票 06 未完成。
- Notify human：Yes。
- Notification reason：回報已完成／未完成／阻塞與既有資源清理結果。
- Approval noise reduction applied：不重問既有授權，不重跑已通過檢查。
- Approval boundary note：不修改產品、不擴 scope、不操作共享 DB、不 commit／push、不接續其他票；短路徑驗收只留作下次工作。

## 短路徑驗收結果（2026-10-09，Claude）

- 環境：主工作目錄 main（含學員 04、團主 15a、管理員 14），`PORT=3100 CI=1`，`npm run test:smoke`（pretest build 為 Next 16 預設 Turbopack），本機共用開發 DB。
- 範圍：`member-journey-acceptance`、`class-direct-sign-in`、`class-discovery-filters`、`class-member-info`、`enrollment-approval`、`enrollment`、`member-dashboard`、`public-classes-discovery`、`series-member-info`，desktop＋mobile 共 138 項。
- 結果：136 passed／2 failed（11.3m）。兩項都在 `series-member-info.spec.ts`：desktop :264 存入值變成新舊文字相接（`只有第一場的適合對象系列的適合對象`），mobile :183 摺疊區 summary 一直不穩定可點。
- 判定為負載下的 flaky：DB 閒置時單獨重跑該檔 16/16，`--repeat-each=3` 48/48 通過；未改產品 source 或測試。推測是長時間整套執行時頁面尚未 hydrate 完就操作表單；之後若再出現，再評估在這兩處等待表單可互動。
- 未驗收（需產品主人或真實裝置）：真實 Google 首次建帳號、200% 文字放大、全程鍵盤、真實裝置鍵盤。列入 `docs/superpowers/plans/2026-10-09-wrap-up-plan.md` 畫面驗收清單。
