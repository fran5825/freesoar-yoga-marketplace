# 系列收合、操作列與通知合併：票券總覽

來源：[spec](../../../specs/teacher-series-rollup-and-action-bar-spec.md)、[ADR 0008](../../../adr/0008-notification-series-grouping.md)。建立日期：2026-10-11。產品主人已於 `/grill-with-docs` 放行整體設計與 `Notification` 新增欄位的 schema 變動；HEAVY 票仍逐票 Human Gate。

**施工前提：** `inline-member-enroll`（學員端就地報名，票 06–10）先完成。學員單堂頁的期班標籤已併入該批票 08。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 01 | 共用元件：操作列、期班標籤、報名名單一排 | STANDARD | no | `inline-member-enroll` 完成 | 待開始 |
| 02 | 老師單堂頁套用操作列、期班標籤、名單一排 | STANDARD | no | 01 | 待開始 |
| 03 | 老師「我的課程」系列卡 | STANDARD | no | – | 待開始 |
| 04 | 老師系列管理頁：每列快速按鈕、整期名單一排 | STANDARD | no | 01 | 待開始 |
| 05 | 團主與管理員單堂頁套用操作列與期班標籤 | STANDARD | no | 01 | 待開始 |
| 06 | 管理員課程清單系列卡與唯讀系列頁 | STANDARD | yes（新增管理員查詢，需 security review） | 03 | 待開始 |
| 07 | 通知記錄系列 ID（schema）與批次動作只發一則 | HEAVY | yes（schema，已放行設計） | – | 待開始 |
| 08 | 通知頁合併顯示 | STANDARD | no | 07 | 待開始 |
| 09 | 驗收與文件同步 | STANDARD | no | 02、04、05、06、08 | 待開始 |

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
