# 就地請假與精簡卡片：票券總覽

來源：[spec](../../../specs/member-inline-actions-and-card-cleanup-spec.md)。建立日期：2026-10-10。純畫面與 server action 串接，不動 schema、權限、state machine，因此沒有 HEAVY 票、沒有需要產品主人放行的 Human Gate。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 01 | 共用就地元件，先用在「我的報名」頁整期卡 | STANDARD | no | – | 完成（2026-10-10） |
| 02 | 期班頁每一堂列的請假按鈕 | STANDARD | no | 01 | 完成（2026-10-10） |
| 03 | 單堂頁第一張卡（狀態與動作）、同系列列表按鈕、持續開課連結 | STANDARD | no | 01 | 完成（2026-10-10） |
| 04 | 「待你處理」沒事項時隱藏、有事項放第一張 | LIGHT | no | – | 完成（2026-10-10） |
| 05 | 驗收與文件同步 | STANDARD | no | 02、03、04 | draft |

```text
01 ──> 02 ──┐
01 ──> 03 ──┼──> 05
04 ─────────┘
```

02、03 都用 01 的共用元件，03 改的檔案最多，建議順序 01 → 02 → 03 → 04 → 05。

## 共同規則

- 每個展開畫面都跑 375px 寬度橫向溢出檢查；按鈕顯示條件在 service layer／共用函式算好：有效報名的請假沿用 `cancelOwnEnrollment` 的資格，已請假的列用 `getReEnrollState`。
- 測試用獨立埠 3600 與獨立資料庫（worktree 內已設定）；改動只 commit 自己的檔案，push 前重查 `origin/main..HEAD`。

<!-- codex-peer-reviewed: 2026-10-09T23:48:40Z rounds=6 verdict=approved -->
