# 01: 持續開課的系列詳細頁

來源：[docs/superpowers/plans/2026-10-09-class-discovery-series-cards-plan.md](../../../2026-10-09-class-discovery-series-cards-plan.md)（D3、4.1、4.2）。

**What to build:** 訪客與學員可以開啟 `/classes/series/[recurringClassSeriesId]`，看到這門持續開課的課程資訊（標題、老師、地點、每週幾點、說明、適合對象、準備事項），以及最近 8 堂場次（每場日期、時間、剩餘名額）；按「看更多日期」每次多列 8 堂；點某個日期進單堂頁報名。頁面沒有整期報名。標頭資訊取自「第一個還有名額的未來公開場次，全部額滿則取最近一場並標額滿」；清單每列若地點或時間與標頭不同要加註。沒有任何公開場次、或不是持續開課的系列，一律顯示 not-found，不透露存在。

**Blocked by:** None (can start immediately)

**Status:** 完成（2026-10-09，測試通過）

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** 新增公開路由與公開可見規則（屬權限範圍，需產品主人放行）；不改 schema、Auth、state machine。

- [x] 持續開課系列頁顯示標頭資訊與最近 8 堂；「看更多日期」每次 +8，到 200 堂上限改顯示「僅列出前 200 堂」；無效 `show` 值退回 8
- [x] 期班、不存在、無公開場次、老師非 approved 的系列 id 都回 not-found
- [x] 改過「這場以後」的系列：標頭與每列資訊各自正確，不混用不同場次的資料
- [x] 未登入訪客可看；點日期進單堂頁，報名流程不變
- [x] Vitest 涵蓋可見規則、分頁（不重複不漏）、混合設定；手機寬度無橫向溢出
- [x] 品牌檢查：無斜體強調、01/02 編號標籤、monospace 標籤
