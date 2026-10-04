# 09: 直接開放報名與來源權限

**What to build:** 老師已確認後，團主一次完成直接開團與開放報名；重試仍是同一堂，相關角色只能執行自己有權的操作。

**Blocked by:** 07：修改、撤回與重新邀請

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK、STATE_MACHINE_RISK

- [ ] 新增 organizer_direct origin 與 unique proposal→ClassSession 關聯，三種 origin 維持明確 demand／organizer／organization／proposal 不變量。
- [ ] 在同一 transaction 鎖 teacher＋proposal，驗 own、approved、accepted 最新版本、future 與 conflict；僅排除自身 confirmed proposal。
- [ ] 原子建立 open_for_enrollment 課程並將 proposal converted；不可先建立 draft 再於交易外開放。
- [ ] 重試／並發回同一課程；失敗 rollback 保留 confirmed 邀請及預留，不留下半課程、半 converted 或 double-book。
- [ ] direct 沿用團主報名規則 requiresApproval=false、預設 isPublic=false，公開選擇真正生效；不從不存在的 demand 猜程度與風格。
- [ ] 老師 open／cancel／complete 的 server origin guard 依既有 documented permission 限制；受邀確認不授予團主管理權。admin 保留既有讀／取消，不新增代確認／direct 建課。
- [ ] 雙端與 admin/public/member 來源標示、窄 DTO 正確；成功前往該課程詳情，能使用既有報名流程。
- [ ] 測試原子 rollback、idempotency、跨 proposal 衝突、三種來源關聯／角色、公開選擇、既有 matched／teacher series／報名／取消回歸；同步文件。

