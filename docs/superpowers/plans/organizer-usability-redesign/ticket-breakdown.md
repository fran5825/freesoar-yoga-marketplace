# Organizer Usability Redesign Ticket Breakdown

日期：2026-10-03。狀態：**15 張切票與相依關係已由產品主人確認；一票一檔已建立。進度：01、02、03 done（2026-10-04）、04、05、06、07 done（2026-10-05）；其餘 draft。**

產品主人確認原文：「同意這份切票，建立一票一檔」。產品／模型核准依據為 Q1–Q19，包含 Q18：A、Q19：A；本次確認票的大小與前置關係，不重新詢問相同產品方向。

來源：[分批實作計畫](../2026-10-03-organizer-usability-redesign-plan.md)、[完整規格](../../../specs/organizer-usability-redesign-spec.md)、[決策紀錄](../../../organizer-usability-plan.md)。切票依 [to-tickets skill](../../../../.claude/skills/to-tickets/SKILL.md)、[MVP slicing](../../../harness/mvp-slicing.md) 與 [risk-based workflow](../../../harness/risk-based-workflow.md)。本機 Markdown 是唯一票券位置，不建立外部 issue，也不使用 .scratch。

## HEAVY 票券

以下 13 票 Human Gate=yes／需產品主人確認；沿用已核准 Q1–Q19，不把 draft 當成 ready-for-agent。每票執行前核對具體範圍、最新共享 diff、驗證與 rollback；新產品決策、未涵蓋的 migration 細節、production、commit／push／deploy 不屬於本次放行。

| 票號／Title | Blocked by | What it delivers | Workflow mode | Human Gate |
| --- | --- | --- | --- | --- |
| [01：正式 contract 文件](tickets/01-approved-domain-contracts.md) | None | 讓開團、建團、合作邀請的已核准規則可由產品、工程與測試共同核對，先完成文件與 migration 設計再改程式。 | HEAVY | yes／需產品主人確認 |
| [02：多團體 ownership 相容擴充](tickets/02-organization-ownership-expand.md) | 01 | 在多團體新流程尚未上線時，原有團主仍可註冊、提出需求與管理舊課程；資料安全地加入 owner 關聯。 | HEAVY | yes／需產品主人確認 |
| [03：我的團體與首次建團](tickets/03-organization-management-onboarding.md) | 02 | 團主可以同帳號管理多個公司／社團，個人資料與每個團體的聯絡資料各自清楚；第一次建立仍用一頁完成。 | HEAVY | yes／需產品主人確認 |
| [04：選團體、存需求草稿、補資料返回](tickets/04-demand-group-draft-return.md) | 03 | 團主選自己的團體填一頁需求，明確存草稿；缺聯絡資料時儲存後前往補資料，再回到同一筆繼續送審。 | HEAVY | yes／需產品主人確認 |
| [05：建立合作邀請並送給老師](tickets/05-direct-class-invitation.md) | 03 | 團主為自己的團體保存單堂安排，選 approved 合作老師，送出後到邀請詳情；受邀老師能看到自己的課程內容。 | HEAVY | yes／需產品主人確認 |
| [06：老師確認／婉拒與共用排課保護](tickets/06-teacher-confirmation-reservation.md) | 05 | 受邀老師能確認或附原因婉拒；確認成功才保留時段，所有既有建課方式都能防止與此安排衝突。 | HEAVY | yes／需產品主人確認 |
| [07：修改、撤回與重新邀請](tickets/07-invitation-revision-withdrawal.md) | 06 | 團主能調整、撤回或在老師婉拒後重送邀請；老師先前的確認不會被套用到已修改的課程內容。 | HEAVY | yes／需產品主人確認 |
| [08：團主本人授課](tickets/08-organizer-self-teaching.md) | 06 | approved 老師兼團主可在團主安排中明確確認自己授課，免去切換身分再接受自己的邀請。 | HEAVY | yes／需產品主人確認 |
| [09：直接開放報名與來源權限](tickets/09-direct-class-enrollment-opening.md) | 07 | 老師已確認後，團主一次完成直接開團與開放報名；重試仍是同一堂，相關角色只能執行自己有權的操作。 | HEAVY | yes／需產品主人確認 |
| [10：雙入口、註冊與登入返回](tickets/10-organizer-entry-intent.md) | 04、09 | 從『我需要找老師』或『我已有合作老師』開始，訪客與既有團主都一路到正確流程，首次建資料不丟失開團目的。 | HEAVY | yes／需產品主人確認 |
| [12：全站待辦與通知直達單筆](tickets/12-organizer-teacher-todos-notifications.md) | 07、08、09 | 團主與老師在總覽、列表及站內通知能辨識目前輪到誰，直接前往該邀請或課程繼續處理。 | HEAVY | yes／需產品主人確認 |
| [13：分享連結、登入與學員報名](tickets/13-unlisted-class-sharing-enrollment.md) | 09 | 團主開放課程後可複製完整報名連結與看名單；收到僅透過連結招募課程的學員能登入回原課程並報名。 | HEAVY | yes／需產品主人確認 |
| [15：舊團體欄位 contract 清理（首輪驗收後）](tickets/15-organization-legacy-contract.md) | 14 | 新多團體流程已驗收且無呼叫點依賴舊單團體關聯後，安全移除相容橋接，使用者資料與操作保持一致。 | HEAVY | yes／需產品主人確認 |

