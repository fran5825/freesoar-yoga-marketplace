# 05: 建立合作邀請並送給老師

**What to build:** 團主為自己的團體保存單堂安排，選 approved 合作老師，送出後到邀請詳情；受邀老師能看到自己的課程內容。

**Blocked by:** 03：我的團體與首次建團

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK、STATE_MACHINE_RISK

- [ ] 獨立 OrganizerClassProposal 使用有界 typed 草稿欄位、version 與 own organization；保存後有穩定單筆 URL，不建立假 demand／response。
- [ ] 新建／編輯頁可選自己的團體、選最小 approved teacher 名片；查詢不借用 admin 列表，不回傳私人 email／電話。
- [ ] 送出前完整驗證課程、聯絡資料、老師資格、未來時間；表單／儲存以 Asia/Taipei 轉換起迄時間，風格選填不被誤設為必填。draft → pending_confirmation 後到單筆詳情，不能開放報名。
- [ ] pending 不建立正式課程、不占老師時段；顯示等待老師確認與下一步，不暗示時間已保留。
- [ ] 老師 own-read 邀請詳情有完整安排；團主只看自己邀請，其他老師／團主 ID 被拒；admin 不新增代確認能力。
- [ ] 保存／送出失敗保留欄位、缺項定位；明確保存、補資料返回同 proposal ID、未保存離開保護；團體歸屬變更遵守 draft／送出邊界。
- [ ] 測試草稿有界驗證、version、老師 lookup 隱私、非 own ID、非 approved／過期不可送出、pending 不占時段與手機送出；站內通知由第 12 票整合。
