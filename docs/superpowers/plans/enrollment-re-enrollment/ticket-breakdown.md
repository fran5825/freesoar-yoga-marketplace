# 重新報名與取消請假：票券總覽

來源：[spec](../../../specs/enrollment-re-enrollment-spec.md)、[ADR 0006](../../../adr/0006-re-enrollment-after-self-cancel.md)。建立日期：2026-10-10。產品主人已放行整體設計與 schema 變動（`/grill-with-docs`）；每張 HEAVY 票仍須在獨立 worktree 與獨立測試資料庫完成，測試通過才合併。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 01 | 記錄是誰取消的（schema 與所有取消寫入處） | HEAVY | yes（已放行 schema） | – | 完成（2026-10-10） |
| 02 | 單堂重新報名 | HEAVY | yes（動報名 state machine，已放行） | 01 | 完成（2026-10-10） |
| 03 | 取消請假與名額占用規則 | HEAVY | yes（動名額與 state machine，已放行） | 01 | draft |
| 04 | 老師名單與管理員顯示取消原因 | STANDARD | no | 01 | draft |
| 05 | 驗收與文件同步 | STANDARD | no | 02、03、04 | draft |

```text
01 ──> 02 ──┐
01 ──> 03 ──┼──> 05
01 ──> 04 ──┘
```

02、03 都改單堂頁的報名區（`ClassEnrollmentPanel`）與取消表單，不要同時施工；建議順序 01 → 02 → 03 → 04 → 05。

## 共同規則

- 依 spec 4.1，所有寫入 `cancelled` 的地方都要同時寫 `cancelledBy`，狀態離開 `cancelled` 時清為 `NULL`。
- 測試用獨立埠（例如 3500）與獨立資料庫；`PORT=<空埠> npx playwright test ...`。
- 不 commit 別的 session 的檔案；push 前重查 `origin/main..main`。

<!-- codex-peer-reviewed: 2026-10-09T16:22:17Z rounds=3 verdict=approved -->
