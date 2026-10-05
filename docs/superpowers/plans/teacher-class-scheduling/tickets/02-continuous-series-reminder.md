# 02：持續開課剩不到 2 場時提醒生成更多

**What to build:** 每週固定的持續開課系列，尚未開始、未取消的未來場次少於 2 場（含 0 場）時，老師總覽出現提醒，點進系列頁即可生成更多。

**Blocked by:** None (can start immediately)

**Status:** done（2026-10-04，待產品主人看畫面）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** LOW_PRESSURE_UX_RISK（只讀取推導，不改資料）

規格：[4.4](../../../../specs/teacher-class-scheduling-spec.md)（Q4、Q13）；情境 S4、S18。

- [x] 提醒只針對每週固定系列；指定日期系列不提醒（票 07 落地後改為「只針對持續開課」，屆時在 07 調整）。
- [x] 判斷只讀取本人系列的場次，跨老師不可見；暫停中的老師不顯示生成提醒。
- [x] 提醒文字說明剩幾場與最後一場日期，連到系列頁的生成更多區塊。
- [x] Smoke 測試覆蓋剩 2 場不提醒、剩 1 場與 0 場提醒、他人系列不出現；tsc、lint、受影響 smoke 通過。

## 執行紀錄（2026-10-04）

- 新增 `__internal__/series-needing-more-core.ts`：只讀本人 `dayOfWeek` 不為 null 的系列，數尚未開始、未取消的場次，少於 2 場就列出（含最後一場時間）。`read-service.ts` 的 `listOwnWeeklySeriesNeedingMoreForTeacher` 只對已通過審核的老師回傳。
- `buildTeacherTodoItems` 多一類提醒（排在草稿之後）：「常態班：只剩 N 場」／「常態班：已經沒有之後的場次」，連到系列頁 `#generate-more`。
- Checks：`tsc`、`eslint` 通過；`next build` 通過；Playwright 86 個中 84 個通過，含新增 `teacher-series-generate-reminder.spec.ts`（剩 2 場不提醒、剩 1 場與 0 場提醒、指定日期與他人系列不出現、暫停老師不顯示、點卡片到生成更多區塊）。另 2 個失敗是 `teacher-profile-suspension` 的管理員暫停提示文字，屬 admin 頁面，正由另一個 task 修改中，與本票無關。
- RWD：375／768／1440 總覽無橫向捲動，提醒卡片高度 ≥ 44px。
- 執行方式同票 01：3100 埠被另一個 task 占用，複製到暫存資料夾 build，用 3200 埠測試。

<!-- codex-peer-reviewed: 2026-10-04T00:20:21Z rounds=4 verdict=approved -->
