# 07: 通知記錄系列 ID（schema）與批次動作只發一則

來源：[spec 2.5](../../../../specs/teacher-series-rollup-and-action-bar-spec.md)、[ADR 0008](../../../../adr/0008-notification-series-grouping.md)。

**What to build:** `Notification` 新增可為空的 `recurringClassSeriesId`（`onDelete: SetNull`）與索引。課程相關通知在該課屬於系列時寫入系列 ID。批次動作（建立系列、生成更多、取消整個系列、從這場以後全部取消）每位收件人只發一則站內通知與一封 email，內文寫堂數與日期範圍。

**Blocked by:** None（獨立 worktree）

**Status:** 待開始 ・ **Workflow mode:** HEAVY ・ **Human Gate:** yes（schema，設計已放行；migration 執行前回報）

**Risk flags:** schema migration；漏帶系列 ID 只會不合併，但批次改一則若漏掉收件人會少通知，要逐一測。

- [ ] additive migration（欄位、索引），獨立測試資料庫跑通；同票更新 `docs/domain/data-model.md`
- [ ] 兩個寫入路徑都保存系列 ID：`create.ts` 的 `notifyUsers` 與 `email-channel.ts` 的 `deliverEmailChannel`
- [ ] 逐項驗收的發送點清單（屬於系列時都要帶系列 ID；站內與 email 記錄都要檢查）。施工時先用 `grep -rn "notifyUsers\|notifyOverride\|deliverEmailChannel" src/domain` 重列一次，以實際結果為準，課程相關者全部處理：
  - 課程：`create-teacher-class-session-core`（`notifyClassSessionsCreated`，建立系列與生成更多）、`add-makeup-session-core`（補課）、`create-class-session-core`、`edit-class-session-core-for-teacher`（單堂改課）、`edit-series-from-occurrence-core`（改整個系列）、`cancel-class-session-core-for-teacher`、`cancel-class-session-core`、`service.ts`（含 `cancelRecurringClassSeriesForTeacher`、`cancelSeriesFromOccurrenceForTeacher`、標記完成）、`complete-class-session-core-for-teacher`
  - 報名：`create-enrollment-core`（單堂建立）、`create-series-enrollment-core`（整期建立）、`decide-series-enrollment-core`（整期確認／婉拒）、`withdraw-series-enrollment-core`（退出整期）、`cancel-enrollment-for-admin-core`（管理員取消報名）、`enrollment/service.ts`（單堂確認／婉拒／取消）
  - 評價：`submit-review-core`
  - 其他會發課程相關通知的路徑（例如老師停權連帶的課程通知）若 grep 有出現也一併處理
- [ ] 批次動作改成每位收件人一則：`notifyClassSessionsCreated`（建立系列、生成更多）、取消整個系列、從這場以後全部取消（`edit-series-from-occurrence-core` 已是一人一則，只補系列 ID 與堂數文字）；文案與 email 樣板加「共 N 堂（日期範圍）」
- [ ] 單堂動作維持原樣
- [ ] 測試：每個發送點有無系列 ID、批次動作每位收件人恰好一則站內與一封 email、單堂不受影響

<!-- codex-peer-reviewed: 2026-10-11T00:37:44Z rounds=3 verdict=approved -->
