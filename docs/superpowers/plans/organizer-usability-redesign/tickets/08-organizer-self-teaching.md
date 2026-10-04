# 08: 團主本人授課

**What to build:** approved 老師兼團主可在團主安排中明確確認自己授課，免去切換身分再接受自己的邀請。

**Blocked by:** 06：老師確認／婉拒與共用排課保護

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK

- [ ] 同 User 的 organizer／approved teacher 能選自己的老師名片，顯示明確『由我授課並確認』動作，不能僅靠 teacher ID 判定同意。
- [ ] draft 自確認沿用完整度、future、approved、latest version 與共用排課鎖／衝突 guards，成功保存同一份確認 metadata。
- [ ] 非 approved 老師不得自授課；不新增角色、teacher 建團權限或繞過團體 ownership。
- [ ] 自確認接受的是當下版本；confirmed 內容異動由第 7 票整合失效／釋放／再確認，本票不提前曝光未完成的 confirmed 編輯；轉課後不可編輯。
- [ ] 不產生重複的自邀請／待我確認 UI，通知整合不得通知自己接受自己的邀請。
- [ ] 測試同帳號能力、未 approved、衝突、自確認重試與版本守衛；異動失效於第 7 票完成後由整合驗收涵蓋。團主畫面可完成自確認，更新已核准的 permission／state 說明。
