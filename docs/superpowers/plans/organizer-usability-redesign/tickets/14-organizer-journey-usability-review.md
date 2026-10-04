# 14: 手機／桌機全旅程驗收

**What to build:** 以完成兩條開團路徑為驗收目標，證明資訊、下一步、操作與報名分享在手機及桌機都清楚可用。

**Blocked by:** 04：選團體、存需求草稿、補資料返回；10：雙入口、註冊與登入返回；11：找老師流程的明確下一步；12：全站待辦與通知直達單筆；13：分享連結、登入與學員報名

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no（僅限本票列明的低風險範圍。）

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK

- [ ] 驗收訪客、已登入未建團主資料、既有團主、老師兼團主：request → 登入／資料 → 選團體 → 找老師或邀請 → 確認 → 開放 → 分享／報名。
- [ ] 390px、1280px 完成關鍵旅程；320px 無水平溢出，sticky 列不遮欄位／錯誤／鍵盤／最後操作；觸控與鍵盤、label／focus／aria-live 可用。
- [ ] 涵蓋缺資料返回同 draft、server error 不丟內容、拒絕／重送、衝突、自授課、等待與待我處理、過期與無效連結；保留必要截圖／可重現 evidence。
- [ ] TypeScript、ESLint、build、變更邏輯測試與 key E2E 通過；Playwright 使用測試 DB／獨立 port／既有 workers 設定，記錄實際命令與結果，不把未執行報成通過。
- [ ] role／permission／state／model／routes／三種 origin 與 legacy 呼叫點完成 review；舊 matched／teacher recurring／報名／取消功能相容。
- [ ] Free Soar gentle、clear、spacious、低壓力語氣一致，一頁一個明確主動作；所有建立入口在首屏容易找到。
- [ ] 只作已核准範圍的低風險 UI／可及性修正；若需 schema／Auth／permission／state mutation，停止另提 HEAVY 修復，不以驗收票擴大實作。
- [ ] 交付 review packet：本任務 diff 與既有變更區分、self review、scope drift、剩餘風險／未通過 gate、Common Handoff Schema；不 commit／push／deploy。

