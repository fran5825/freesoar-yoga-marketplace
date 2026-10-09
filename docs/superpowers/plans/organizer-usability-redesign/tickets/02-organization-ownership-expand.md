# 02: 多團體 ownership 相容擴充

**What to build:** 在多團體新流程尚未上線時，原有團主仍可註冊、提出需求與管理舊課程；資料安全地加入 owner 關聯。

**Blocked by:** 01：正式 contract 文件

**Status:** done（2026-10-04）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK

- [x] 此票為 expand–contract 的機械相容擴充例外；新增 nullable owner FK／index 與明確 relation，保留 legacy organizationId，不先公開未完成的多團體 CTA。
- [x] 只在測試資料庫驗證回填；舊 group ID、demand／class FK、歷史課程與既有單團體功能均保留。
- [x] 對照 legacy profile、需求及課程歸屬；重複或矛盾 owner 停止並回報可核對的 ID／筆數，不輸出私人聯絡資料、不默認挑第一人。
- [x] 無法判定 owner 的孤立團體保留 admin-only，不自動授權給任何團主；刪除行為不得讓另一團主接管。
- [x] 相容期的新增資料與 fixtures 有一致的 owner／legacy pointer；既有單團體讀寫仍能運作，後續多團體授權使用 owner。
- [x] 驗證新舊 relation 並存、migration 前後完整性、ambiguous owner 失敗及舊註冊／需求／課程回歸；更新正式文件的實作狀態。
- [x] 提供測試 DB 的 expand／rollback evidence；不重設資料庫、不 db push、不操作 production、不混入其他欄位清理。


## 開工前核對（2026-10-04）

- **核准依據**：Q18：A；spec 13.1；產品主人同意本機開發 DB 可跑 migration（不碰 production、不 db push、不 reset）。
- **Allowed files**：`prisma/schema.prisma`、新 migration 資料夾、`src/domain/organizer-profile/service.ts`（bootstrap 寫 owner、團體更新改用 owner 授權）、`src/domain/demand-request/service.ts`（建立需求時確認團體 owner 是本人）、`tests/smoke/_helpers/organizer-demand-fixtures.ts`、`tests/smoke/notifications-area.spec.ts`、`tests/smoke/review-average-rating-display.spec.ts`（fixtures 補 owner）、新增 owner 相關 smoke test、`docs/domain/data-model.md`／`permissions-matrix.md` 實作狀態、本票。
- **不動**：`src/domain/organizer-profile/admin-service.ts` 與其他 admin 檔案（有他人未 commit 的修改；legacy 反向欄位名 `organizerProfiles` 不改，所以不需要動）。
- **目標資料庫**：`npx prisma migrate status` 顯示 PostgreSQL `freesoar_yoga_marketplace_dev`（localhost:5432），dev server 與 Playwright smoke 共用；沒有其他環境。
- **執行前資料檢查（唯讀）**：1 個團體，候選 owner 恰好 1 位，0 個孤立、0 個歧義。
- **Migration 方式**：用 `prisma migrate diff`（只讀比對）產生 DDL，手寫歧義檢查與回填，最後用 `prisma migrate deploy` 套用；不用 `migrate dev`，避免它在偵測到 drift 時提示 reset。
- **Rollback**：在票 03 開放第二個團體之前，可用 forward migration 刪除 `ownerOrganizerProfileId`（含 FK、index）回到原狀，沒有資料損失；程式 rollback 為 revert 本票 commit。
- **驗證**：migration 前後團體／需求／課程筆數與 `organizationId` 不變；新 smoke test 驗證新團主 bootstrap 寫入 owner、他人無法更新不屬於自己的團體；既有 organizer／admin 相關 smoke 回歸；tsc、lint、build。

## 進度（2026-10-04，中斷點：用量上限）

- [x] schema：`Organization.ownerOrganizerProfileId`、relation name `OrganizationOwner`／`OrganizerLegacyOrganization`、index。
- [x] migration `20261004000000_organization_owner_expand`：歧義檢查排在 DDL 之前（已在會 rollback 的 transaction 內驗證，遇到歧義會中止，而且沒有留下任何資料）；已用 `migrate deploy` 套用到 dev DB；前後團體／需求／課程筆數與 `organizationId` hash 相同；1 個團體已回填 owner；`migrate diff` 沒有 drift。
- [x] `prisma generate`：型別與 client JS 已更新；engine dll 被執行中的 `npm run dev` 鎖住，沒有換新（版本沒變，不影響）；dev server 需要重開。
- [x] 程式：bootstrap 寫入 owner；`updateOwnOrganization` 與需求草稿存檔改用 owner 授權。
- [x] fixtures：helper／notifications-area／review-average 補上 owner；cleanup 也會清掉以 owner 關聯到測試帳號的團體。新增 `tests/smoke/organization-ownership.spec.ts`。
- [x] `npx tsc --noEmit`、`npm run lint`、`npm run build` 通過。
- [x] Codex 第 1 輪修正：`getOwnOrganizerContext` 在 owner 不是本人（含 null）時不回傳團體資料；需求草稿更新與送審都要求需求自己的團體 owner 是本人，聯絡資料完整度改看需求自己的團體。
- [x] Migration 補充證據（全部在會 rollback 的 transaction 內，跑完確認沒有留下任何資料）：回填涵蓋 legacy pointer、孤立團體維持 null、只由需求推定、只由課程推定四種情況，全部正確；rollback 演練（刪 FK、index、欄位）後既有團體／需求／課程筆數不變。
- [x] Prisma migration transaction 行為：本設計不依賴它。歧義檢查排在所有 DDL 之前，失敗時不會有任何變更；實際只在 dev DB 套用一次（無歧義），沒有觀察到失敗情境。
- [x] data-model／permissions-matrix 已改標票 02 落地的部分。
- [x] Playwright（port 3100）：完整 suite 692 passed／6 failed。6 個失敗中 4 個單獨重跑通過（偶發）；`teacher-profile-suspension.spec.ts:300` 兩個 project 都穩定失敗，失敗點是 admin 暫停老師的成功訊息，相關 admin 老師頁面有其他工作未 commit 的修改，本票沒有改到老師或 admin 程式，判定與本票無關，留給該工作處理。修正後重新 build，`organization-ownership` 4 passed，團主相關 spec（organizer-demand、profile-edit、demand-responses、usability、demand-cancellation、dashboard）全部通過。
- [x] `npx tsc --noEmit`、`npm run lint`、`npm run build` 於最終程式再次通過。
- [x] 獨立 review（Codex，2 輪後 APPROVED）：第 1 輪指出讀取仍走 legacy pointer、需求更新／送審未檢查實際團體 owner、migration 證據不足，皆已修正並補證據；第 2 輪 APPROVED。
- [x] 本機 commit（未 push）。

<!-- codex-peer-reviewed: 2026-10-04T14:04:41Z rounds=2 verdict=approved -->

後續相容狀態（2026-10-07）：[票 15a](15-organization-legacy-contract.md) 已核准並實作 owner-derived default／owner-only fixtures，bootstrap 暫留雙寫；驗證與獨立 review 見票 15。15b 尚未放行。此補記不改寫本票既有驗證／review 紀錄。
