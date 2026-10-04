# 13: 分享連結、登入與學員報名

**What to build:** 團主開放課程後可複製完整報名連結與看名單；收到僅透過連結招募課程的學員能登入回原課程並報名。

**Blocked by:** 09：直接開放報名與來源權限

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** AUTH_RISK、PERMISSION_RISK、LOW_PRESSURE_UX_RISK

- [ ] 開放課程詳情主要動作為複製完整 URL，另可開啟課程／看名單；複製成功／失敗可理解且 aria-live，不只顯示相對路徑文字。
- [ ] 匿名非公開課程與其他無法公開讀取的 ID 使用一致的通用登入引導，URL／回應不能透露是否存在、標題、老師或聯絡資料。
- [ ] 登入後 callback 返回同課；可見且有效課程走既有 Member 讀取／報名，無效／draft／越權資料不洩漏。
- [ ] 預設 unlisted 不出現在公開探索；勾選公開才依既有公開 guards 顯示，不新增公司成員驗證，明確說明連結可轉傳。
- [ ] 報名、滿額、取消、來源權限及團主 own roster 保留既有規則；此票不實作 Google 一鍵登入捷徑或新 login provider。
- [ ] 測試匿名 valid/invalid/draft 一致引導、callback 安全、登入返回、Member 報名、名額競態、公開探索與 roster 越權；桌機／手機完整分享旅程。
- [ ] 先查證最新 member／public 修改，保留其他 task 的 diff；同步曝光與登入邊界文件。

