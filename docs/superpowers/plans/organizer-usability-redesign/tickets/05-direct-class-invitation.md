# 05: 建立合作邀請並送給老師

**What to build:** 團主為自己的團體保存單堂安排，選 approved 合作老師，送出後到邀請詳情；受邀老師能看到自己的課程內容。

**Blocked by:** 03：我的團體與首次建團

**Status:** done（2026-10-05）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK、STATE_MACHINE_RISK

- [x] 獨立 OrganizerClassProposal 使用有界 typed 草稿欄位、version 與 own organization；保存後有穩定單筆 URL，不建立假 demand／response。
- [x] 新建／編輯頁可選自己的團體、選最小 approved teacher 名片；查詢不借用 admin 列表，不回傳私人 email／電話。
- [x] 送出前完整驗證課程、聯絡資料、老師資格、未來時間；表單／儲存以 Asia/Taipei 轉換起迄時間，風格選填不被誤設為必填。draft → pending_confirmation 後到單筆詳情，不能開放報名。
- [x] pending 不建立正式課程、不占老師時段；顯示等待老師確認與下一步，不暗示時間已保留。
- [x] 老師 own-read 邀請詳情有完整安排；團主只看自己邀請，其他老師／團主 ID 被拒；admin 不新增代確認能力。
- [x] 保存／送出失敗保留欄位、缺項定位；明確保存、補資料返回同 proposal ID、未保存離開保護；團體歸屬變更遵守 draft／送出邊界。
- [x] 測試草稿有界驗證、version、老師 lookup 隱私、非 own ID、非 approved／過期不可送出、pending 不占時段與手機送出；站內通知由第 12 票整合。

## 開工前核對（2026-10-05）

- **核准依據**：Q18：A（獨立 `OrganizerClassProposal`）；spec 第 7 節、13.2–13.4、13.8；本機開發 DB 可跑 migration。
- **Schema／migration**：新增 `OrganizerClassProposalStatus` enum 與 `OrganizerClassProposal` model（欄位、FK 刪除行為與 index 照 spec 13.2，含 `version`、`transitionSeq`、`submittedAt`、`classSessionId @unique`）；`OrganizerProfile`／`Organization`／`TeacherProfile`／`User`／`ClassSession` 只加反向關聯。純新增，不動既有資料；用 `prisma migrate diff` 產生 SQL、`prisma migrate deploy` 套用到 `freesoar_yoga_marketplace_dev`。本票不新增 `organizer_direct`（票 09）。
- **Rollback**：在有人建立邀請之前，forward migration 刪除該表與 enum 即可，沒有資料損失；程式 revert 本票 commit。
- **Domain**：`src/domain/organizer-class-proposal/`：草稿存檔（有界驗證、只有 draft 可存、`expectedVersion`、每次寫入 `version`／`transitionSeq` +1、`submittedAt` 為 null 才能換團體）、送出邀請（重用 `validateClassSessionCreate` 驗證完整度與未來時間、團體聯絡資料完整、老師 approved；不建立正式課程、不占時段、不做排課衝突檢查）、團主 own-read、受邀老師 own-read（看不到草稿）、`searchApprovedTeacherCards`（只回公開名片欄位）。
- **頁面（不加任何導覽或入口，入口在票 10 才公開）**：`/organizer/class-proposals/new`、`/[id]/edit`、`/[id]`；`/teacher/class-proposals/[id]`（唯讀，確認／婉拒是票 06）。
- **不做**：老師確認／婉拒（06）、pending 修改與撤回（07）、本人授課（08）、開放報名（09）、站內通知（12）、瑜伽類型輸入（選填，本票存空陣列）。
- **驗證**：草稿穩定網址與有界驗證、version、老師名片不含 email／電話且只列 approved、非 own 404、非 approved／過去時間／聯絡資料不完整不能送出、pending 不建立 ClassSession、老師看得到 pending 看不到 draft、失敗保留欄位、手機送出；tsc、lint、build、smoke。

## 執行紀錄（2026-10-05）

