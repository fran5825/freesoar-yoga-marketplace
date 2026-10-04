# 12: 全站待辦與通知直達單筆

**What to build:** 團主與老師在總覽、列表及站內通知能辨識目前輪到誰，直接前往該邀請或課程繼續處理。

**Blocked by:** 07：修改、撤回與重新邀請；08：團主本人授課；09：直接開放報名與來源權限

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK、LOW_PRESSURE_UX_RISK

- [ ] proposal 列表與課程列表分開辨識；總覽把待我處理與等待對方分開，主動作導向單筆詳情，未確認不偽裝成已排課。
- [ ] 送邀請、確認、婉拒、撤回、內容異動與開放後的下一步文字與 server state／version 一致，expired 顯示修改時間、不新增 cron state。
- [ ] 站內通知涵蓋核准事件；service 決定 owner／受邀老師與合法目標，不接受 client 自訂收件人、敏感文字或任意網址。
- [ ] 通知重試不重複，失敗不破壞已確認的 domain transaction；相同 idempotency／事件識別的行為有明確證據。
- [ ] 本人授課不發重複自邀請通知；通知直達確切 proposal／class，未登入回原單筆、越權／已無效安全處理。
- [ ] 沿用既有通知資料與可推導連結；若查證需要新 notification schema，先補具體 migration 設計／Human Gate，不私自加已讀欄位。
- [ ] 驗證收件人、事件重試、self-teaching、合法單筆、角色隔離、各等待／待辦狀態與 RWD；不接 Resend、不改 env、不啟用 email、不加未讀數。

