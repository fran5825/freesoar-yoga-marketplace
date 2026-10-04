# 10: 雙入口、註冊與登入返回

**What to build:** 從『我需要找老師』或『我已有合作老師』開始，訪客與既有團主都一路到正確流程，首次建資料不丟失開團目的。

**Blocked by:** 04：選團體、存需求草稿、補資料返回；09：直接開放報名與來源權限

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** AUTH_RISK、PERMISSION_RISK、LOW_PRESSURE_UX_RISK

- [ ] /organizers/request 首屏兩張情境卡；已有團主顯示精簡選擇，不一律 redirect 需求表單。
- [ ] 訪客、已登入未有團主資料、已有團主、老師兼團主的 intent 在登入與首次 onboarding 後正確返回；既有深連結優先回該單筆。
- [ ] 入口／總覽／需求與課程列表首屏有對應建立捷徑；直接開團路徑完整可用後才公開 CTA，未新增 dashboard 模組或覆寫其他角色設計。
- [ ] callback 只接受合法站內目的地，不能 open redirect／越權存取；沒有明確 intent 時保留既有 last-role 行為。
- [ ] 首次一頁個人＋團體資料，既有資料不重填；個人 profile 與我的團體導覽分工一致。
- [ ] 表單分區、欄位摘要、主動作與成功去向一致，錯誤／保存保留輸入；手機與鍵盤可完成兩條路徑。
- [ ] 驗證四種身分、合法／惡意 callback、深連結、重複 onboarding、公開 header／role shell 回歸；不更換 Auth provider、session model 或 account linking。

