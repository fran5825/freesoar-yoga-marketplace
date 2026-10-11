# 學員端就地報名：票券總覽

來源：[spec 草稿](../../../specs/member-inline-enroll-spec.md)（產品主人 2026-10-10 以 `/grill-with-docs` 確認 Q1–Q9，含 2.3 價格做法）。純畫面、read service 與 server action 串接，不動 schema、權限、state machine，沒有 HEAVY 票、沒有需要產品主人放行的 Human Gate。

**施工前提（spec Q8）：** `worktree-inline-actions`（`inline-member-actions` 票 01–05）已於 2026-10-10 合進 `main`，本批在其後施工。spec 已移到 `docs/specs/member-inline-enroll-spec.md`，並在舊 spec 3.4、I7 註明被取代；本目錄保留原位（票號 06–10 接續 `inline-member-actions`）。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 06 | 共用「報名列」元件、列狀態、返回與價格規則 | STANDARD | no | `inline-member-actions` 合併 | 完成（2026-10-11） |
| 07 | 系列頁（持續開課）每列可報名 | STANDARD | no | 06 | 完成（2026-10-11） |
| 08 | 單堂頁：第一張卡內報名、同系列列表就地報名 | STANDARD | no | 06 | 完成（2026-10-11） |
| 09 | 期班頁每一堂可單堂報名、備註收起 | STANDARD | no | 06 | 完成（2026-10-11） |
| 10 | 驗收與文件同步 | STANDARD | no | 07、08、09 | 完成（2026-10-11） |

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

## 進度紀錄（2026-10-11）

- 票 06：`session-enroll-rows.ts`（列狀態，含整期列沿用 `TermRowControl`、重新報名、不可重報原因、整期已退出／被婉拒的已取消列只寫原因）、`EnrollRow`／`RowExpander` 元件、`enroll-row-actions.ts`（就地報名、取消單堂、訪客登入回到同一列並自動展開）、返回路徑白名單加入系列頁、每一場價格與繳費規則顯示在展開區。
- 票 07：系列頁每一列可報名。票 09：期班頁「查看每一堂」用共用列，帶 `focus`／`open` 回來時自動展開；重新報名的備註改「加備註」。
- 票 08：單堂頁取消兩張獨立報名卡，報名區在第一張卡內（`ClassCardEnroll`），同系列列表用共用列，標題旁加期班／持續開課標籤；登入回來一律帶 `enroll=1` 讓表單展開。
- 票 10：新測試 `inline-enroll-rows.spec.ts`；更新約 20 支跟著新畫面的舊測試。桌面完整套件與兩個專案的受影響套件都通過；Codex 程式碼審查 3 輪通過。

