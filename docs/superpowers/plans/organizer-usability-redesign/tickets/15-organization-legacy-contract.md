# 15: 舊團體欄位 contract 清理（首輪驗收後）

**What to build:** 新多團體流程已驗收且無呼叫點依賴舊單團體關聯後，安全移除相容橋接，使用者資料與操作保持一致。

**Blocked by:** 15a 前置已完成；15b 仍受票 14 的前置處置、recovery／SQL review／演練與確切 DB 授權阻擋。票 14 的真機鍵盤未驗證及既有失敗項須保留追蹤／接受紀錄，不能僅依 done 標籤宣稱全部 gate 通過。

**Status:** 15a done；15b done（2026-10-09：產品主人選 R1、同意 Docker 臨時庫演練後套用本機開發庫；演練與套用完成，受影響 smoke 結果見末節）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK

- [ ] 這是 expand–contract 最後的機械清理例外，排在首輪完整驗收後；不阻擋第 14 票交付。所有遷移批次透過 14 的前置完成。
- [ ] 開始前重新盤點所有 source、tests、fixtures、seed、DTO／admin queries 與文件：legacy organizationId 讀寫／relation 依賴為零，並提供 evidence，不能只搜尋名稱就聲稱安全。
- [ ] 若存在依賴，先列出未完成 migrate batch 並明確加入 blockers；不把殘留呼叫點遷移混進不可逆刪欄位票。
- [ ] 對已核准 owner 模型提出具體 contract migration、資料完整性／rollback 限制與驗證；需產品主人確認實際 destructive migration 風險後才執行測試 DB，不取得 production 授權。
- [ ] 只移除 legacy 關聯／pointer 與相容處理；多團體 owner、原組織 ID、historical demand／class FK、孤立團體 admin-only 語意保留。
- [ ] 測試 migration 前後完整性、首次建資料、兩團體需求／直接開團、admin owner、fixtures cleanup 與既有回歸；同步正式模型及相容狀態文件。
- [ ] 不混入 DemandRequest.serviceType 清理、多堂 series、角色或其他 schema 變更；無安全 contract evidence 時保持 expand 狀態並回報。

## 盤點結果（2026-10-06，只盤點、未做任何 schema 或資料變更）

### 結論

**目前不能安全移除 legacy pointer。** 正式程式碼還有 4 個檔案、測試還有 11 個檔案依賴 `OrganizerProfile.organizationId` 或 `OrganizerLegacyOrganization` 關聯。依本票規則，殘留呼叫點的遷移不混進刪欄位：先做不破壞資料的遷移批次 **15a**，再做破壞性 contract **15b**。

### 證據與方法（三種方法互補，不只搜尋名稱）

以下編譯器與 DB 統計為 Claude 原盤點紀錄；Codex 本輪人工追蹤 source／fixtures／schema 與反例，未重跑 schema-removal compile、未連 DB。它們不是本輪新通過的 checks，15a／15b 執行前須按當時 baseline 重新驗證。

1. **編譯器檢查**：在暫存資料夾複製 schema、拿掉 `OrganizerProfile.organizationId` 與兩側 `OrganizerLegacyOrganization` 關聯，產生獨立的 Prisma client（不碰共用 `node_modules`、不碰資料庫），再用暫存 tsconfig 把 `@prisma/client` 指向它，對 `src`、`tests`、`prisma` 做型別檢查：**14 個檔案、34 個錯誤**。
2. **型別間接使用搜尋**：編譯器漏掉經由手寫型別 `OwnOrganizerContext` 的讀取（型別仍宣告了 `organizationId`），另以 `organizerProfile.organizationId` 搜尋找到 `src/domain/demand-request/service.ts` 2 處。
3. **文字與 raw SQL 搜尋**：`organizerProfiles`（Organization 側關聯）、`OrganizerLegacyOrganization`、`"OrganizerProfile"` raw SQL；raw SQL 沒有使用。
4. **開發資料庫唯讀統計**：團主 1、有 legacy pointer 1、pointer 指向非本人擁有的團體 0、沒有 pointer 但擁有團體 0、擁有 2 個以上團體 0、pointer 不等於「本人最早建立的團體」0、團體 1、孤立團體（owner 為 null）0。

### 依賴清單

正式程式碼（15a 要遷移）：

| 檔案 | 用途 |
| --- | --- |
| `src/domain/organizer-profile/service.ts` | `getOwnOrganizerContext` 透過 legacy 關聯回傳「預設團體」（總覽聯絡資料提醒與連結、團主資料頁舊 `?next=` 轉址目標）；`organizerProfileSelect` 讀 `organizationId`；首次建立團主資料寫入 pointer。 |
| `src/domain/organization/service.ts` | `isDefault` 依 pointer 計算，給 `pickInitialOrganizationId`（需求／邀請表單預選）。 |
| `src/domain/demand-request/service.ts:207、217` | 存需求草稿時要求 pointer 存在，且未指定團體時以 pointer 為預設。**潛在問題**：pointer 為空但名下有團體的團主會被擋成「請先建立團主資料」（目前資料沒有這種人）。 |
| `src/domain/organizer-profile/admin-service.ts` | 管理員團主顯示合併「owner＋仍以 legacy pointer 連結的團主」。 |

測試與 fixtures（15a 一般資料改為只寫／只查 owner；bootstrap 相容／legacy 安全檢查例外見下方）：`tests/smoke/_helpers/organizer-demand-fixtures.ts`（建立時寫 pointer、清理用 `organizerProfiles`）、`_helpers/demand-response-fixtures.ts`（清理）、`organization-ownership`、`organizer-organizations`、`organizer-demand`（斷言 pointer）、`admin-organizations`、`notifications-area`、`organizer-self-teaching`、`review-average-rating-display`（建立時寫 pointer）、`member-dashboard`、`organizer-dashboard`（清理）。沒有 seed 檔。

文件分階段同步：15a 實作時同 change 更新 `docs/domain/data-model.md`、spec 13.1、`docs/superpowers/plans/2026-10-03-organizer-usability-redesign-plan.md`、本票與 `ticket-breakdown.md`，寫明「讀取改用 owner-derived default，bootstrap 暫留雙寫，舊欄位仍在」。15b 才改標欄位／relation 已移除。票 02／03 只補後續票引用，不重寫既有歷史驗證。**本輪只修改本票規劃，正式行為文件尚未改標已落地。**

