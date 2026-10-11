# 04: 老師系列管理頁：每列快速按鈕、整期名單一排

來源：[spec 2.2、2.4](../../../../specs/teacher-series-rollup-and-action-bar-spec.md)。圖三。

**What to build:** 系列管理頁每一場的列，右側放依狀態的一顆快速按鈕（開放報名／取消課程／標記完成），「N 人待確認」為文字連結，點列進單堂頁。整期學員名單改成一排排版。整批操作維持。

**Blocked by:** 01

**Status:** 待開始 ・ **Workflow mode:** STANDARD ・ **Human Gate:** no

**Risk flags:** 列上的取消與標記完成要沿用既有 action 與確認視窗，送出後回到系列頁同一列。

- [ ] 列上快速按鈕沿用既有單堂 action，返回系列頁並捲到該列
- [ ] 取消課程走確認視窗（列出影響人數）；開放報名與標記完成沿用既有條件
- [ ] 整期學員名單一排（付款標記沿用 `markSeriesEnrollmentPaidAction`／`markSeriesEnrollmentRefundedAction`）
- [ ] 測試：三種快速按鈕、送出後回到該列、待確認連結、整期名單一排、手機 375px

<!-- codex-peer-reviewed: 2026-10-11T00:37:44Z rounds=3 verdict=approved -->
