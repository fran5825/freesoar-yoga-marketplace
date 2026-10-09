# 13：完整情境驗收與文件同步

**What to build:** 依規格 S1–S23 跑完老師與學員的完整旅程，確認三種螢幕寬度、品牌一致與角色邊界，並同步所有相關文件。

**Blocked by:** 01–12

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** SCOPE_DRIFT_RISK

規格：[5. 完整情境清單](../../../../specs/teacher-class-scheduling-spec.md)。

- [ ] S1–S23 每個情境都有對應的 smoke 測試或人工驗收紀錄。
- [ ] 完整 Playwright（獨立埠）、tsc、lint、build 通過。
- [ ] 375／768／1440 檢查老師建立、系列頁、改課、期班頁、學員我的課程。
- [ ] `data-model.md`、`state-machines.md`、`permissions.md`、`route-map.md`、名詞表與規格狀態一致。
- [ ] 依 `docs/harness/review-packet-spec.md` 產出 review packet。
- [ ] 驗收不能取代前票驗收，也不擴大 source 修正授權。

<!-- codex-peer-reviewed: 2026-10-04T00:20:23Z rounds=4 verdict=approved -->

## 驗收紀錄（2026-10-09，Claude，worktree `term-classes`）

### S1–S23 對應

| # | 情境 | 自動化證據（`tests/smoke/`） |
| --- | --- | --- |
| S1 | 單堂建立並開放報名 | `teacher-class-usability`、`teacher-initiated-open-classes` |
| S2 | 持續開課 12 場並勾全部開放 | `teacher-series-open-all`（票 01） |
| S3 | 之後在系列頁全部開放 | `teacher-series-open-all` |
| S4 | 持續開課剩 1 場提醒 | `teacher-series-generate-reminder`；只對持續開課：`term-class-creation` |
| S5 | 公司期班、只收整期、需確認，老師確認一次 | `term-class-creation`（只收整期建立）、`term-enrollment`（需確認時整期 pending）、`term-teacher-handling`（整期確認一次） |
| S6 | 第 4 週才加入 | `term-enrollment`（中途加入只報剩下場次） |
| S7 | 某場被單堂坐滿 | `term-enrollment`（不能報整期）、`term-member-display`（都收時單堂仍可報） |
| S8 | 整期學員請假 | `term-leave-withdraw`（UI 請假） |
| S9 | 整期學員中途退出 | `term-leave-withdraw` |
| S10 | 期班某週放假 | `term-acceptance`（取消一堂：該堂取消並通知、整期報名維持） |
| S11 | 追加補課自動報上 | `term-makeup` |
| S12 | 補課撞課 | `term-makeup`（回傳撞到的課名） |
| S13 | 改某一場教室通知 | `teacher-class-edit`、`teacher-series-class-edit`（票 04、05） |
| S14 | 之後每場改 19:30、撞課整批不改 | `teacher-series-class-edit` |
| S15 | 想改星期 | `teacher-series-class-edit`（改課表單鎖定日期、不提供星期）；人工：系列頁說明 |
| S16 | 人數上限低於已報名 | `teacher-class-edit`、`teacher-series-class-edit` |
| S17 | 已開始或已完成不能改 | `teacher-class-edit` |
| S18 | 常態班中途結束、之後可再生成 | `teacher-series-cancel-from-here` |
| S19 | 只用連結改成公開 | `teacher-series-visibility`；期班整期一致：`term-class-creation` |
| S20 | 課程頁看到同系列下週 | `term-member-display`（同系列場次，不列草稿與訪客看不到的） |
| S21 | 找課程一張期班卡片 | `term-member-display` |
| S22 | 暫停中的老師 | `teacher-class-edit`、`teacher-series-open-all`、`teacher-series-generate-reminder`；期班：`term-acceptance`（不能追加補課、學員不能報整期） |
| S23 | 他人改不是自己的課或系列 | `teacher-series-class-edit`、`term-makeup`、`term-teacher-handling`、`term-leave-withdraw` |

### RWD

`term-acceptance.spec.ts` 在 375／768／1440 檢查無橫向捲軸並保存截圖：老師建課（期班）、期班系列頁（含整期學員）、期班改課頁、找課程（期班卡片）、期班頁（訪客／學員）、我的報名（整期卡片）。真實裝置與螢幕鍵盤未測。

### Checks（2026-10-09，`PORT=3200`、獨立測試 DB `freesoar_term_test`）

