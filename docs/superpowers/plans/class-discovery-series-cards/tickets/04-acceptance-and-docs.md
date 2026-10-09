# 04: 驗收與文件同步

來源：[docs/superpowers/plans/2026-10-09-class-discovery-series-cards-plan.md](../../../2026-10-09-class-discovery-series-cards-plan.md)（第 5、6 節）。

**What to build:** 確認整條訪客路徑可用：在 `/classes` 看到合併後的卡，點進系列頁，挑日期進單堂頁。修掉所有以「逐場一張卡」為前提的舊測試，並把 `docs/product/route-map.md` 新增 `/classes/series/[recurringClassSeriesId]` 一列、更新 `/classes` 說明（持續開課也合併）。

**Blocked by:** 01、02、03

**Status:** 完成（2026-10-09，測試通過）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無。route-map 只在頁面實際完成後才更新。

- [x] Playwright smoke：訪客從列表到系列頁到單堂頁，手機寬度也跑一次
- [x] grep 並修正依賴逐場卡片的既有測試，相關測試全綠
- [x] route-map 與 glossary 與實際行為一致
- [x] TypeScript、ESLint 通過；驗證範圍只涵蓋受影響檔案

## 進度紀錄（2026-10-09）

- 驗證範圍：新增 `series-cards-list`、`series-detail-page` 兩個 spec（桌面＋手機 28 項）與 12 個受影響的既有 spec 全數通過（`PORT=3500`）。`public-classes-discovery` 一項測試原本預期卡片有「開放報名」標籤，已依決策 D2 改為預期沒有。`class-direct-sign-in` 的「tampered provider」第一次失敗、重跑通過，與本次改動無關（登入導向，不碰列表）。
- 沒有跑完整 smoke 套件；只跑會碰 `/classes` 的 spec。TypeScript 與 `next build` 通過，ESLint 對改動檔案無警告。
- 在開發站（3000）目視確認：列表 17 張卡縮成 2 張，系列頁正常顯示。
- 開工前確認「週三晨間流動瑜伽 秋季班」是持續開課（已被合併），不是期班 bug。