### 15a：遷移批次（不刪既有資料、不改 schema；A 與 Builder 已批准）

- 把「預設團體」從 legacy pointer 改成 **本人擁有、最早建立的團體**（`createdAt asc`，同時間再以 `id asc`）。產品主人在 2026-10-06 選擇前輪選項 1，核准採 A 的 docs-only 規劃修正；不重問 A／B。原資料統計只表示上次盤點沒有差異，不保證所有未來資料行為不變。
- `getOwnOrganizerContext`、`listOwnOrganizations`／`getOwnOrganization` 的 `isDefault`、需求草稿的預設團體與「需要團主資料」判斷都改用 owner 查詢（順帶修掉上面的潛在問題）。
- 管理員團主顯示只看 owner（目前沒有「只靠 pointer 連結」的資料）。
- 首次建立團主資料仍在同一個 transaction 內寫 owner 與 pointer；一般 runtime 讀取、select 與 `OrganizerContextProfile`／`OwnOrganizerContext` 不再帶 legacy 欄位。這保留 bootstrap 相容寫入，但不保證退回舊程式後仍支援 pointer=null 的 owner-only 資料。
- 一般 fixtures 改成只寫 owner，清理以 owner 與本 spec 建立的 ID 為準；只有明列的 bootstrap 雙寫斷言／legacy 不一致安全測試可暫留有意的 legacy 檢查或注入，不能為追求編譯錯誤數而刪安全 coverage。
- 保留表單預選優先序：本人擁有的 requested ID → 本人擁有的既有 draft organization → derived default → null。兩個排序欄位在 context、list／detail isDefault 與需求／邀請預選保持一致；既有草稿與歷史 FK 不改成 default。
- 驗收以「一般 runtime legacy 讀取零、bootstrap legacy writer 一處、測試例外有完整清單」與 outcome tests 為準，不把「編譯器只剩 1 error」當唯一通過條件。完整 source-removal 編譯檢查與語意搜尋仍須執行，不能用 any、型別斷言或縮減 tsconfig 範圍掩蓋依賴。
- 15a 只改程式／測試與同步文件，不回填既有 pointer，不產生／套用 migration，不讀寫共享 DB 直到 fixture 操作取得確切授權；完整 checks／獨立 review 未通過前不標 done。

#### 15a rollback 邊界

- 依本輪 baseline 回復本票的 source／tests／docs diff，保留其他 task 修改；不執行 reset／clean，不刪 owner，不改 schema／歷史資料。
- 在 pointer=null 且有 owned organizations 的資料上，舊程式仍可能拒絕建立需求。需評估受影響筆數與行為，不能宣稱 code revert 等於完整功能回復，也不能擅自 backfill pointer。
- Fixture 清理只刪本輪獲准建立的資料；一般資料或其他 task 資料不屬 rollback。15a 無 destructive migration rollback。

### 15b：contract migration（破壞性；方案草案，仍受 Human Gate 阻擋）

1. 程式先移除首次建立時寫 pointer 的那 1 處與 schema 兩側關聯，編譯器檢查 0 錯誤。
2. Migration SQL 必須先經獨立 review；以下為待驗證設計，不是可執行授權：
   - 明列 `BEGIN`／`COMMIT`，guard 與兩個 DROP 在同一個 transaction；依 repo Prisma 6.x 行為，不假設 runner 自動包交易。交易前後需有受控寫入窗口，或在 guard 前取得保護 `OrganizerProfile`／`Organization` 的必要鎖；具體 lock 順序、timeout 與停止條件由 SQL review 核對。禁止其他 task、舊 server／client 在檢查後繼續寫 pointer／owner。
   - `DO` block 的比較必須 null-safe，例如以 `IS DISTINCT FROM` 檢查 pointer 與本人最早團體；最早團體使用 `ORDER BY "createdAt" ASC, "id" ASC`。guard 的確切條件依下方 recovery 決策定稿。異常訊息只列筆數，不列個資；pointer 指向非本人 owner（含 owner=null）、非空 pointer 無法推定對應 owned organization 時停止，不自動轉移／修資料。沒有被 pointer 依賴的孤立團體維持 admin-only，不因其 owner=null 一概阻擋。
   - `ALTER TABLE "OrganizerProfile" DROP CONSTRAINT "OrganizerProfile_organizationId_fkey";`
   - `ALTER TABLE "OrganizerProfile" DROP COLUMN "organizationId";`
3. 保留：`Organization.ownerOrganizerProfileId`、所有團體 ID、`DemandRequest`／`ClassSession`／`OrganizerClassProposal` 對團體的 FK、孤立團體只有管理員看得到的語意。
4. **Recovery 待產品主人決策，不能承諾從 owner 完整還原舊 pointer**：
   - R1：保存每筆舊 pointer（含 null）並演練原值回復；保存位置、敏感資料保護、保留時間與允許操作需另外批准。本票未授權 DB dump、新增備份表或額外 schema。
   - R2：不保存原值，嚴格要求每筆 pointer 與 derived default null-safe 相等；null＋owned 的資料也會阻擋，不能為過 gate 擅自回填。仍需限制回復窗口內的 owner 變動／新建資料，否則不能承諾逐筆原值重建。
   - R3：只提供功能性的 forward recovery，承認 null／舊值無法精確還原，經產品主人接受資料損失限制後再決定是否 contract。**本輪未選擇 R1／R2／R3。**
   - 任一回復都需重新加入 nullable 欄位、原 FK（`ON DELETE SET NULL`／`ON UPDATE CASCADE`）與相容程式，並驗證 schema／資料映射。Prisma migration 失敗紀錄與 schema rollback 是兩件事；不可自動 `migrate resolve` 或改 migration history。
5. 驗證：先在獲准的 disposable DB 以實際 runner 演練 guard failure、第一個 DROP 後故障、成功與 recovery；確認 schema／資料原子性與 `_prisma_migrations` 狀態。migration 前後比較團主／團體／孤立團體數，以及**逐筆團體 ID、owner、DemandRequest／ClassSession／OrganizerClassProposal 的 organization FK 映射**；保留可 review 的差異證據，不輸出個資。`prisma migrate diff` 無 drift 不代替資料完整性驗證。覆蓋 null＋owned、無 owner、錯 owner、非最早 pointer、同時間 tie；首次建立、兩團體需求／直接開團、admin 與 fixtures 清理／回歸需通過。
6. 只有 disposable DB 演練、15a 獨立 review、票 14 前置驗收處置、recovery 決策與 SQL review 完成，並取得下方確切目標／命令授權後，才可決定是否套用共享 dev DB。沒有 production 不等於 dev 資料可丟棄；production／preview／真實資料操作、`.env` 修改與未核准備份一律未授權。
7. 不混入 `DemandRequest.serviceType` 清理、多堂系列、角色或其他 schema 變更。

