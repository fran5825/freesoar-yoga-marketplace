# 03: 我的團體與首次建團

**What to build:** 團主可以同帳號管理多個公司／社團，個人資料與每個團體的聯絡資料各自清楚；第一次建立仍用一頁完成。

**Blocked by:** 02：多團體 ownership 相容擴充

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK、LOW_PRESSURE_UX_RISK

- [ ] 首次建立個人資料＋第一團體在同一 transaction 完成，失敗不留下半筆；legacy pointer 過渡期有明確相容值。
- [ ] 個人資料頁只管理團主本人資料；我的團體列表首屏可新增，單筆可編輯名稱、聯絡資料，列表只回傳自己的團體。
- [ ] 新團體可保存未完整的資料；需求送審／邀請送出前仍檢查聯絡完整度，第一團體 onboarding 必須完整。
- [ ] 老師可用同帳號建立團主能力並建團，沿用一般團主 onboarding；approved 資格只限制授課，不限制建團。切換角色不授予老師額外團體管理權。
- [ ] 伺服器以 owner 驗證讀／寫；偽造其他團體 ID 被拒，孤立資料不顯示，列表／詳情無聯絡資料洩漏。
- [ ] 保存／驗證失敗保留輸入，必填與選填清楚，320px 無溢出、390px 可完成新增／編輯、鍵盤可操作。
- [ ] 驗證首次 bootstrap 失敗、同帳號兩團體互不覆寫、他人 ID、舊資料、窄 admin owner 顯示及 fixtures 相容；不加刪除、移交、多人共管或團員名冊。