## STANDARD 票券

以下 2 票 Human Gate=no，僅限既有規則的衍生顯示與低風險 UI／驗收。若為修復必須改 Auth、schema、permission 或 state，停止並另列 HEAVY slice。

| 票號／Title | Blocked by | What it delivers | Workflow mode | Human Gate |
| --- | --- | --- | --- | --- |
| [11：找老師流程的明確下一步](tickets/11-matched-demand-next-actions.md) | None | 團主可由真實老師回應知道何時要選老師，送審、選老師與成立課程後都能直達該筆下一步。 | STANDARD | no |
| [14：手機／桌機全旅程驗收](tickets/14-organizer-journey-usability-review.md) | 04、10、11、12、13 | 以完成兩條開團路徑為驗收目標，證明資訊、下一步、操作與報名分享在手機及桌機都清楚可用。 | STANDARD | no |

## 執行與可驗收邊界

- 初始可開始的 frontier 是 01 與 11；建議先 01，確立正式 contract，再依 blockers 執行；票號不是強制線性排程。
- 每張行為票包含使用者可操作的結果、必要 service／資料／route 與驗證。02 與 15 是 wide refactor 的 expand–contract 例外：02 保留新舊形式與綠色基線，03／04 及後續新流程逐批遷移，15 只能在所有依賴清零後清理。
- 15 的 blocker 14 傳遞涵蓋本輪前置批次；仍須另查所有舊欄位呼叫點，包括 seed、fixtures、admin 及未列在本輪的新變更。若找到殘留，新增 migrate ticket 與明確 blocker，不把它藏進 contract。
- 首輪完整使用體驗以 14 驗收為交付點；15 是之後的獨立清理，不阻擋單堂使用體驗交付。
- 05 送出邀請可驗收，但不能開放報名；06 才有受邀老師確認／占時段，09 才原子開放；10 等兩條路徑都可用才曝光雙入口。缺少 service 支持的 CTA 不提前公開。
- 07 與 08 在 06 後各自可推進；本人授課的異動語意由 07 整合，08 不提前曝光尚未完成的 confirmed 編輯；12／14 驗證組合結果。
- 每票採 spec → plan → build → test → self review → review → local delivery，更新正式文件的實作狀態。不得以局部 pass 宣稱整個重設已完成。
- 共享 admin／teacher／member 程式有其他 task 工作：執行前先讀最新內容、以窄 diff 保留，不把全 working tree 算成本任務產出。

## 多堂課與本輪範圍

「團主一次安排多堂課」已記在 [backlog 第 18 項](../../../backlog.md#18-團主一次安排多堂課2026-10-03)。建議完成本輪單堂流程後再規劃系列；系列／逐堂確認、整期／逐堂報名、部分衝突與取消尚未定案，不包含在 15 票內。不改既有老師 recurring，也不加入付款、AI、Wellness／Academy／Retreat、native app 或企業權限。

## 文件 Self Review

- 本輪更新：團主 spec、分批計畫、訪談紀錄、backlog；新增本拆分入口與 15 票。glossary 的團主名詞已在前段訪談同步，沒有在本次切票擴改。
- 符合 V1 已核准多團體與直接開團方向；正式 role／permission／state／model／route 文件同步留給 01，source／schema 尚未修改。
- 票券列出 ownership、teacher qualification、version、concurrency、origin guards、匿名隱私／callback 等安全檢查；runtime security／RWD／brand verification 留待實作驗收，沒有宣稱已通過。
- 文件連結、票號／相依 DAG、draft／risk／gate 欄位與 whitespace 經檢查。沒有新增測試 package；文件工作不執行 runtime build／E2E。
- 其他 task 既有變更保留，沒有修改無關 source；沒有自動 commit、push、production migration 或 deploy。

## Recommended Next Step — Common Handoff Schema

- Level：L3。
- Recommended next work mode：HEAVY docs Builder，僅執行 01。
- Next smallest actionable slice：同步正式 contract 與 migration／service 設計文件，仍不修改程式或 schema。
- Why this should be next：Q18／Q19 與切票已核准，正式文件是 schema／permission／state 實作的一致依據。
- Can Codex execute directly：yes，在核准的 01 docs-only 範圍；不得自動接著執行所有 HEAVY 程式票。
- Suggested execution location：current task 優先；new task 亦可帶規格／計畫／01。
- Requires product owner decision：no，相同 Q1–Q19 與切法不重問；未涵蓋的 migration 或產品細節仍需確認。
- Suggested next prompt：使用分批計畫第 5 節的完整 01 docs Builder prompt。
- Auto-continue allowed：本輪 to-tickets no further Builder；若產品主人要求執行 01，則只允許該 docs slice。
- Auto-continue reason：本輪交付核准票券，不把建立 draft 票誤判為無限制程式授權。
- Stop condition triggered：no，切票已完成；後續若超出 01 allowed files、變更核准選擇或無法安全保留共享 diff 時停止。
- Notify human：yes，回報已完成切票與具體下一步。
- Notification reason：確認票券已落地，單堂先行／多堂 backlog 與 code 尚未實作的狀態清楚。
- Approval noise reduction applied：yes，記錄原批准，不重問產品方向；production／commit／push／deploy 維持獨立 gate。
- Approval boundary note：切票已批准，票券仍 draft；01 為已核准 docs 工作，不等同任何 production 或不可逆資料操作批准。