- [x] Schema：`OrganizerClassProposalStatus`、`OrganizerClassProposal`（照 spec 13.2）與反向關聯；migration `20261005000000_organizer_class_proposal` 以 `migrate deploy` 套用到 `freesoar_yoga_marketplace_dev`，`migrate diff --exit-code` 無 drift。純新增，沒有動到既有資料。
- [x] Domain `src/domain/organizer-class-proposal/`：草稿有界驗證；只有 draft 可存，`expectedVersion` 寫進 WHERE，每次寫入 `version`／`transitionSeq` +1（建立時 `transitionSeq`=1）；`submittedAt` 不為 null 不能換團體；存檔時選的老師必須 approved；送出重用 `validateClassSessionCreate`（課程風格必填、瑜伽類型不強制、開始時間必須在未來）、檢查團體 owner 與聯絡資料完整、老師 approved，成功後 `pending_confirmation`、第一次送出寫 `submittedAt`；不建立 ClassSession、不做排課衝突檢查。團主 own-read；受邀老師只看得到非草稿；老師名片查詢只回 approved 老師的公開欄位。
- [x] 新增 `formatTaipeiDatetimeLocal`（`src/domain/class-session/timezone.ts`，與既有 parse 互為反向）；這個檔案另有老師排課工作未 commit 的修改，commit 時只 stage 本票新增的函式。
- [x] 頁面：`/organizer/class-proposals/new`、`/[id]/edit`、`/[id]`、`/teacher/class-proposals/[id]`（唯讀）；沒有加任何導覽或入口。表單分三區、老師名片搜尋與選擇、缺項定位、送出前確認（團體、老師、時間、送出後效果）、第一次存檔換到 edit 頁、儲存並補齊團體聯絡資料、未儲存離開保護、儲存／送出／換頁中鎖住欄位。欄位說明改用 `aria-describedby`，不併進欄位名稱。
- [x] 測試：新增 `tests/smoke/organizer-class-proposals.spec.ts`（穩定網址、version 過期不覆蓋、送出流程與台灣時間換算、不建立正式課程、送出後不能進編輯頁、老師名片只列 approved 且不含 email、過去時間與老師失去資格被擋且欄位保留、團體聯絡資料不完整不能送出並可儲存後補齊返回、他人團主／他人老師 404、受邀老師看得到 pending 看不到 draft），desktop＋mobile 10 passed；測試清理改為先刪合作邀請（對團體與老師是 Restrict）。
- [x] 回歸：需求、團體、回應選擇、老師回應、建課、老師開課 7 個 spec 103 passed／1 偶發（需求送審導頁，`--repeat-each=3` 6 passed）。tsc（排除 OneDrive 同步造成的 `.next/dev/types` 產生檔問題）、eslint、build 通過。
- [x] Codex 第 1 輪修正：
  - 修改既有邀請一定要帶 `expectedVersion`，沒帶或不一致都回 `proposal_version_stale`，WHERE 也用呼叫端的 version（兩個 server action 都經過這裡）。這條是 domain 層的直接檢查，E2E 無法繞過表單省略 version，以程式為證據。
  - 送出失敗換到編輯頁時，編輯頁依資料庫裡的草稿重算欄位錯誤（`getProposalSubmitIssues`，與送出共用），錯誤仍可點擊定位（測試）。畫面上的缺項檢查加上「開始時間須晚於現在」，過去時間在送出前就被擋下並可定位（測試）；伺服器送出時仍會再檢查。
  - 團體資料完整時也提供「儲存草稿並編輯團體資料」；伺服器回報聯絡資料不完整時，這一頁改成視為不完整並出現「儲存草稿並補齊聯絡資料」（測試：載入後在別處清掉聯絡電話）。
  - 補測草稿有界驗證（名額 600 不存檔、欄位保留）與 `transitionSeq`（建立 1、存檔＋送出後 3）。
- [x] 釐清：課程風格（`serviceTypes`）送出時必填；選填的是瑜伽類型（`yogaStyles`，本票不提供輸入、存空陣列）。
- [x] 已知限制（沿用票 04）：瀏覽器「上一頁」在 App Router 下沒有可靠攔截點，離開保護只涵蓋關閉／重新整理與站內連結，留給票 14 一起評估。
- [x] 重跑 organizer-class-proposals 14 passed；tsc（排除 `.next/dev/types`）、eslint、build 通過。
- [x] 獨立 review（Codex，2 輪後 APPROVED）。
- [x] 本機 commit（未 push）。

<!-- codex-peer-reviewed: 2026-10-04T22:41:08Z rounds=2 verdict=approved -->
