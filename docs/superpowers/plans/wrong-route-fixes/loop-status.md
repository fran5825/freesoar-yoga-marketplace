# wrong-route-fixes：feature-loop 進度

開新對話打 `/feature-loop wrong-route-fixes` 會從這裡接續。

## 階段

| 階段 | 狀態 | 日期 | 產品主人的原話 |
| --- | --- | --- | --- |
| 1 想清楚（grill-with-docs） | 完成 | 2026-10-25 | 「全部照建議」（Q1 丙、Q2 不回填、Q3–Q6 照建議） |
| 2 寫 spec | 完成，範圍已確認 | 2026-10-25 | 「請切票」 |
| 3 切票 | 完成；Codex 審 2 輪通過 | 2026-10-25 | 「票切得對，全部放行（含 HEAVY 01），開始實作」 |
| 4 實作 | 進行中 | 2026-10-25 | |
| 5 收尾（commit 關卡） | 未開始 | | |
| 6 畫面驗收 | 未開始 | | |
| 7 回顧（retro） | 未開始 | | |

## 票

| 票 | Workflow mode | Human Gate | Blocked by | Status |
| --- | --- | --- | --- | --- |
| 01 新增 5 種 target，課程與報名類通知直達 | HEAVY | yes | – | in-progress |
| 02 需求類與管理員類通知直達 | STANDARD | no | 01 | draft |
| 03 申請頁老師專區導覽列（F12） | LIGHT | no | – | in-progress |
| 04 三個重複提示 | LIGHT | no | – | in-progress |
| 05 整合驗證、文件與畫面驗收 | STANDARD | no | 01–04 | draft |

## 已放行的票

全部 5 張（含 HEAVY 01），2026-10-25 產品主人一次放行。

## 下一步

01→02 在整合 worktree 做；03＋04 由 subagent 在另一個 worktree 同時做，做完合併回整合 branch，再跑 code-review、spec-review。

## 施工環境（2026-10-25 建立）

| 線 | 票 | worktree | branch | 測試 DB | 埠 |
| --- | --- | --- | --- | --- | --- |
| 整合＋通知 | 01→02、05 | `C:\Users\franz\fsy-wrf` | `wrong-route-fixes` | `freesoar_wrf_a` | 3310 |
| 畫面小修 | 03、04 | `C:\Users\franz\fsy-wrf-b` | `wrong-route-fixes-b` | `freesoar_wrf_b` | 3320 |

- 測試 DB 從 `freesoar_tfr_int` 複製（`CREATE DATABASE ... TEMPLATE`）。本機開發資料庫 `freesoar_yoga_marketplace_dev` 不動；合併回 main 時才對開發資料庫跑新增的 migration（只新增 enum 值），那一步要先問產品主人。
- spec 與票券已 commit 在 `wrong-route-fixes`（`66eebba`）；main 工作區的同名原稿已移除，避免合併衝突。

<!-- codex-peer-reviewed: 2026-10-25T01:42:34Z rounds=2 verdict=approved -->