### 需要產品主人決定

- **15a default**：A 已確認；B 不採用。不重問相同選擇。
- **15a 實作**：已批准下方範圍／checks 與 local dev DB 的 scoped fixtures；執行紀錄見末節，不重問相同批准。
- **15b**：R1／R2／R3、具體 SQL／寫入隔離、確切目標 DB／命令／資料保護需分別確認；15a 的批准不涵蓋 15b。

## 歷史 docs-only 修正紀錄（2026-10-06；後續批准與執行見末節）

### Human Decision Record

- Decision needed：15a default A／B；本輪是否在 current task 修正規劃。
- Human decision：使用者回覆「1」，對應前輪「若同意 A，1＝在目前 task 執行」與 review 報告的 docs-only prompt。
- Accepted decision：A＝本人 owned organizations 的 `createdAt asc`／`id asc` 第一筆；只批准修改本票並產出 15a draft。
- Decision date：2026-10-06；沒有提供精確時間，不補造。
- Next allowed action：本輪 docs-only Builder；不進 source Builder、不連 DB、不跑 fixture、不批准 15b，不 commit／push／deploy。

### 可追溯工作清單

- [x] Claude 原方案由 Codex 獨立交叉檢查；原 verdict＝REQUEST CHANGES，不標 approved。
- [x] 記錄 default A 的人類決策與本輪 docs-only 範圍。
- [x] 保存本票 task-start 原位元組／manifest，保留原有未提交內容。
- [x] 修正 F1 recovery 承諾與 null-safe gate；列 R1／R2／R3，未替產品主人選擇。
- [x] 補 F2 transaction／受控寫入／runner failure 演練與 migration history 邊界。
- [x] 補 F3 15a 同 change 文件同步；正式文件尚未改標已落地。
- [x] 補 F4 DB authorization 欄位；未填／未驗證視為未授權。
- [x] 產出下方具體 15a Builder Prompt Draft。
- [x] 本輪 diff／read-back／連結與 self review 已檢查；checks 結果見下方與 local log。
- [x] 15a source／tests／docs Builder 範圍批准、fixture DB 授權與執行前重新盤點（後續使用者回覆 1，見末節）。
- [ ] 15a build／驗證／獨立 review；未實作不得勾完成。
- [ ] 15b recovery／SQL／DB 授權與破壞性演練；仍 blocked。

### Evidence

- 原審查報告：[Codex reviewer output](../../../../../.ai-runs/current/2026-10-06-ticket-15-codex-takeover-review/reviewer-output.md)；只對原方案做 REQUEST CHANGES，本次修正版尚未獨立 review。
- 本輪 run：`.ai-runs/current/2026-10-06-ticket-15-plan-fix/`（local-only，跨機 handoff 須另確認可讀）。
- Baseline：該 run 的 `baseline/task-start/docs/superpowers/plans/organizer-usability-redesign/tickets/15-organization-legacy-contract.md`；manifest／initial-status／initial-head 保存比較起點。
- Task-start SHA256：`32DD9940D53D9FF9562079179413F0503C2675E3B2C52B9E09DC07F06D50EEAC`；只歸因 task-start → task-end，不把 HEAD diff 中 Claude 原盤點算成本輪修改。
- Full patch：[本輪 task.patch](../../../../../.ai-runs/current/2026-10-06-ticket-15-plan-fix/patches/task.patch)。

### 本輪 Checks／Manual smoke

- 文件結構／檔案參照：15 個 Common Handoff 欄位、32 個 draft 檔案參照、3 個本機 Markdown 連結與兩段成對 code fence 已檢查；沒有未存在的 allowed file。
- 差異：已閱讀 task-start → 本輪修改的窄 diff；`git diff --no-index --check` 無 whitespace diagnostics（exit 1 表示有差異，非 checks 失敗）。原 wrapper 誤判 exit 1，修正判讀後重新通過。
- Git：既有 dirty／untracked 路徑清單保留；本輪唯一 tracked 修改是本票，沒有修改其他票或產品文件。
- Logs：`.ai-runs/current/2026-10-06-ticket-15-plan-fix/checks/docs-checks.txt`；patch 產生後再確認該連結可讀。
- TypeScript／ESLint／build／unit／E2E／DB／manual smoke／RWD：未執行，本輪只修文件、禁止連 DB 與 runtime work；不引用原盤點或票 14 結果宣稱新通過。

## 15a Builder Prompt（原 Draft；後續批准與確切 DB 紀錄見末節）

本 draft 依 [Builder template](../../../../harness/ai-runs-current-templates/03-approved-builder-prompt.md)；不代表預先批准 source 或 DB mutation。產品主人需批准 scope，並填妥 fixture DB 欄位後才可完整執行。A 已確認，不重問 Q1–Q19 或 A／B。

