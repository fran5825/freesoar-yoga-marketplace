# wrong-route-fixes：feature-loop 進度

開新對話打 `/feature-loop wrong-route-fixes` 會從這裡接續。

## 階段

| 階段 | 狀態 | 日期 | 產品主人的原話 |
| --- | --- | --- | --- |
| 1 想清楚（grill-with-docs） | 完成 | 2026-10-25 | 「全部照建議」（Q1 丙、Q2 不回填、Q3–Q6 照建議） |
| 2 寫 spec | 完成，範圍已確認 | 2026-10-25 | 「請切票」 |
| 3 切票 | 完成；Codex 審 2 輪通過 | 2026-10-25 | 「票切得對，全部放行（含 HEAVY 01），開始實作」 |
| 4 實作 | 完成：01–04 done；code-review＋spec-review 修正已套用；完整 smoke 1591 過、33 skip、2 個過時斷言已修 | 2026-10-25 | |
| 5 收尾（commit 關卡） | 完成：合併進 main（`557a034`），未 push；開發資料庫已套用 `20261025120000_notification_role_targets`。產品主人停掉開發伺服器後 `prisma generate` 成功（2026-10-26） | 2026-10-26 | 「把 wrong-route-fixes 合併進 main，並對開發資料庫跑那個 migration；不要 push」 |
| 6 畫面驗收 | 完成：9 個畫面全部通過；發現 10 項，F9-1、F8-1 這輪修（`197345d`）並通過畫面驗收，其餘記進 backlog 第 28～30 項 | 2026-10-26 | 「照建議：F9-1、F8-1 這輪修，其他記進 backlog，F7-6 另開一輪」「F8-1 通過」「F9-1 通過」 |
| 7 回顧（retro） | 完成：7 項建議全部採用（`playwright.config.ts` 擋開發資料庫、畫面驗收手冊補開發伺服器與 Claude in Chrome 填表、backlog 第 31 項、feature-loop 驗收前先說明發現怎麼處理、spec-review 審查員不准動 git HEAD、Claude memory 補 CRLF） | 2026-10-26 | 「7 條全部照建議做」 |

**閉環完成（2026-10-26）。**

## 票

| 票 | Workflow mode | Human Gate | Blocked by | Status |
| --- | --- | --- | --- | --- |
| 01 新增 5 種 target，課程與報名類通知直達 | HEAVY | yes | – | done |
| 02 需求類與管理員類通知直達 | STANDARD | no | 01 | done |
| 03 申請頁老師專區導覽列（F12） | LIGHT | no | – | done |
| 04 三個重複提示 | LIGHT | no | – | done |
| 05 整合驗證、文件與畫面驗收 | STANDARD | no | 01–04 | done |

## 已放行的票

全部 5 張（含 HEAVY 01），2026-10-25 產品主人一次放行。

## 下一步

閉環完成。剩下的事都要產品主人決定：

- retro 的修改與驗收紀錄 commit（main），以及要不要 push（push 前重查 `git log origin/main..main`）。
- 清理施工環境（會刪東西，要先問）：worktree `C:\Users\franz\fsy-wrf`、`C:\Users\franz\fsy-wrf-b`，branch `wrong-route-fixes`、`wrong-route-fixes-b`，測試 DB `freesoar_wrf_a`、`freesoar_wrf_b`；`freesoar_tfr_int` 保留。
- 開發資料庫裡的測試資料（清單在票 05）與 3 個以前 smoke 留下的 `.local` 帳號要不要刪。
- 下一輪候選：backlog 第 30 項（全站逐頁設計檢視，可先從第 28 項的老師申請表單開始）、第 29 項、第 31 項。

## 施工環境（2026-10-25 建立）

| 線 | 票 | worktree | branch | 測試 DB | 埠 |
| --- | --- | --- | --- | --- | --- |
| 整合＋通知 | 01→02、05 | `C:\Users\franz\fsy-wrf` | `wrong-route-fixes` | `freesoar_wrf_a` | 3310 |
| 畫面小修 | 03、04 | `C:\Users\franz\fsy-wrf-b` | `wrong-route-fixes-b` | `freesoar_wrf_b` | 3320 |

- 測試 DB 從 `freesoar_tfr_int` 複製（`CREATE DATABASE ... TEMPLATE`）。本機開發資料庫 `freesoar_yoga_marketplace_dev` 不動；合併回 main 時才對開發資料庫跑新增的 migration（只新增 enum 值），那一步要先問產品主人。
- spec 與票券已 commit 在 `wrong-route-fixes`（`66eebba`）；main 工作區的同名原稿已移除，避免合併衝突。

<!-- codex-peer-reviewed: 2026-10-25T01:42:34Z rounds=2 verdict=approved -->
