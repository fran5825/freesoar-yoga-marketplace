# 老師開課排程、期班與改課票券

日期：2026-10-04。產品主人以「票照這樣切」核准 13 票拆分與依賴；全部維持 `draft`，尚未授權 source Builder、commit／push 或部署。

**2026-10-09 更新：** 產品主人為了盡快收尾，決定**期班（票 07–13）延後**，記在 `docs/backlog.md` 第 20 項。票 01–06 照常收尾驗收；07–13 維持 `draft`，重啟前不要開工。

**2026-10-09 畫面驗收包：** 票 01–06 的 desktop／mobile 截圖與驗收重點：https://claude.ai/artifact/1kut58HPAenJLBCMJMaYDg （私人頁面）。產品主人看過後再把各票標成已驗收。

來源：[規格](../../../../specs/teacher-class-scheduling-spec.md)（Q1–Q28、情境 S1–S23）、[ADR 0005](../../../../adr/0005-term-class-series-enrollment.md)。

## 票券索引

| 票 | 完成結果 | Blocked by | Workflow mode | Human Gate | Status |
| --- | --- | --- | --- | --- | --- |
| [01 全部開放報名](01-open-all-series-sessions.md) | 系列一次開放、總覽草稿合併並顯示日期 | None | STANDARD | yes | accepted（2026-10-04 實作；2026-10-09 畫面驗收通過） |
| [02 生成更多提醒](02-continuous-series-reminder.md) | 持續開課剩不到 2 場時提醒 | None | STANDARD | yes | accepted（2026-10-04 實作；2026-10-09 畫面驗收通過） |
| [03 從這場以後全部取消](03-cancel-from-this-session.md) | 中途結束系列 | None | STANDARD | yes | accepted（2026-10-05 實作；2026-10-09 畫面驗收通過） |
| [04 單堂改課](04-single-class-edit.md) | 改內容、時間、地點、人數上限並通知 | None | HEAVY | yes | accepted（2026-10-05 實作；2026-10-09 畫面驗收通過） |
| [05 系列改課](05-series-class-edit.md) | 只改這場／改這場和之後所有場次 | 04 | HEAVY | yes | accepted（2026-10-05 實作；2026-10-09 畫面驗收通過） |
| [06 公開設定](06-visibility-settings.md) | 系列可公開、建好後可改 | 04、05 | HEAVY | yes | accepted（2026-10-06 實作；2026-10-09 畫面驗收通過） |
| [07 建立期班](07-term-class-creation.md) | 持續開課／期班、報名方式 | 01、02、06 | HEAVY | yes | draft |
| [08 報名整期](08-term-enrollment.md) | 學員整期報名、中途加入 | 07 | HEAVY | yes | draft |
| [09 請假與退出](09-term-leave-and-withdraw.md) | 整期學員請假單場、退出整期 | 08 | HEAVY | yes | draft |
| [10 老師處理整期報名](10-teacher-term-enrollment-handling.md) | 整期名單、整期確認一次 | 08 | HEAVY | yes | draft |
| [11 補課日期](11-term-makeup-dates.md) | 期班追加日期、整期學員自動報上 | 08 | HEAVY | yes | draft |
| [12 學員端呈現](12-member-term-display.md) | 期班一張卡片、同系列場次 | 08、09 | STANDARD | yes | draft |
| [13 完整驗收](13-scheduling-acceptance.md) | S1–S23、RWD、文件同步 | 01–12 | STANDARD | yes | draft |

## HEAVY 票

04、05、06、07、08、09、10、11：涉及 Prisma schema／migration、權限、state machine 或併發鎖定。每張實作前先更新 `docs/domain/` 對應文件並做安全檢查，由產品主人逐張放行。

## 依賴與建議順序

- 初始可開始：01、02、03、04（技術上獨立，不是執行授權）。
- 建議順序：01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13。先解決逐場開放報名的痛點，再做改課，最後做期班。
- 規格第 8 節的推導規則，在放行對應票券（04、05、06、07、08、09、10、11）時一併確認。
- 所有動到系列場次集合或整期報名的票，遵守規格第 6 節的鎖定協定（系列 → 場次依 id → 老師），並附交錯執行測試。
- 每票各自完成必要測試、RWD 與 self review；13 是整合驗收，不取代前票驗收。

<!-- codex-peer-reviewed: 2026-10-04T00:20:23Z rounds=4 verdict=approved -->
