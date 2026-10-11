# 06: 管理員課程清單系列卡與唯讀系列頁

來源：[spec 2.1](../../../../specs/teacher-series-rollup-and-action-bar-spec.md)。

**What to build:** 管理員課程清單收合成系列卡（沿用票 03 的收合函式）；新增管理員唯讀系列頁，列出每場日期、狀態、人數，點一場進管理員既有單堂頁。

**Blocked by:** 03

**Status:** 待開始 ・ **Workflow mode:** STANDARD ・ **Human Gate:** yes（新增管理員查詢，需 security review）

**Risk flags:** 新增 route 與管理員專用查詢，必須 `requireAdmin` 把關，不得共用老師 own-scoped 查詢。

- [ ] 管理員專用系列讀取 service（只讀），非管理員一律拒絕
- [ ] 清單收合、系列頁唯讀列表、返回連結
- [ ] security review：非管理員存取、不存在的系列、已刪除系列
- [ ] 測試：權限（老師、學員、訪客被拒）、收合與列表、手機 375px

<!-- codex-peer-reviewed: 2026-10-11T00:37:44Z rounds=3 verdict=approved -->
