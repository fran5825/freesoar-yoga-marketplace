# 13：完整情境驗收與文件同步

**What to build:** 依規格 S1–S23 跑完老師與學員的完整旅程，確認三種螢幕寬度、品牌一致與角色邊界，並同步所有相關文件。

**Blocked by:** 01–12

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** SCOPE_DRIFT_RISK

規格：[5. 完整情境清單](../../../../specs/teacher-class-scheduling-spec.md)。

- [ ] S1–S23 每個情境都有對應的 smoke 測試或人工驗收紀錄。
- [ ] 完整 Playwright（獨立埠）、tsc、lint、build 通過。
- [ ] 375／768／1440 檢查老師建立、系列頁、改課、期班頁、學員我的課程。
- [ ] `data-model.md`、`state-machines.md`、`permissions.md`、`route-map.md`、名詞表與規格狀態一致。
- [ ] 依 `docs/harness/review-packet-spec.md` 產出 review packet。
- [ ] 驗收不能取代前票驗收，也不擴大 source 修正授權。

<!-- codex-peer-reviewed: 2026-10-04T00:20:23Z rounds=4 verdict=approved -->
