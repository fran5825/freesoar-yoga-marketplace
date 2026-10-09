# 05: 驗收與文件同步

來源：[spec](../../../../specs/enrollment-re-enrollment-spec.md)。

**What to build:** 確認整條流程可用並把文件改成與實際行為一致：單堂取消後重新報名、整期請假後取消請假（兩種模式）、不能重新報名的各種情況，桌面與手機都跑一次。

**Blocked by:** 02、03、04

**Status:** 完成（2026-10-10，測試通過）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無。

- [x] Playwright：學員從取消到重新報名／取消請假的完整流程（桌面與手機），含不能重新報名的原因文案
- [x] 更新 `docs/domain/state-machines.md`、`docs/domain/state-transition-details.md`（取代 D8，改寫「取消後不可重新報名」）、`docs/domain/data-model.md`、`docs/domain/permissions-matrix.md`（學員可對自己取消的報名重新報名）
- [x] 更新 `docs/context/glossary.md` 與 `docs/product/route-map.md`（若頁面說明有變）
- [x] 全部受影響 spec 通過；TypeScript、ESLint、build 通過

## 進度紀錄（2026-10-10）

- 新增 `re-enrollment-acceptance.spec.ts`（桌面＋手機）：單堂取消→重新報名→再取消→再重新報名、整期請假→取消請假、退出整期後不能再報名；每個畫面檢查沒有橫向溢出、沒有「無法再次報名」舊說法。
- 文件同步：`state-machines.md`、`state-transition-details.md`（D8 劃掉並補修正）、`data-model.md`、`permissions-matrix.md`、`route-map.md`、`glossary.md`。
- Codex 對實作做獨立 code review，找到 1 個真問題：管理員課程頁「名額佔用」漏算 `term_only` 請假保留的名額。已改為讀取共用占用規則，並新增 `admin-seat-occupancy.spec.ts`。
- 驗證：全套 smoke（`PORT=3600`，獨立資料庫 `freesoar_re_enroll_test`）1262 項中 1250 通過、14 項跳過、12 項失敗；12 項（admin-journey、class-session-creation、teacher-profile-tabs、admin 相關、member-journey-acceptance、public-classes-discovery、signed-in-navigation）重跑全部通過，屬於先前已記錄的不穩定測試與本機網路（Google 連線）問題，與本次改動無關。TypeScript、ESLint、build 通過。

<!-- codex-peer-reviewed: 2026-10-09T16:22:17Z rounds=3 verdict=approved -->