```text
請依 docs/harness/ai-runs-current-templates/03-approved-builder-prompt.md 執行票 15a Builder。
Status：原 Draft 歷史文字；後續批准範圍與實際 fixture DB identifier 以末節執行紀錄為準。15b 與 commit／push 未批准。
Workflow：HEAVY；單一 migrate slice；不接續 15b。

Goal／Accepted decisions：
- default A 已於 2026-10-06 確認：本人 owned organizations，createdAt asc／id asc 第一筆。
- 一般 runtime 移除 legacy pointer／relation 讀取與 DTO 依賴；bootstrap 暫留 transaction 雙寫。
- 保留現有 own-scoped permissions、state transitions、routes 與歷史 organization FK；schema／migration 不變。

權威文件：
- AGENTS.md
- docs/specs/organizer-usability-redesign-spec.md（13.1／owner 與單堂流程）
- docs/superpowers/plans/organizer-usability-redesign/tickets/15-organization-legacy-contract.md（15a 修正版）
- docs/harness/risk-based-workflow.md
- docs/harness/review-packet-spec.md
- docs/domain/data-model.md
- docs/domain/permissions.md
- docs/domain/permissions-matrix.md
- 原 review：.ai-runs/current/2026-10-06-ticket-15-codex-takeover-review/reviewer-output.md

Allowed files（只為本票目的修改；read-only inspection 不受此清單限制）：
Source：
- src/domain/organizer-profile/service.ts
- src/domain/organizer-profile/admin-service.ts
- src/domain/organization/service.ts
- src/domain/demand-request/service.ts
Tests／fixtures：
- tests/smoke/_helpers/organizer-demand-fixtures.ts
- tests/smoke/_helpers/demand-response-fixtures.ts
- tests/smoke/organization-ownership.spec.ts
- tests/smoke/organizer-organizations.spec.ts
- tests/smoke/organizer-demand.spec.ts
- tests/smoke/organizer-demand-organizations.spec.ts
- tests/smoke/organizer-class-proposals.spec.ts
- tests/smoke/organizer-profile-edit.spec.ts
- tests/smoke/admin-organizations.spec.ts
- tests/smoke/notifications-area.spec.ts
- tests/smoke/organizer-self-teaching.spec.ts
- tests/smoke/review-average-rating-display.spec.ts
- tests/smoke/member-dashboard.spec.ts
- tests/smoke/organizer-dashboard.spec.ts
Docs（同一 change 同步實作狀態，不重寫無關段落）：
- docs/domain/data-model.md
- docs/specs/organizer-usability-redesign-spec.md（13.1 與直接相關實作狀態）
- docs/superpowers/plans/2026-10-03-organizer-usability-redesign-plan.md
- docs/superpowers/plans/organizer-usability-redesign/ticket-breakdown.md
- docs/superpowers/plans/organizer-usability-redesign/tickets/15-organization-legacy-contract.md
- docs/superpowers/plans/organizer-usability-redesign/tickets/02-organization-ownership-expand.md（只補後續票引用）
- docs/superpowers/plans/organizer-usability-redesign/tickets/03-organization-management-onboarding.md（只補後續票引用）

Forbidden：
- 上述以外檔案；src/app 的表單／routes、Auth／session、通知觸發與 capability 模型。
- prisma/**、schema／migration、package*.json、tsconfig.json、Playwright／ESLint 設定。
- .env、credentials、production／preview、共享 server／DB 設定、其他 task 變更。
- 15b、pointer backfill、owner 修復／移交、DemandRequest.serviceType 清理、series 與額外模組。
- commit、push、deploy、reset、clean、stash、db push、migrate reset／resolve。

Implementation／Completion criteria：
1. 起手核對最新 source 與 legacy dependency inventory；先保存 allowed files 的原位元組 baseline／manifest，對既有 dirty 內容窄改。未知 dependency 超出清單時停下，不自行擴 allowed files。
2. profile context 只透過已驗證的 organizer profile 查 owned organizations；DTO／select 不再取 OrganizerProfile.organizationId／legacy relation。無 profile 與有 profile 但無團體的回傳語意維持清楚；不得因 pointer=null 誤判沒有 profile。
3. context、list／getOwnOrganization 的 isDefault 均採同一 createdAt／id 排序規則；WHERE 保留 owner。需求未指定團體時用 derived default，顯式 ID 必須 own；既有 draft 的 requested／fallback 優先序、status guard 與 FK 不變。
4. admin organization summary 僅顯示 owner，保留孤立團體的 admin-only／無 owner 表示；不修改 requireAdmin。
5. bootstrap 在同一 transaction 保留 owner＋legacy writer；正常 fixtures 只寫 owner。安全測試與 bootstrap 相容斷言的 legacy 例外逐處列明，不以 any／型別斷言掩蓋依賴。
6. 清理第二個團體與先刪 profile 的 fixture 時使用 owner 或本 spec 建立的 ID，保留 FK cleanup 順序與跨 owner guard，不刪非本輪資料。
7. spec／data-model／plan／tickets 同 change 說明 15a 已落地但 schema 仍保留；15b 維持 blocked。未通過 checks／review 前只記進度，不標 done。

Database Operation Authorization（批准前必填；placeholder 不算批准）：
- Authorization status：未授權；需填批准者、日期與本輪適用的決策原文／記錄。
- Target DB：未確認；填無 credentials 的確切 DB identifier、用途與 disposable／含真實資料分類。
- Isolation／target verification：未確認；列出實際目標核對方式、隔離證據、其他 task 未使用與 fixture 資料範圍。PORT 不證明 DB 隔離。
- Shadow DB：不使用；15a 不產生／套用 migration。
- Generate／Apply migration、backfill／seed：禁止，不適用於 15a。
- Fixture mutation：只批准下列 smoke specs 使用本 spec 產生的唯一測試帳號／ID 建立與 scoped cleanup；既有真實／其他 task 資料不得修改。確切 DB 與命令尚待授權。
- Data protection：確認 fixture 可清理／重建；保留原始資料，無 DB dump 或一般資料 rollback 授權。
- Client generation：schema-removal 檢查只產生本 run 的隔離 client，不連 DB、不覆寫共用 node_modules；若需套件下載、環境改動或共用 generate，停止另報。
- Stop：目標不明／不符、drift、reset／資料損失提示、fixture 越界／清理失敗、共享服務競爭；不換 DB 或加破壞性 flag 繞過。

Checks（完整成功後才能交付 15a done）：
- npx tsc --noEmit --incremental false -p .
  若生成型別／其他 worktree 的既有問題導致失敗，保留 log，不擅改 tsconfig 或把縮減範圍稱全專案 pass。
- npx eslint src tests
  記錄與 package lint 範圍差異；不因其他 worktree 打包產物擴修設定。
- 核准 fixture DB 後，用確認空閒的 PORT 執行一次：
  $env:PORT='<執行前確認空閒的 port>'
  npm run test:smoke -- 'organizer.*\.spec\.ts' tests/smoke/organization-ownership.spec.ts tests/smoke/admin-organizations.spec.ts tests/smoke/notifications-area.spec.ts tests/smoke/review-average-rating-display.spec.ts tests/smoke/member-dashboard.spec.ts
  organizer.* 的檔名 regex 涵蓋需求、邀請、revise／respond、直接開團、入口、通知、分享、資料編輯、總覽、journeys／narrow／keyboard 與 organizers-request；驗證前列明實際收集的 specs，不能以零收集當 pass。
  pretest:smoke 已 build，勿先重複 build。確保該 server 服務本次 build、不沿用別人的既有 server；結束還原本輪 PORT 值，不停他人 server。
- Outcome coverage：pointer=null＋兩 owned groups、same-createdAt tie、context／isDefault／兩表單一致、requested 與 draft fallback 優先、錯 owner／orphan 不洩漏、歷史需求 owner guard、admin only-owner、bootstrap 雙寫、第二團體 scoped cleanup。
- 390／1280 的需求／邀請／profile?next=／總覽與 admin 行為；320 無水平溢出；必要鍵盤與 error／empty states。真機鍵盤未測不得報通過。
- 隔離 schema-removal client／tsconfig 放在本 run，不動正式 schema／node_modules／DB；輸出完整檔案與診斷、intentional bootstrap／test exceptions 以及手寫 DTO／raw SQL 語意搜尋。正式 typecheck 必須通過，負面編譯探測的預期錯誤不可混報成它的 pass。
- Docs diff／read-back、連結、self review／scope drift、role／permissions／state／model／routes／brand／App-ready review。
- Builder self review 後另需獨立實作 review；不能用本輪對舊方案的審查代替，也不自動啟動其他 agent／task。

Baseline／Patch／Rollback：
- 使用新的獨立 .ai-runs/current/<run-id>/，保存 task-start baseline、manifest、checks 與完整 task patch，排除其他 task 的 HEAD diff。
- 寫入前核對預期版本；同檔外部變更無法歸因時停止。
- rollback 只回復本票 patch，不變 schema／owner／歷史 FK；pointer=null 的 owner-only 資料退回舊 code 後可能功能受限，禁止自行修資料。

Stop conditions：
- 超出 allowed files、新政策／permissions／state／schema／通知行為、需要改表單預選 helper 或新增檔案。
- DB／fixture 操作未批准、目標未知或其他 task 干擾；checks 修復需要擴 scope。
- legacy 依賴證據不完整、失敗無法在批准範圍內修復、任何 15b／不可逆操作。

Output Report Requirement：
完成後不要 commit／push。以繁體中文提供：
1. Changed files。
2. 相對本輪 baseline 的完整 diff／可讀 patch，不認領其他 task 修改。
3. Checks 命令、結果與 log；未跑／失敗如實記錄。
4. Manual smoke／RWD 結果與未驗證項。
5. Self review（V1、排除模組、roles／permissions／state／model／routes、security／brand、產品決策、無關檔案、未 commit／push）。
6. Scope drift check 與剩餘阻塞。
7. 正式 Builder packet 與完整 Common Handoff Schema；未驗證或未經獨立 review 不標完成、不接續 15b。
```

