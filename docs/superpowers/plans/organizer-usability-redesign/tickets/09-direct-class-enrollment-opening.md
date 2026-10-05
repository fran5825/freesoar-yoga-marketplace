# 09: 直接開放報名與來源權限

**What to build:** 老師已確認後，團主一次完成直接開團與開放報名；重試仍是同一堂，相關角色只能執行自己有權的操作。

**Blocked by:** 07：修改、撤回與重新邀請

**Status:** done（2026-10-05）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK、STATE_MACHINE_RISK

- [x] 新增 organizer_direct origin 與 unique proposal→ClassSession 關聯，三種 origin 維持明確 demand／organizer／organization／proposal 不變量。
- [x] 在同一 transaction 鎖 teacher＋proposal，驗 own、approved、accepted 最新版本、future 與 conflict；僅排除自身 confirmed proposal。
- [x] 原子建立 open_for_enrollment 課程並將 proposal converted；不可先建立 draft 再於交易外開放。
- [x] 重試／並發回同一課程；失敗 rollback 保留 confirmed 邀請及預留，不留下半課程、半 converted 或 double-book。
- [x] direct 沿用團主報名規則 requiresApproval=false、預設 isPublic=false，公開選擇真正生效；不從不存在的 demand 猜程度與風格。
- [x] 老師 open／cancel／complete 的 server origin guard 依既有 documented permission 限制；受邀確認不授予團主管理權。admin 保留既有讀／取消，不新增代確認／direct 建課。
- [x] 雙端與 admin/public/member 來源標示、窄 DTO 正確；成功前往該課程詳情，能使用既有報名流程。
- [x] 測試原子 rollback、idempotency、跨 proposal 衝突、三種來源關聯／角色、公開選擇、既有 matched／teacher series／報名／取消回歸；同步文件。


## 開工前核對（2026-10-05）

- **共享檔案重疊（停止條件，已請產品主人選擇）**：老師端「開放報名」（`src/domain/class-session/service.ts` 的 `openOwnClassSessionForEnrollmentForTeacher`）與「取消」（`__internal__/cancel-class-session-core-for-teacher.ts`）正被老師排課工作大幅改寫且未 commit，本票要加的 `origin = teacher_initiated` 檢查落在他們改寫的範圍內，無法安全分開。產品主人沒有偏好，依建議：本票先完成其他部分，這兩個檢查等老師排課 commit 後補上，本票在那之前維持未完成（blocked）。「完成」核心（`complete-class-session-core-for-teacher.ts`）沒有被修改，本票直接加上。
- **Schema／migration**：兩個 migration：(1) `ClassSessionOrigin` 新增 `organizer_direct`（`ALTER TYPE ... ADD VALUE`，PostgreSQL 不允許在同一個 transaction 使用新值，所以分開）；(2) `ClassSession` 加 `CHECK` 約束保證三種來源的 demand／organizer／organization 組合（已確認開發資料庫現有 5 筆都符合，測試 fixtures 掃描也沒有違反）。套用到 `freesoar_yoga_marketplace_dev`。
- **Domain**：`openDirectClassFromProposal`（同一個 transaction：鎖老師並檢查撞課〔只排除自己這筆邀請〕→ 鎖邀請 → 驗 owner、confirmed、確認的版本＝目前版本＝畫面版本、老師 approved、未來、完整 → 建立 `organizer_direct`／`open_for_enrollment`／`requiresApproval=false` 的課程 → 邀請 converted 並寫入 classSessionId）；重試時已 converted 就回傳同一堂課；失敗全部 rollback。成立後通知老師（本人授課不通知）。
- **頁面**：團主詳情 confirmed 時「開放報名」，成功前往 `/organizer/classes/[id]`；學員、老師列表與詳情的來源標籤加上「團主直接開團」。
- **Rollback**：migration 是新增 enum 值與約束；在沒有 `organizer_direct` 課程之前，可用 forward migration 刪除約束（enum 值移除需重建型別，列為限制）。程式 revert 本票 commit。
- **驗證**：原子開放、重試／並發只有一堂課、rollback 不留半成品、跨邀請衝突、三種來源約束、公開設定生效、老師完成核心擋團主的課、既有媒合／老師系列／報名／取消回歸。

## 執行紀錄（2026-10-05）

