# teacher-first-run：feature-loop 進度

開新對話打 `/feature-loop teacher-first-run` 會從這裡接續。

## 階段

| 階段 | 狀態 | 日期 | 產品主人的原話 |
| --- | --- | --- | --- |
| 1 想清楚（grill-with-docs） | 完成 | 2026-10-24 | 「Q1–Q6 全部照建議」「全部照建議」（Q7–Q11）「對，Q12 A、Q13 B」 |
| 2 寫 spec | 完成，範圍已確認 | 2026-10-24 | 「範圍對，接著切票」 |
| 3 切票 | 完成；Codex 審 2 輪通過 | 2026-10-24 | 「票切得對，02、05、06 全部放行，開始實作」 |
| 4 實作 | 進行中（implement-spec，三條線並行） | 2026-10-24 | |
| 5 收尾（commit 關卡） | 未開始 | | |
| 6 回顧（retro） | 未開始 | | |

## 已放行的票

全部 10 張（含 HEAVY 02、05、06），2026-10-24 產品主人一次放行。

## 下一步

依 `implement-spec` 執行：integration branch `teacher-first-run`；三條線各自的 worktree、branch、測試 DB、埠見下方「施工環境」。三條線完成後合併、做票 10、跑 code-review 與 spec-review，再到收尾關卡。

## 產出檔案（尚未 commit）

- `docs/specs/teacher-first-run-spec.md`
- `docs/context/glossary.md`（新增「團體需求」「開始使用」）
- `docs/superpowers/plans/teacher-first-run/`（本檔、票券總覽、10 張票）

<!-- codex-peer-reviewed: 2026-10-24T08:10:27Z rounds=2 verdict=approved -->