- `npx tsc --noEmit`、`npx eslint .`（整個 repo）通過；`npm run build` 通過（Next.js 16 預設 build）。
- 完整 Playwright（`npm run test:smoke`，1156 tests，desktop＋mobile，workers 1）：**1139 passed／4 failed／13 skipped**（46 分鐘）。4 個失敗：`organizer-demand.spec.ts:454`（mobile）、`organizer-journeys.spec.ts:84`（desktop）、`organizer-usability.spec.ts:219`（mobile）、`teacher-recurring-class-series.spec.ts:406`（desktop），都是送出後 5 秒內看不到結果或整體超時。之後重跑時遇到一次 `Can't reach database server at localhost:5432`（本機 Docker 連線短暫中斷，容器本身持續運作），連線恢復後 4 個與 `term-acceptance.spec.ts` 一起重跑：**14 passed／2 skipped**（skipped 為 RWD 案例只在 desktop project 跑一次）。判定 4 個失敗為長時間連續執行與資料庫連線中斷造成的超時，不是期班修改造成。
- 已知不穩定：`member-journey-acceptance.spec.ts:73`（團主團課，desktop）的 200% 文字橫向溢出檢查時過時不過（見票 12 紀錄），屬學員流程 06。

### RWD 截圖（local-only，不進版控）

`.ai-runs/playwright-test-results/term-acceptance-term-pages-*/`：老師建課（期班）、期班系列頁、期班改課頁、找課程（期班卡片）、期班頁（訪客／學員）、我的報名（整期卡片），各 375／768／1440，共 21 張。人工檢視 375 寬的期班頁與期班系列頁：排版、換行、按鈕觸控高度正常；觀察：期班系列頁開頭說明在手機上偏長（三段），留給畫面驗收決定是否精簡。

### 文件同步

`data-model.md`（RecurringClassSeries、Enrollment、SeriesEnrollment）、`state-machines.md`（期班、追加補課、SeriesEnrollment Status）、`permissions.md`（學員整期報名／請假／退出、老師整期確認／婉拒）、`route-map.md`（`/classes`、`/classes/terms/[id]`）、名詞表（新增請假、退出整期、補課）、規格狀態、`docs/backlog.md` 第 20 項。

### Review packet（精簡）

- Changed scope：票 07–13，commit `208d8e1`、`60b81c9`、`ef49485`、`c4d09d9`＋本票驗收與文件。Schema：migration `20261009022844_term_class_series_kind`、`20261009024811_series_enrollment`（additive，已套用到本機共用開發 DB）。
- V1 scope：在核准的老師排課規格內；未新增 Wellness／Academy／Retreat、AI matching、付款／退款自動化、native app；整期付款不做（規格第 7 節）。
- 權限：學員只能報名／請假／退出自己的整期報名；老師只能處理自己期班；公開讀取沒有放寬（期班頁可見性比照單堂）。
- 併發：所有改動場次集合或整期報名的操作先鎖系列；單場報名維持場次 → 老師；有確定性交錯測試（最後一席、兩筆整期、追加與報名、追加與退出、兩次追加）。
- 與規格差異：`Enrollment_series_source_check` 只要求「有整期關聯就必有來源」；通知未新增類型。
- 未完成：Codex peer review（額度用完，所有本批文件標「Codex 補審通過（2026-10-09，4 輪）」）；產品主人畫面驗收；真實裝置與螢幕鍵盤。
- Commit／push：依 2026-10-09 一次性放行分三批 push；未部署（目前沒有正式環境）。

**Status：done（Codex 補審通過（2026-10-09，4 輪）；待產品主人畫面驗收）**

### Codex peer review（2026-10-09，回溯審查 07–13，4 輪 APPROVED）

- 第 1 輪：(1) 整期報名讀到既有單堂報名後、併入前，取消／婉拒可插隊 → 改為 `FOR UPDATE` 鎖住學員在這些場次的既有報名（鎖序 系列 → 場次 → 老師 → 學員報名），加確定性交錯測試；(2) 老師名單把停課、退出、婉拒誤標為請假 → 只列整期有效且課程未取消的取消；(3) 只改單堂地點時期班頁與卡片顯示系列預設 → 期班頁逐堂標示地點、卡片取符合篩選的那一堂；(4) 同系列場次截斷 8 場 → 移除上限；(5) `permissions.md` 仍寫系列改課不能改公開設定 → 更正。
- 第 2 輪：(1) 只改單堂開始時間時摘要不一致 → 期班頁與卡片加註「部分堂次時間不同」；(2) 管理員取消也被標成請假 → 標籤改為如實的「請假或取消」（沒有取消原因欄位，新增欄位超出核准範圍；Codex 第 3 輪 CONCEDE）；(3) 交錯測試的 PrismaPromise 沒有真的送出 → 改為立即送出。
- 第 3 輪：(1) 只改結束時間也要加註，期班頁逐堂顯示開始–結束；(2) 卡片風格取符合篩選的那一堂。
- 第 4 輪：APPROVED。每輪修正後重跑相關 smoke：110、50、72 passed，0 failed。
