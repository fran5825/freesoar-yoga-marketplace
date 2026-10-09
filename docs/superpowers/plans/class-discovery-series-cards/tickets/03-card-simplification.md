# 03: 單堂卡與期班卡精簡成同一種樣式

來源：[docs/superpowers/plans/2026-10-09-class-discovery-series-cards-plan.md](../../../2026-10-09-class-discovery-series-cards-plan.md)（D2、D10）。

**What to build:** 學員在 `/classes` 看到的單堂卡與期班卡，拿掉重複的「確認送出後成立報名」「查看課程 →」「查看期班 →」行與綠色「開放報名」標籤（名額狀態改成卡片上一行文字），整張卡可點，三種卡的版面一致。期班卡仍顯示「共 N 堂・剩 N 堂」。

**Blocked by:** 02（兩張票改同一個頁面檔案，避免互相覆蓋）

**Status:** 完成（2026-10-09，測試通過）

**Workflow mode:** LIGHT

**Human Gate:** no

**Risk flags:** 無（只動畫面）。

- [x] 單堂卡、期班卡不再出現上述三行與綠色標籤，名額狀態仍看得到
- [x] 三種卡的間距、標籤、字級一致，整張卡可點且有 focus 樣式
- [x] 手機寬度無橫向溢出；品牌檢查通過