## 本輪 Self review／Scope drift

- Changed files：只有本票；local-only baseline／patch／checks 為證據，不進版控。其他 dirty／untracked 工作保留。
- V1：維持多團體 cleanup；未加入 Wellness／Academy／Retreat、AI matching、完整 payment／refund automation 或 native app。
- Role／permissions／state／model／routes：本輪未改 runtime contract；A 為已批准的後續實作規則。一般讀取仍須 own-scoped，孤立團體 admin-only、historical FK 不變；正式 docs 等 15a 實作時同步。
- Security：補 nullable recovery、transaction 與明確 DB gate；本輪未連 DB、讀 .env 或保存秘密／個資。15b recovery 選擇與 SQL 尚未批准。
- RWD／brand：無 UI 修改；保持低壓力預選與明確空狀態規劃，runtime／真機驗證未執行。
- Product owner decision：A 已確認；15a Builder scope／fixture DB 與 15b recovery／DB 操作仍需批准。不把 docs-only 授權當 source 放行。
- Unrelated files：沒有修改；未 auto commit／push／deploy。

## 歷史 Recommended Next Step — Common Handoff Schema（後續授權見末節）

- Level：L3。
- Recommended next work mode：Product Owner Decision（核准 15a Builder scope 與 fixture DB），之後才進 HEAVY Builder。
- Next smallest actionable slice：批准上方 15a draft 的實作範圍，補 fixture DB identifier／隔離／命令授權，完成 owner-only runtime 與 fixtures 遷移；不執行 15b。
- Why this should be next：A 已決定且 F1–F4 已落成可 review 的修正版；先取得非破壞性 15a 的完整驗證與獨立 review 才有 contract 前提。
- Can Codex execute directly：本輪 docs-only 已可完成；15a source／fixture DB 未批准，不能直接進實作。
- Suggested execution location：current task 優先；new task 亦可帶本票與本機 patch／review。
- Requires product owner decision：yes，僅新增的 Builder／fixture DB 邊界；不重問 A／B 或 Q1–Q19。
- Suggested next prompt：下方 Product Owner Decision prompt；15a Builder draft 位於本票上一節。
- Auto-continue allowed：本輪 docs diff／read-back／self review 可直接完成；source／DB／15b no。
- Auto-continue reason：只有本票文件修改已批准，完整 15a 執行還缺 scope／DB authorization。
- Stop condition triggered：source／DB 邊界尚未放行；docs-only 工作完成不等於實作 blocked failure。
- Notify human：yes。
- Notification reason：回報方案已修正、A 已記錄與下一個具體批准點。
- Approval noise reduction applied：yes，沿用 A／Q1–Q19，不逐項重問本輪 docs 修改。
- Approval boundary note：本輪僅文件；15a code、fixture mutation、15b、commit／push／deploy 均尚未批准。

### Suggested next prompt — Product Owner Decision

```text
請以 Product Owner Decision 模式處理票 15a，不重問已確認的 default A。
請依票 15 的修正版與 15a Builder Prompt Draft，列出批准實作範圍及 fixture DB 操作所需的一份精簡決策：
1. 核准範圍：本票 draft 的 source／tests／docs allowed files；保持 schema／migration、Auth、permissions、state、通知與 15b 不變。
2. fixture DB：請我提供／確認無 credentials 的確切 target identifier、用途、可丟棄與隔離證據；draft 的 smoke 命令與 scoped fixture 建立／清理是否批准。
3. 風險／rollback／checks：引用本票，不重抄；未知目標保持未授權，不因 localhost／dev／PORT 自行放行。
限制：本輪 read-only，不連 DB、不讀 .env、不改 source／tests／docs、不跑 fixtures，不 commit／push／deploy。
取得人類確認後才把 15a draft 轉為 Approved Builder prompt；不自動進 Builder 或 15b。
請以繁體中文輸出決策缺口、Next allowed action 與完整 Recommended Next Step。
```

## 15a Builder 執行紀錄（2026-10-06 開始，2026-10-07 接續）

