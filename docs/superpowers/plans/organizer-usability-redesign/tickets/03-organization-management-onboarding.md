# 03: 我的團體與首次建團

**What to build:** 團主可以同帳號管理多個公司／社團，個人資料與每個團體的聯絡資料各自清楚；第一次建立仍用一頁完成。

**Blocked by:** 02：多團體 ownership 相容擴充

**Status:** done（2026-10-04）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK、LOW_PRESSURE_UX_RISK

- [x] 首次建立個人資料＋第一團體在同一 transaction 完成，失敗不留下半筆；legacy pointer 過渡期有明確相容值。
- [x] 個人資料頁只管理團主本人資料；我的團體列表首屏可新增，單筆可編輯名稱、聯絡資料，列表只回傳自己的團體。
- [x] 新團體可保存未完整的資料；需求送審／邀請送出前仍檢查聯絡完整度，第一團體 onboarding 必須完整。
- [x] 老師可用同帳號建立團主能力並建團，沿用一般團主 onboarding；approved 資格只限制授課，不限制建團。切換角色不授予老師額外團體管理權。
- [x] 伺服器以 owner 驗證讀／寫；偽造其他團體 ID 被拒，孤立資料不顯示，列表／詳情無聯絡資料洩漏。
- [x] 保存／驗證失敗保留輸入，必填與選填清楚，320px 無溢出、390px 可完成新增／編輯、鍵盤可操作。
- [x] 驗證首次 bootstrap 失敗、同帳號兩團體互不覆寫、他人 ID、舊資料、窄 admin owner 顯示及 fixtures 相容；不加刪除、移交、多人共管或團員名冊。

## 開工前核對（2026-10-04）

- **核准依據**：Q1–Q19、spec 第 3.3、4、5、6 節與 13.1、13.4；不需要 schema 變更。
- **做法**：
  - 新增 `src/domain/organization/service.ts`：`listOwnOrganizations`、`getOwnOrganization`、`createOwnOrganization`（名稱與類型必填，聯絡資料可以先不完整）、`updateOwnOrganization`（以 id＋owner 授權）；原本 `organizer-profile/service.ts` 的單團體 `updateOwnOrganization` 移除。
  - 新增 `/organizer/organizations`（列表與聯絡資料完整度，首屏可新增）、`/organizer/organizations/new`、`/organizer/organizations/[organizationId]`（編輯；`returnTo` 走既有 `sanitizeOrganizerReturnPath`）。
  - `/organizer/profile`：首次建立維持一頁；已建立後只編輯團主顯示名稱，並列出我的團體摘要。舊連結 `/organizer/profile?next=` 轉到預設團體的編輯頁，帶同一個返回路徑，讓需求表單「補資料」流程不中斷。
  - 表單改用 `useActionState`：儲存或驗證失敗時留在原頁、保留輸入。
  - 導覽加上「我的團體」；需求表單的聯絡資料提醒與總覽的補資料連結改指向團體編輯頁。
- **Allowed files**：上述 domain 與 `src/app/organizer/**`（profile、organizations、demands 的提醒元件與兩個需求頁、dashboard 連結、OrganizerShell）、相關 smoke spec（organizer-demand、organizer-profile-edit、新增 organizations spec）、route-map／data-model／permissions-matrix 的落地標記、本票。
- **不做**：刪除、移交、多人共管、團員名冊；需求表單選團體（票 04）。
- **Rollback**：沒有 schema 或資料變更，revert 本票 commit 即可。
- **驗證**：兩個團體互不覆寫、他人 ID 回 not-found、驗證失敗保留輸入、首次建立仍一頁、approved 老師可用同帳號建團、補資料返回流程、390px 可完成新增／編輯、320px 無水平溢出；tsc、lint、build、相關 smoke。

## 進度（2026-10-04）

- [x] `src/domain/organization/service.ts`：list／get／create／update 都以 id＋owner 授權；移除舊的單團體 `updateOwnOrganization`。首次 bootstrap 沿用票 02 的單一 transaction（同時寫 owner 與 legacy pointer）。
- [x] 新頁面 `/organizer/organizations`、`/new`、`/[organizationId]`；團主資料頁只編輯顯示名稱並列出團體摘要；舊 `?next=` 轉到預設團體編輯頁；導覽新增「我的團體」；需求表單提醒與總覽補資料連結改指向團體編輯頁。
- [x] 首次建立、團體新增／編輯、顯示名稱都改用 `useActionState`：失敗時留在原頁、保留輸入（smoke 驗證團體與首次建立兩種）。
- [x] 新增 `tests/smoke/organizer-organizations.spec.ts`（兩個團體互不覆寫、部分聯絡資料可存、保留輸入、首次建立失敗不留半筆、approved 老師同帳號建團、320px 四個頁面無水平溢出）；更新 organizer-demand、organizer-profile-edit、organizers-request、organization-ownership 的對應斷言。
- [x] Checks：`npx tsc --noEmit`、eslint、`npm run build` 通過；Playwright（port 3100）organizer 相關 7 個 spec：76 passed／6 failed → 4 個是測試選擇器或舊斷言（已修正），`organizer-usability.spec.ts:219`（需求表單日期，本票沒有改動）只在 mobile 失敗一次；重跑 14 passed。
- [x] 鍵盤與 aria：表單錯誤用 `role="alert"`＋`aria-live`，列表卡片整張是可聚焦連結並有 focus ring。390px 由 Playwright mobile project 實際完成新增／編輯旅程。
- [x] Codex 第 1 輪修正：
  - 組織類型 select 在失敗回傳後會被 React reset 成舊值 → 用 `key` 依回傳值重新掛載；新增、編輯、首次建立三種表單都驗證「失敗 → 修正 → 重送」後類型正確。
  - 後台團體列表的團主改成 owner＋仍以 legacy pointer 連結的團主（去重），只有 owner 的團體也找得到、顯示得出團主。`admin-service.ts` 有其他工作未 commit 的 `_count` 修改，本票只 stage 自己的行（`-U0` patch）。
  - 長英文團體名稱：標題與摘要連結加上 `min-w-0`／`overflow-wrap:anywhere`；320px 測試改用不能斷行的長英文名稱。
  - 需求編輯頁的補資料提醒改看這筆需求自己的團體（經 owner 驗證），與送審檢查、補資料連結一致。
  - 新增「從自己合法的編輯表單把 organizationId 改成別人的團體」寫入測試：被拒絕，雙方資料都不變。
- [x] 首次建立的原子性：`createOwnOrganizerProfileWithOrganization` 用單一 `prisma.$transaction` 建立團體、團主資料並寫入 owner；E2E 只能驗證「驗證失敗不留資料」，transaction 中途失敗無法在不加 production test hook 的情況下觸發，這部分以程式結構為證據。
- [x] Rollback：本票沒有 migration，revert commit 即可；但票 03 上線後團主可能建立只有 owner 的第二個團體，從這時起不能再刪除 owner 欄位（票 02 記錄的截止點）。
- [x] 重跑：organizer-organizations、organization-ownership、organizer-demand、admin-organizations、organizer-profile-edit、organizers-request、organizer-dashboard、organizer-usability 全部通過（50＋72 passed）；tsc、eslint、build 通過。
- [x] 獨立 review（Codex，3 輪後 APPROVED）：第 2 輪接受「中途失敗不另加 production test hook」的反駁，並指出存檔成功提示的長名稱溢出（已修正並納入 320px 測試）；第 3 輪 APPROVED。
- [x] 本機 commit（未 push）。

<!-- codex-peer-reviewed: 2026-10-04T14:51:51Z rounds=3 verdict=approved -->
