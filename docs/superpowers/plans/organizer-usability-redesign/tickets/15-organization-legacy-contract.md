# 15: 舊團體欄位 contract 清理（首輪驗收後）

**What to build:** 新多團體流程已驗收且無呼叫點依賴舊單團體關聯後，安全移除相容橋接，使用者資料與操作保持一致。

**Blocked by:** 14：手機／桌機全旅程驗收

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK

- [ ] 這是 expand–contract 最後的機械清理例外，排在首輪完整驗收後；不阻擋第 14 票交付。所有遷移批次透過 14 的前置完成。
- [ ] 開始前重新盤點所有 source、tests、fixtures、seed、DTO／admin queries 與文件：legacy organizationId 讀寫／relation 依賴為零，並提供 evidence，不能只搜尋名稱就聲稱安全。
- [ ] 若存在依賴，先列出未完成 migrate batch 並明確加入 blockers；不把殘留呼叫點遷移混進不可逆刪欄位票。
- [ ] 對已核准 owner 模型提出具體 contract migration、資料完整性／rollback 限制與驗證；需產品主人確認實際 destructive migration 風險後才執行測試 DB，不取得 production 授權。
- [ ] 只移除 legacy 關聯／pointer 與相容處理；多團體 owner、原組織 ID、historical demand／class FK、孤立團體 admin-only 語意保留。
- [ ] 測試 migration 前後完整性、首次建資料、兩團體需求／直接開團、admin owner、fixtures cleanup 與既有回歸；同步正式模型及相容狀態文件。
- [ ] 不混入 DemandRequest.serviceType 清理、多堂 series、角色或其他 schema 變更；無安全 contract evidence 時保持 expand 狀態並回報。