### 授權與 baseline

- 產品主人在 Product Owner Decision 回合後回覆「1」：核准 15a draft scope／checks，使用 local `freesoar_yoga_marketplace_dev` 做 scoped fixture 建立／清理，確認資料可供測試且測試期間沒有其他 task 使用 DB；後續「請繼續」延續同一授權。這不涵蓋 15b、schema／migration、backfill、DB reset、commit／push／deploy。
- 執行前透過 runtime Prisma 唯讀確認 `current_database()` 符合名稱、設定 host 為 loopback、server port 5432、其他 active sessions＝0；Docker `freesoar-yoga-marketplace-postgres` 為 postgres:16 且運行中。未輸出 `.env` 或連線密碼。
- run：`.ai-runs/current/2026-10-06-ticket-15a-builder/`；起點 HEAD `a5c1ec24affe00e27311078dc3284e27f6a25b21`，共享 dirty tree。25 個 allowed files 的 task-start 全檔 baseline／SHA256 已保存，正式 task patch 只比較這個起點，不把其他任務的 HEAD diff 納入。
- source 4 檔：profile context／DTO 去除 legacy 欄位，owned relation 依 `createdAt asc`／`id asc` 取第一筆；organization list／detail 使用一致 default；需求無指定團體改用 context 的 owner default；admin 摘要只列 owner。bootstrap 交易仍保留唯一 legacy writer。
- tests 13 檔：一般建立／清理改 owner-only，補 tied-createdAt、null pointer＋兩團體、requested／draft 優先、邀請預選、context 導向、錯 owner／orphan 隱私與第二團體清理；保留有意 legacy 安全注入及 bootstrap 雙寫斷言。`organizer-class-proposals.spec.ts` 在 allowlist 但不需要修改，既有 coverage 直接驗證。
- docs 7 檔：data-model、spec 13.1、plan、ticket-breakdown、本票與票 02／03 後續引用同步，歷史 review marker 不作本輪 review。

### 清單與驗證

- [x] Human Gate、確切 fixture DB／執行前隔離查核、task baseline。
- [x] owner-derived runtime／DTO、owner-only fixtures、admin only-owner。
- [x] 同 change 同步 docs；15b 保持 blocked。
- [x] 全專案 `npx tsc --noEmit --incremental false -p .` 與 `npx eslint src tests` 通過；lint 範圍為 src／tests，不把共享 `.ai-runs` 產物納入或改 lint 設定。
- [x] 空閒 PORT=3605、CI=1；`npm run test:smoke -- 'organizer.*\.spec\.ts' tests/smoke/organization-ownership.spec.ts tests/smoke/admin-organizations.spec.ts tests/smoke/notifications-area.spec.ts tests/smoke/review-average-rating-display.spec.ts tests/smoke/member-dashboard.spec.ts`。pretest build 通過，未沿用其他 server。收集 278 項、277 passed／1 skipped（320px 案例只在 mobile project 跑，desktop 為有意跳過）。桌機／手機 journeys、keyboard、320px 無溢出均通過；真機鍵盤未測不宣稱通過。完整 spec 清單／log 見 run。
- [x] `domain-outcome-check.cjs` 載入實際 service／validation，mock Auth／Prisma，不連 DB：無 session／profile／owned group、context 不暴露 pointer、list／detail default、owner guard、未指定團體 fallback、指定團體優先、既有 draft FK 不改與 draft 狀態守衛通過。
- [x] 以本 run 的隔離 schema／client／tsconfig 探測；沿用全專案 include／exclude，不縮減範圍、不改正式 schema／node_modules。最新 control client（未刪欄位）通過；刪欄位 probe 的預期診斷及差異清單見 `checks/negative-compile.log`。負面探測不是正式 typecheck pass。
- [x] 一般 runtime legacy 讀取零；writer 一處：profile service 的 bootstrap。測試例外限 `organization-ownership.spec.ts`（orphan／錯 owner 注入、bootstrap select／斷言）與 `admin-organizations.spec.ts`（無權者 pointer 注入）。手寫 DTO 不含 pointer；沒有以 raw SQL 使用 profile legacy pointer。
- [x] Builder self review：V1 scope／capability／own-scoped guards／marketplace 狀態與歷史 FK 保持一致；無新 Auth、角色、route、payment、AI matching、native app、Wellness／Academy／Retreat。UI layout 未改；RWD／品牌既有旅程驗證通過。只修改 allowed source／tests／docs；其他 task 的修改保留，未 auto commit／push。
- [x] 獨立實作 review：後續產品主人分別批准新 session 與 F1 補件／同 session 複查，第 2 輪 APPROVE；F1 歸屬／rollback 問題已解除，詳末節。此為新實作 review，不引用舊方案 review 作批准。
- [ ] 票 14 真機鍵盤／既有失敗處置、15b recovery／SQL／DB 放行；未包含於本輪。

### 共享變動與交接限制

檢查期間其他工作寫入 `prisma/schema.prisma` 與 teacher series 相關檔案／migration；本 task 未修改它們，也不回復或處理其他 DB 操作。第一輪隔離 client 遇到當時 series schema／generated client 不一致，完整診斷保存為 `negative-compile-first.log`；最新 schema 的 control／negative probe 另行重跑。277 項 smoke 是當次 build 的證據，不宣稱涵蓋其他 task 在它之後的變更。正式整合／commit 前要凍結共享變動再核對。

完整 Builder Review Packet：`.ai-runs/current/2026-10-06-ticket-15a-builder/builder-review-packet.md`；task patch／file manifest／checks 同 run。Rollback 僅依 task-start baseline 回復本票差異，保留他人修改；不 reset／clean、不修資料或回填 pointer。下一步為獨立 Reviewer，只讀本票 patch／evidence，之後才處理 15b 決策。

## F1 歸屬證據補件（2026-10-07）

獨立 reviewer session `01a114bd-f08a-7e10-99e1-657277c15de0` 已完成，原始 report 位於 run 的 `review-44252a5863e442ecbc49c30f1e2fd50d/reviewer-output.md`，exit 0、REQUEST CHANGES。未發現 15a runtime blocking bug；唯一 blocker 為 raw task patch 混入 data-model 的 teacher series／member-flow hunks，不能當作只含 15a 的 rollback patch。歷史 packet 的歸屬宣告以新增補件更正，不覆寫歷史材料、不回復他人修改。

