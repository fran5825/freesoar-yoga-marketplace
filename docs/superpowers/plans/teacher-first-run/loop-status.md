# teacher-first-run：feature-loop 進度

開新對話打 `/feature-loop teacher-first-run` 會從這裡接續。

## 階段

| 階段 | 狀態 | 日期 | 產品主人的原話 |
| --- | --- | --- | --- |
| 1 想清楚（grill-with-docs） | 完成 | 2026-10-24 | 「Q1–Q6 全部照建議」「全部照建議」（Q7–Q11）「對，Q12 A、Q13 B」 |
| 2 寫 spec | 完成，範圍已確認 | 2026-10-24 | 「範圍對，接著切票」 |
| 3 切票 | 完成；Codex 審 2 輪通過 | 2026-10-24 | 「票切得對，02、05、06 全部放行，開始實作」 |
| 4 實作 | 完成：01–10 done；code-review＋spec-review 修正已套用；smoke 644/676 過，19 個失敗經 main 對照皆為既有問題 | 2026-10-24 | |
| 5 收尾（commit 關卡） | 等待產品主人：是否合併回 main、是否對開發資料庫跑 migration、開始使用第 3 步入口 | 2026-10-24 | |
| 6 回顧（retro） | 未開始 | | |

## 已放行的票

全部 10 張（含 HEAVY 02、05、06），2026-10-24 產品主人一次放行。

## 下一步

依 `implement-spec` 執行：integration branch `teacher-first-run`；三條線各自的 worktree、branch、測試 DB、埠見下方「施工環境」。三條線完成後合併、做票 10、跑 code-review 與 spec-review，再到收尾關卡。

## 實作中追加的決定

- 2026-10-24：期班學員單堂請假時也通知老師（站內通知，連到那堂課）。產品主人原話：「2」（回覆「請假要不要通知老師」的選項 2）。歸在 B 線票 05。
- 2026-10-24：實作中 Docker Desktop 未啟動，三條線的 smoke 暫停；產品主人啟動後繼續（「開好了」）。

## 施工環境（2026-10-24 建立）

| 線 | 票 | worktree | branch | 測試 DB | 埠 |
| --- | --- | --- | --- | --- | --- |
| 整合 | 10 | `C:\Users\franz\fsy-tfr` | `teacher-first-run` | （合併後再定） | – |
| A 建課 | 01→02→03 | `C:\Users\franz\fsy-tfr-a` | `teacher-first-run-a` | `freesoar_tfr_a` | 3310 |
| B 通知 | 04→05→06 | `C:\Users\franz\fsy-tfr-b` | `teacher-first-run-b` | `freesoar_tfr_b` | 3320 |
| C 總覽 | 07→08→09 | `C:\Users\franz\fsy-tfr-c` | `teacher-first-run-c` | `freesoar_tfr_c` | 3330 |

- spec、票券與 glossary 已 commit 在 `teacher-first-run`（66363eb）；main 工作區裡的同名檔案是未提交的原稿，合併回 main 前要先處理掉，避免衝突。
- 本機開發資料庫 `freesoar_yoga_marketplace_dev` 不動；B 線的 migration 只跑在 `freesoar_tfr_b`。合併回 main 時，才對開發資料庫跑新增的 migration（只新增 enum 值），那一步要先問產品主人。

## 產出檔案（尚未 commit）

- `docs/specs/teacher-first-run-spec.md`
- `docs/context/glossary.md`（新增「團體需求」「開始使用」）
- `docs/superpowers/plans/teacher-first-run/`（本檔、票券總覽、10 張票）

<!-- codex-peer-reviewed: 2026-10-24T08:10:27Z rounds=2 verdict=approved -->
