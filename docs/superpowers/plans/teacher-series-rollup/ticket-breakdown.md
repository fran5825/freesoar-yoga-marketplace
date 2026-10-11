# 系列收合、操作列與通知合併：票券總覽

來源：[spec](../../../specs/teacher-series-rollup-and-action-bar-spec.md)、[ADR 0008](../../../adr/0008-notification-series-grouping.md)。建立日期：2026-10-11。產品主人已於 `/grill-with-docs` 放行整體設計與 `Notification` 新增欄位的 schema 變動；HEAVY 票仍逐票 Human Gate。

**施工前提：** `inline-member-enroll`（學員端就地報名，票 06–10）先完成。學員單堂頁的期班標籤已併入該批票 08。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 01 | 共用元件：操作列、期班標籤、報名名單一排 | STANDARD | no | `inline-member-enroll` 完成 | 完成（2026-10-11） |
| 02 | 老師單堂頁套用操作列、期班標籤、名單一排 | STANDARD | no | 01 | 完成（2026-10-11） |
| 03 | 老師「我的課程」系列卡 | STANDARD | no | – | 完成（2026-10-11） |
| 04 | 老師系列管理頁：每列快速按鈕、整期名單一排 | STANDARD | no | 01 | 完成（2026-10-11） |
| 05 | 團主與管理員單堂頁套用操作列與期班標籤 | STANDARD | no | 01 | 完成（2026-10-11） |
| 06 | 管理員課程清單系列卡與唯讀系列頁 | STANDARD | yes（新增管理員查詢，需 security review） | 03 | 完成（2026-10-11） |
| 07 | 通知記錄系列 ID（schema）與批次動作只發一則 | HEAVY | yes（schema，已放行設計） | – | 完成（2026-10-11） |
| 08 | 通知頁合併顯示 | STANDARD | no | 07 | 完成（2026-10-11） |
| 09 | 驗收與文件同步 | STANDARD | no | 02、04、05、06、08 | 完成（2026-10-11，管理員名單一排待確認） |

```text
01 ──> 02 ──┐
01 ──> 04 ──┤
01 ──> 05 ──┤
03 ──> 06 ──┼──> 09
07 ──> 08 ──┘
```

03 與 07 不依賴 01，可先做；07 是唯一的 schema 票，獨立 worktree。

## 共同規則

- 按鈕可用條件沿用既有 service 與 action，不改 state machine、權限、報名或付款驗證（spec 3）。
- 每個畫面跑 375px 橫向溢出檢查；按鈕攤開與收進「更多」要在桌面與手機各驗一次。
- 測試用獨立埠與獨立資料庫；票 07 用獨立 worktree 與獨立測試資料庫，不碰開發用資料庫。
- 改動只 commit 自己的檔案，push 前重查 `origin/main..main`。

<!-- codex-peer-reviewed: 2026-10-11T00:37:44Z rounds=3 verdict=approved -->

## 進度紀錄（2026-10-11）

- 票 01：`class-action-slots.ts`（依角色與狀態挑兩顆常駐按鈕）、`series-badge.ts`（期班第幾堂／持續開課）、`ActionBar`／`InfoTip`、名單一排元件（`RosterRow`、`PaymentInline`、`PaymentActionButton`、`SingleEnrollmentTag`）。
- 票 02：老師單堂頁操作列、期班標籤、名單一排；「分享給學員」「取消這堂課」兩個區塊移除，分享文案收成可展開區；「下一步」縮成一行並在有待確認時附「前往確認報名」。
- 票 03：`teacher-class-list.ts` 系列收合（不重複學員數、最急待處理）與系列卡；系列頁「回我的課程」回到同一分頁與同一張卡。
- 票 04：系列頁每一場一顆快速按鈕（開放報名／取消這一場／標記完成），做完捲回那一場；整期名單一排。
- 票 05：團主單堂頁操作列（複製連結沿用 `ClassShareLink`，開放、完成、取消改確認視窗）；管理員單堂頁只有「取消課程」一顆、加期班標籤。**管理員名單一排尚未做**（spec 2.4 註明實作前先跟產品主人確認）。
- 票 06：管理員課程清單系列卡、唯讀系列頁 `/admin/classes/series/[id]`（`requireAdmin`，非管理員 404）。
- 票 07：migration `20261011011121_notification_series_grouping`（只套到本 worktree 的測試資料庫）；批次動作一人一則（建立系列、生成更多、取消整個系列、從這場以後全部取消），所有課程相關發送點帶系列 id；批次通知以 `linkToSeries` 連到系列頁（站內與 email 一致）；學員通知用自己第一堂的課名。
- 票 08：通知頁合併（同類型、同系列、同一天，`grouping.ts`），合併後與批次通知連到系列頁。
- 票 09：新測試 `teacher-series-rollup.spec.ts`；更新舊測試；`data-model.md`、`backlog.md`（自動標記完成）已同步。Codex 程式碼審查 3 輪通過。
- 已知、與本批無關：`transactional-email.spec.ts` 的 email 規則表測試在 `main` 上因別的 session 新增 `teacher_photo_removed` 而未同步，不在本批修改範圍。