產品主人回覆「1」核准 F1 證據 Builder 與同一 reviewer 複查。新 run 子目錄：`attribution-fix-58189bc1111043f48fd0c2f2663a84cc/`；除本票短進度之外只新增 evidence，不改 runtime／tests／共享 data-model，不操作 DB、不進 15b、不 commit／push。

- [x] 保存原 review，核對 F1 的四個外部 hunks 與兩個 organizer hunks。
- [x] 核對其餘 23 個變更檔的 hunk 歸屬：原始 56 hunks，52 屬 15a、4 屬外部 context；更正 packet 與新 patch 另存補件子目錄，原始材料不覆寫。
- [x] 暫存副本演練通過：24 檔兩種順序 byte-exact 重組、rollback 精確保留 external-only 內容與 stale hash 拒絕；四份可讀 patch 的 git apply check／實際套用亦通過。
- [x] 同一獨立 reviewer 唯讀複查：第 2 輪 exit 0、APPROVE，F1 已解除且無新 blocking finding；15a 標 done，15b 仍 blocked。
- [ ] 15b recovery／SQL／DB 決策及票 14 前置處置，仍未放行。

### F1 收尾與最新批准紀錄

新 report：補件子目錄的 `review-recheck-14ecebb5217449f9ae79c587c7115957/reviewer-output.md`。CLI resume 原 session `01a114bd-f08a-7e10-99e1-657277c15de0`、exit 0、新 report 非空，verdict APPROVE，Required changes=None。Reviewer 自行唯讀核對 121 個補件檔／67 個原始證據 hash、96 個 state hash、24 檔兩種重組順序、精確保留 external-only 的 rollback、stale hash 拒絕及可讀 patch 的 96 個文字目標；無修改檔案或操作 DB。

原始混合 `task.patch` 只保留作歷史 raw context，不能整份逆套；新 `15a-review.patch`／`15a-rollback.patch`、hash-guarded byte patches 與 `builder-packet-addendum.md` 是修正版材料，僅適用其指定 snapshot。這次收尾只更新本票狀態／checks與新增 evidence，並另保存收尾票進度的前後差異；不覆寫原 snapshot／packet／review。15a done 不代表後續共享 tree 已通過整合驗收、可 merge 或有 commit／push 授權。

下一步為 15b 的 Product Owner Decision／planning-only：先處理 recovery R1／R2／R3、票 14 未驗證項、SQL／寫入隔離與確切 disposable DB 演練授權。沒有批准前維持 expand，不操作任何 DB，不產生／套用 migration。

## 15b R1 docs-only 規劃（2026-10-07）

### 最新 Human Decision

- 產品主人回覆「1」，對應前輪「若同意採 R1 做上述文件規劃，1＝在目前 task 執行」。**R1 規劃方向已選定**；只批准修改本票及新增 planning evidence。先前「R1／R2／R3 未選定」保留為歷史狀態，不再代表最新決策。
- Next allowed action：R1 docs-only Planning；不連 DB、不實際備份、不修改 source／prisma、不生成或套用 migration、不做 fixture／backfill／reset、不 commit／push／deploy。
- 15a done；**15b implementation 仍 blocked**。保存位置／保護／保留期限／精確回復窗口、SQL review、disposable DB 演練與確切 target／commands、票 14 前置處置尚待批准／完成。不得將 R1 方向確認當成一併放行。
- run：`.ai-runs/current/2026-10-07-ticket-15b-r1-planning/`。引用既有 15a APPROVE，不重建實作證據，不逆套舊 raw task.patch。

### 本輪任務清單

- [x] 保存 task-start baseline／scope，保留既有 dirty tree。
- [x] R1 逐筆保存、保護／保留與精確回復窗口草稿。
- [x] SQL transaction／guard／locks／recovery 草稿；明列 runner 待驗證，不假設 Prisma 自動包交易。
- [x] disposable DB 失敗／成功／recovery 演練矩陣與逐筆完整性比較。
- [x] target／command／資料保護授權缺口，區分演練與共享 dev。
- [x] Planning Review Packet、read-back／task diff／self review 與完整 handoff。
- [ ] 後續獨立 planning／SQL review；本輪不執行。
- [ ] 精確 DB 授權、演練、票 14 前置處置、source Builder 與實際 migration；本輪不執行。

R1 的 exact recovery 僅承諾尚未重新開放寫入且逐筆 profile／organization／owner／歷史 FK 與 cut snapshot 相同的窗口。七天保留是待批准建議，不等於七天可精確 rollback；重新開放寫入後，新增／刪除資料或 owner 變動須重新評估並另批准，禁止自動補值。票 14 的真機鍵盤及歷史管理員失敗仍需新證據或接受／追蹤紀錄，不由本輪代為關閉。

## R1 Offline Codec Builder（2026-10-09）

- 使用者回覆「1」，批准前輪 A offline Builder；只用 synthetic 資料及使用者範圍 DPAPI，於目前 task 執行。run 名稱依核准 prompt 保持 `.ai-runs/current/2026-10-08-ticket-15b-r1-offline-codec/`，實際執行日期為 2026-10-09。
- Allowed：run 下 codec／tests／README／packet／baseline／patch／checks／manifest；本票僅追加授權／清單／結果。禁止 DB、container、SQL／backup／migration／seed、source／正式 Prisma／設定／package／.env／node_modules、repo 外直接寫入、舊 evidence 修改、commit／push／deploy。
- 引用 R1 planning 獨立 review：fresh session `01a1163c-0871-7471-9866-b1272b3bdd25`，exit 0、APPROVE、無 blocking finding；只批准 planning，不放行操作。之前未勾 review 清單是該輪歷史狀態；本輪新增引用，不覆寫歷史 evidence。
- 15b DB contract 仍 blocked；正式保護／retention／window、DB targets／commands及票 14 disposition未批准／完成。

### 本輪清單

- [x] 保存 task-start bytes／scope／共享 dirty tree 背景。
- [x] 實作 synthetic-only schema／checksum／DPAPI codec，無明文 fallback。
- [x] null／empty／duplicates／readback／corruption／missing／wrong target／window tests。
- [x] native DPAPI current-user roundtrip及錯身分失敗處理；跨身分實測另標未驗證。
- [x] task-relative full patch、read-back／self review／scope drift與完整 Builder packet。
- [ ] 獨立 codec implementation review；本輪不自動啟動。
- [ ] 真實 export／DB／migration與票 14 gate；本輪不執行。

