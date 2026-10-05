# 07: 修改、撤回與重新邀請

**What to build:** 團主能調整、撤回或在老師婉拒後重送邀請；老師先前的確認不會被套用到已修改的課程內容。

**Blocked by:** 06：老師確認／婉拒與共用排課保護

**Status:** done（2026-10-05）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK

- [x] 團主 own-scoped 處理尚未轉課邀請；pending 修改增加 version，舊老師頁面確認被拒；declined 顯示原因與修改重送入口。
- [x] confirmed 課程內容異動回 draft，清除 accepted metadata／釋放預留，必須重新送出並確認；不保留舊版本的授課同意。
- [x] 撤回依核准 transition 執行，pending 不釋放不存在的資源、confirmed 正確釋放；withdrawn 不可偷偷復活。
- [x] 換老師或異動需要不同 TeacherProfile lock 時依固定排序，再重驗狀態／teacher／version；與確認、轉課的競態不丟失或重複預留。
- [x] 已送出邀請不能直接換團體；需撤回／新建。converted／已開放不可修改內容，只能沿用既有取消再建流程。
- [x] 儲存失敗保留輸入；兩端詳情顯示最新版、拒絕／撤回理由、下一個 actor，不顯示舊確認可開放。
- [x] 驗證 stale version、confirm/edit/withdraw 競態、釋放後可再排課、他人 ID、轉課後不可改，以及 declined 修改重送；更新狀態文件。


## 開工前核對（2026-10-05）

- **核准依據**：spec 13.3（修改與撤回的轉換表）、13.5（鎖順序）、13.7 的換老師規則；沒有 schema 變更。
- **做法**：新增 `src/domain/organizer-class-proposal/__internal__/revise-core.ts`：
  - `reviseProposalCore`：先鎖相關老師（目前的與要換成的，依 id 由小到大）→ 鎖邀請 → 鎖內重驗老師沒變、version、狀態、團體鎖定（`submittedAt`）。draft 存檔維持 draft；pending 修改維持 pending（內容必須仍完整、老師必須 approved，version +1 讓老師的舊頁面確認失效）；declined 修改回 draft（保留婉拒原因供參考）；confirmed 修改回 draft（清除確認資料，時段隨狀態改變釋放）。withdrawn／converted 不能修改。
  - `withdrawProposalCore`：同樣先鎖老師再鎖邀請；draft／pending／declined／confirmed 可撤回（confirmed 撤回即釋放時段），原因選填 ≤500 字；withdrawn 不會被改回其他狀態。
  - service 的 `saveOwnProposalDraft` 修改既有邀請時改走 core；新增 `withdrawOwnProposal`。
- **頁面**：編輯頁開放 pending／declined／confirmed（依狀態顯示修改效果與對應按鈕：pending「儲存並更新邀請」、declined／confirmed「儲存為草稿」「修改並重新邀請」）；團主詳情依狀態提供「修改」「撤回」；老師頁顯示撤回原因。
- **不做**：站內通知（票 12）、本人授課（票 08）、開放報名（票 09）。
- **Rollback**：revert 本票 commit。
- **驗證**：pending 修改後老師舊版本確認被拒、confirmed 修改回 draft 並釋放時段、declined 修改重送、撤回並釋放、撤回後不能再改、換老師、送出後不能換團體、converted 不能改、修改／撤回與確認的競態（hooks 決定性測試）、pending 修改成不完整被拒。

## 執行紀錄（2026-10-05）

- [x] `__internal__/revise-core.ts`：`reviseProposalCore`、`withdrawProposalCore`（鎖老師〔目前與新老師，依 id 排序〕→ 鎖邀請 → 鎖內重驗）；service 的修改既有邀請改走 core，存檔結果帶回狀態；新增 `withdrawOwnProposal` 與錯誤訊息。
- [x] 頁面：編輯頁開放 pending／declined／confirmed（依狀態顯示修改效果與按鈕）；團主詳情的「修改」「撤回邀請」（撤回前說明影響、原因選填）；老師頁顯示撤回原因。「修改並重新邀請」若存檔成功但送出失敗，表單改為草稿狀態。
- [x] 測試：新增 `organizer-class-proposal-revise.spec.ts`（pending 修改維持 pending 且老師舊版本被拒、改成不完整被擋；confirmed 修改回 draft 並釋放時段；declined 一步修改重送並清除舊原因；撤回 confirmed 釋放時段、記錄原因、不能恢復；換老師與未審核老師；送出後不能換團體；converted 不能改；其他團主；修改與確認、撤回與確認的 hooks 決定性競態）；更新票 05 測試（送出後可修改、新的版本過期訊息）。proposal 相關 3 個 spec 44 passed；tsc、eslint、build 通過。
- [x] 文件：state-transition-details、permissions-matrix、data-model、route-map 標記修改／撤回已落地。
- [x] Codex 第 1 輪修正：從草稿撤回時清掉受邀老師，從未送出或修改換人後尚未重送的草稿撤回，任何老師都讀不到（測試兩條路徑，真正收到邀請的老師仍可讀）；補上 `declined → pending_confirmation` 不修改直接重送（version 不變、`transitionSeq` +1、清除婉拒原因，詳情頁「不修改，直接重新邀請」，測試含之後老師以同一 version 確認）；補上「確認先拿到鎖」的反向競態（修改仍成功、回到草稿、清除確認資料、釋放時段）。proposal 相關 3 個 spec 50 passed；tsc、eslint、build 通過。
- [x] 獨立 review（Codex，2 輪後 APPROVED）。
- [x] 本機 commit（未 push）。

<!-- codex-peer-reviewed: 2026-10-05T03:06:17Z rounds=2 verdict=approved -->
