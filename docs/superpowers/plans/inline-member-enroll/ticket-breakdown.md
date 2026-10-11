# 學員端就地報名：票券總覽

來源：[spec 草稿](../../specs/member-inline-enroll-spec-draft.md)（產品主人 2026-10-10 以 `/grill-with-docs` 確認 Q1–Q9，含 2.3 價格做法）。純畫面、read service 與 server action 串接，不動 schema、權限、state machine，沒有 HEAVY 票、沒有需要產品主人放行的 Human Gate。

**施工前提（spec Q8）：** `worktree-inline-actions`（`inline-member-actions` 票 01–05）合進 `main` 之後才開始；本批的 `ClassSummary`、`TermRowControls`、單堂頁與它重疊。合併後把本目錄移到 `docs/superpowers/plans/inline-member-actions/`，票號 06–10 接在後面，並把 spec 草稿併入 `member-inline-actions-and-card-cleanup-spec.md`。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 06 | 共用「報名列」元件、列狀態、返回與價格規則 | STANDARD | no | `inline-member-actions` 合併 | 待開始 |
| 07 | 系列頁（持續開課）每列可報名 | STANDARD | no | 06 | 待開始 |
| 08 | 單堂頁：第一張卡內報名、同系列列表就地報名 | STANDARD | no | 06 | 待開始 |
| 09 | 期班頁每一堂可單堂報名、備註收起 | STANDARD | no | 06 | 待開始 |
| 10 | 驗收與文件同步 | STANDARD | no | 07、08、09 | 待開始 |

```text
06 ──> 07 ──┐
06 ──> 08 ──┼──> 10
06 ──> 09 ──┘
```

07、08、09 都用 06 的共用元件；08 改的檔案最多（取消兩張獨立報名卡），建議順序 06 → 07 → 09 → 08 → 10。

## 共同規則

- 列狀態、單堂與整期的操作資格全部在 service layer／共用函式算好，沿用 `TermRowControl`、取消服務與 `re-enroll-eligibility`，元件只顯示（spec 2.1）。
- 報名資格、名額、老師 approved、同意勾選驗證沿用既有 `enrollAction` 與 `validation.ts`，不改驗證與資料（spec 3）。
- 每個頁面票都要驗收 `result`、`message`、`focus`、`open` 的呈現位置（成功在頁面頂部、失敗回到原列、額滿時原因在該列上方）；共用部分在票 06。
- 每個展開畫面都跑 375px 寬度橫向溢出檢查。
- 測試用獨立埠與獨立資料庫（例如 3600 以外的空埠）；改動只 commit 自己的檔案，push 前重查 `origin/main..main`。

<!-- codex-peer-reviewed: 2026-10-10T04:28:49Z rounds=2 verdict=approved -->