### 本輪結果／限制

- 初次31項通過；self review補固定checks根目錄與pathresolve去敏後，33項通過（exit0）；完整logs與命令在run checks。實際current-user DPAPI roundtrip與無效native blob拒絕已測；錯身分只mock失敗處理，跨Windows身分實測、ACL／正式保存位置／retention／停寫／DB／Prisma仍未驗證。
- Codec只接受synthetic IDs；pointer含null保留，不作owner推定／default回填。只寫run checks下新加密envelope／synthetic負面fixture，沒有明文mapping檔或stdout；沒有DBcapture／restore／SQL／container／Prisma／source／設定變更。
- Builder完成，不等於15b contract完成；尚待獨立implementation review。完整task patch、manifest、Builder Review Packet見本run；未commit／push／deploy，不自動接續DB。

## R1 Synthetic Storage Preflight Builder（2026-10-09）

- 最新明確授權「請執行」：執行前述 synthetic storage Builder；側聊只釐清，不作批准。只修改本票追加紀錄、新 run，及指定外部新目錄的 synthetic envelope／metadata／初始 ACL，不放行 real export／DB／migration。
- run：`.ai-runs/current/2026-10-09-ticket-15b-r1-storage-preflight/`；exact target／commands／stop conditions／baseline 見 approved-builder-prompt.md。
- 新鮮只讀核對既有52項 codec evidence 全部一致；codec獨立 review APPROVE只限synthetic品質。前輪未勾review保留為歷史狀態，不冒稱目前尚未審查。
- [x] 保存 task-start ticket bytes／dirty-tree 背景／reference hashes，確認 current profile／SID、目標未存在及祖先無 reparse。
- [x] 實作固定 target 的 ACL helper／synthetic adapter；24 unit tests 通過，PowerShell syntax 通過。
- [ ] native secure-directory／DPAPI null＋empty roundtrip、file ACL 與 existing parent ACL 不變核對。
- [ ] task-relative patch／manifest／self review／完整 Builder packet。
- [ ] 獨立 implementation review；本輪不自動啟動。
- 真實資料 retention／freeze／restore／DB／migration及票14前置處置仍 pending；未 commit／push／deploy。

### Storage preflight 收尾：PARTIALLY COMPLETED／STOP

- native CLI exit1，`acl_operation_failed`，未完成DPAPI／new leaf-file ACL驗證；不是APPROVE。直接shell Inspect成功、Python subprocess Inspect失敗，根因未證實。
- STOP後只讀確認指定外部leaf與三層父目錄均不存在，無外部寫入或ACL變更；24 unit tests／PowerShell syntax通過不取代native結果。
- 產品主人最新要求「請盡快收尾」；立即停止診斷與重試，只保存本run packet／task-relative patch／hash evidence，不啟動reviewer或下一切片。
- [x] 保存本次成功／失敗結果、self review、baseline／patch／完整Builder closeout；native與獨立review維持未完成。
- 15a done保留；15b contract未執行。未連DB、不做realexport／migration、不commit／push／deploy；本task停止於此。

## 15b 執行紀錄（2026-10-09，Claude）

產品主人決定：Recovery 採 **R1**（套用前保存每筆原值）；**先在 Docker 臨時庫演練，通過後套用本機開發庫**。沒有正式環境。

- [x] 程式：移除 `organizer-profile/service.ts` 首次建立時寫 pointer 的 1 處；schema 移除 `OrganizerProfile.organizationId` 與兩側 `OrganizerLegacyOrganization` 關聯。拿掉後 `tsc` 0 錯誤；raw SQL 搜尋沒有其他依賴。
- [x] 測試：`organization-ownership.spec.ts` 移除兩處 pointer 安全注入（原本要驗的「看不到／改不到別人的團體」照常驗）、bootstrap 測試改驗新團主擁有剛建立的團體；`admin-organizations.spec.ts` 移除第二位團主的 pointer。兩個測試名稱去掉 legacy pointer 字樣。
- [x] Migration `20261009120000_drop_organizer_profile_legacy_organization`：明列 `BEGIN`／`COMMIT`、`LOCK TABLE ... ACCESS EXCLUSIVE`、`RAISE NOTICE` 只記筆數（R1 已保存原值，不阻擋），再 DROP FK 與欄位。
- [x] R1 程式：`prisma/recovery/organizer-15b/snapshot-organizer-pointer.mjs`（只存 id）、`restore-organizer-pointer.mjs`（檢查 DB 名稱一致、加回欄位與原 FK、逐筆寫回並比對）。
- [x] Docker `postgres:16` 臨時庫演練（`.ai-runs/organizer-15b/rehearse.sh`）：套用前 28 個 migrations；情境含正常、pointer 為空、指向別人的團體、指向無 owner 團體。第一個 DROP 後注入錯誤 → 欄位與 FK 都還在（整批退回）；實際 `prisma migrate deploy` 成功、欄位移除、`migrate status` 無 drift；團體 id／owner 對照前後相同；還原 4 筆 mismatched=0。容器已移除。
- [x] 本機開發庫 `freesoar_yoga_marketplace_dev`：套用前確認只有本 migration 未套用、沒有執行中的 dev server；快照存 `.ai-runs/organizer-15b/dev-snapshot-20261009-105653.json`（1 位團主、1 筆 pointer）；`migrate deploy` 成功；團體數、無 owner 數、團主數，以及團體 owner、需求與課程的團體對應 hash 前後完全相同。
- 還原方式：`node prisma/recovery/organizer-15b/restore-organizer-pointer.mjs <快照檔>`，再 `git revert` 15b 的 commit；`_prisma_migrations` 紀錄需另外處理，不自動 `migrate resolve`。
- 注意：在本次之前就啟動、仍在執行的 dev server 用的是舊版 Prisma client，讀團主資料會出錯，重開即可。
- [x] 受影響 smoke（`PORT=3100 CI=1`，沿用 15a 範圍：`organizer.*`、`organization-ownership`、`admin-organizations`、`notifications-area`、`review-average-rating-display`、`member-dashboard`，desktop＋mobile）：276 passed／1 failed／1 skipped（17.6m）。失敗為 mobile `organizer-demand.spec.ts:395` 送出後 5 秒內未見提示（desktop 同案例通過）；重新 build 後單獨重跑 desktop＋mobile 皆通過，判定為負載下逾時，與 15b 無關。`npm run lint` 通過。
