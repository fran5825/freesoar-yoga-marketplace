# 08: 團主本人授課

**What to build:** approved 老師兼團主可在團主安排中明確確認自己授課，免去切換身分再接受自己的邀請。

**Blocked by:** 06：老師確認／婉拒與共用排課保護

**Status:** done（2026-10-05）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK

- [x] 同 User 的 organizer／approved teacher 能選自己的老師名片，顯示明確『由我授課並確認』動作，不能僅靠 teacher ID 判定同意。
- [x] draft 自確認沿用完整度、future、approved、latest version 與共用排課鎖／衝突 guards，成功保存同一份確認 metadata。
- [x] 非 approved 老師不得自授課；不新增角色、teacher 建團權限或繞過團體 ownership。
- [x] 自確認接受的是當下版本；confirmed 內容異動由第 7 票整合失效／釋放／再確認，本票不提前曝光未完成的 confirmed 編輯；轉課後不可編輯。
- [x] 不產生重複的自邀請／待我確認 UI，通知整合不得通知自己接受自己的邀請。
- [x] 測試同帳號能力、未 approved、衝突、自確認重試與版本守衛；異動失效於第 7 票完成後由整合驗收涵蓋。團主畫面可完成自確認，更新已核准的 permission／state 說明。

## 開工前核對（2026-10-05）

- **核准依據**：spec 第 3.2 節（本人授課要明確確認）、13.3 的 `draft → confirmed（本人授課）`、13.5 鎖順序；沒有 schema 變更。
- **做法**：
  - `respond-core.ts` 新增 `selfConfirmProposalCore`：只有團主本人、且邀請選的老師就是團主自己的 TeacherProfile（同一 User）才可以；鎖老師（撞課檢查）→ 鎖邀請 → 鎖內重驗 draft、version、老師沒變、老師 approved、團體 owner 與聯絡資料完整、內容完整與未來時間；成功後 `confirmed`，寫入確認資料（確認者＝本人）並設定 `submittedAt`（之後不能換團體）。
  - `submitOwnProposal` 拒絕「把邀請送給自己」，引導使用本人授課，避免自己邀請自己。
  - 表單：老師名片搜尋標示「你自己」；選自己時主按鈕改為「由我授課並確認」，確認畫面說明會保留自己的時段。團主詳情顯示「你已確認由自己授課」。
- **不做**：通知（票 12 會跳過本人）；修改已確認內容由票 07 既有規則處理（回到草稿、釋放時段）；開放報名（票 09）。
- **Rollback**：revert 本票 commit。
- **驗證**：本人授課完整流程、非 approved 不能（也不會出現在名片搜尋）、撞課被擋、舊版本被拒、選別人時不能用本人授課、不能把邀請送給自己、本人授課後修改回到草稿並釋放時段。

## 執行紀錄（2026-10-05）

- [x] `selfConfirmProposalCore`（鎖老師並檢查撞課 → 鎖邀請 → 鎖內重驗；時間在等鎖期間改變時用最新時間重查）；service `selfConfirmOwnProposal`、`getOwnTeacherProfileId`；`submitOwnProposal` 拒絕寄邀請給自己（`self_invitation_not_allowed`）；詳情帶 `confirmedByUserId`。
- [x] 表單：名片搜尋標示「你自己」；選自己時主按鈕「由我授課並確認」、確認畫面說明保留自己的時段、沒有「送出邀請」；詳情顯示「已確認由你自己授課」。
- [x] 測試：新增 `organizer-self-teaching.spec.ts`（完整 UI 流程與確認資料、撞到自己的課、舊版本、選別的老師不能本人授課、選自己時沒有寄邀請按鈕、重試不重複確認、本人授課後修改回草稿並釋放時段、未審核不能本人授課也不會出現在名片搜尋）。`submitOwnProposal` 拒絕寄給自己的分支，UI 沒有入口能觸發，以程式為證據。
- [x] 第一次跑測試時 port 3100 的測試伺服器中途斷線（`ERR_CONNECTION_REFUSED`，疑似其他工作同時跑測試），改用 port 3200 重跑：proposal 相關 4 個 spec 56 passed；tsc、eslint、build 通過。
- [x] 文件：permissions-matrix、data-model、state-transition-details 標記本人授課已落地。
- [x] Codex 第 1 輪修正：等待確認中的邀請改選自己時退回草稿（不留下「自己邀請自己」，原受邀老師看不到；表單顯示「儲存並改由我授課」，之後直接本人授課，UI 測試）；本人授課失敗的原因（撞課、不是自己、版本過期）在換頁後的提示文字補齊，從新增頁撞課的 UI 測試證明草稿保留並說明要調整時間。self-teaching＋revise 30 passed（port 3200）；tsc、eslint、build 通過。
- [x] 獨立 review（Codex，3 輪後 APPROVED；第 2 輪接受 submitOwnProposal 自邀請分支以程式為證據，第 3 輪確認 pending → draft 例外已同步 spec 13.3 與 state 文件）。
- [x] 本機 commit（未 push）。

<!-- codex-peer-reviewed: 2026-10-05T03:31:19Z rounds=3 verdict=approved -->