- [x] Migration：`20261005100000_class_origin_organizer_direct`（新增 enum 值）、`20261005100100_class_origin_invariants`（三種來源的 CHECK 約束），`migrate deploy` 套用到 `freesoar_yoga_marketplace_dev`，沒有 drift。
- [x] `__internal__/open-direct-class-core.ts`：同一個 transaction 鎖老師（撞課只排除自己這筆邀請）→ 鎖邀請 → 重驗 owner、confirmed、確認版本＝目前版本＝畫面版本、老師與時間沒變、老師 approved、完整與未來 → 建立 `organizer_direct`／`open_for_enrollment`／`requiresApproval=false`、沿用邀請公開設定的課程 → 邀請 converted。已 converted 時回傳同一堂；唯一約束衝突時也回傳已存在的那堂；失敗全部 rollback。commit 後通知老師（本人授課不通知）。
- [x] service `openOwnDirectClass`、action、團主詳情 confirmed 的「開放報名」（確認畫面說明開放後不能再改內容）、成功前往 `/organizer/classes/[id]?flash=opened`。
- [x] 來源標籤：學員看到「團主團課」（glossary：兩種團主路徑都是團主團課），老師列表與詳情看到「團主合作開課」。團主課程詳情的「程度」本來就允許沒有需求。
- [x] 老師端「完成」核心加上 `origin = teacher_initiated`（更新與失敗分類都有）。
- [x] 老師端「開放報名」與「取消」的 origin 檢查（老師排課 `36d56e5` commit 後補上）：開放抽成 `__internal__/open-class-session-core-for-teacher.ts`，更新與失敗分類都限定 `origin = teacher_initiated`；取消核心的 `FOR UPDATE` 鎖查詢加上同樣條件；系列「全部開放」與「從這場起取消」也限定 origin。老師改課核心本來就檢查 origin，不用改。
- [x] 測試：新增 `organizer-direct-class.spec.ts`（UI 開放流程與課程欄位、通知老師、重試與並發只有一堂、建課後失敗整個 rollback 並可重試、未確認／版本不同／其他團主／撞課／老師暫停、公開設定生效、資料庫拒絕不合法的來源組合、老師端完成拒絕團主直接開團的課）12 passed。回歸（建課、完成、取消、報名、老師開課、公開列表、管理員課程、評價、合作邀請 4 個 spec）225 passed／1 偶發（`public-classes-discovery:120` mobile，`--repeat-each=3` 6 passed）。tsc（排除 `.next/dev/types`）、eslint、build 通過；測試使用 port 3200。
- [x] 文件：data-model、state-machines、state-transition-details、permissions-matrix、permissions、spec 13.6 標記落地與待補項目。
- [x] Codex 第 1 輪修正：團主與管理員的課程 DTO 加上 `origin`，團主列表／詳情顯示「找老師媒合／直接邀請合作老師」、管理員列表／詳情顯示「團主媒合／老師開課／團主直接開團」（`src/domain/class-session/origin-labels.ts`），團主列表說明改為兩種來源；補測試：開放時只排除自己的預留、另一份同時段已確認邀請仍會擋下；學員報名直接開團的課、團主取消與管理員取消都連帶取消報名；老師端完成也拒絕團主媒合的課、自己的課仍可完成；團主與管理員頁面顯示來源標籤。核心註解改正 `classSessionId @unique` 的保證方向。organizer-direct-class＋admin-class-session-management 44 passed（port 3200）；tsc、eslint、build 通過。
- [x] 獨立 review（Codex，2 輪後 APPROVED，範圍不含被擋住的兩個檢查）。
- [x] 本機 commit 已完成的範圍（未 push）。

<!-- codex-peer-reviewed: 2026-10-05T07:39:37Z rounds=2 verdict=approved -->
- [x] 越權測試：`organizer-direct-class.spec.ts` 新增一則——受邀老師對團主直接開團的課取消被拒（課程與報名不變）、對團主媒合的草稿課開放與取消都被拒（仍是草稿）、團主仍可取消、老師自己的課可開放與取消。回歸 17 個 spec 230 passed（port 3200）；tsc、eslint、build 通過。`teacher-profile-suspension` 的管理員暫停 UI 測試另有失敗（管理員頁面，與本票無關，已另開待辦）。
- [x] 同一輪：票 10 的「我已有合作老師」入口公開（移除 `DIRECT_CLASS_ENTRY_PUBLIC` 開關）。

<!-- codex-peer-reviewed: 2026-10-05T12:50:44Z rounds=1 verdict=approved -->
