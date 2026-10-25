# teacher-first-run：交接（2026-10-24）

給接手的 Claude：這份是「老師第一次使用」這輪 feature-loop 的交接。先讀這份，再讀 `AGENTS.md`、同資料夾的 `loop-status.md` 與 `tickets/10-acceptance-and-docs.md`，最後跑 `git log --oneline -5` 與 `git status` 確認現況。以 git 紀錄為準，這份只負責導讀。

## 與產品主人合作的方式（換帳號不會自動帶過去，請照做）

- 產品主人 Franz 沒有寫程式背景，但想邊做邊學。用繁體中文；技術名詞保留英文，第一次出現附一句白話解釋，格式「英文（中文，一句解釋）」；比喻用台灣日常場景（超商、捷運、銀行櫃檯）。
- 每個動作講「做了什麼、為什麼」；小步前進，做一步回報一步。
- 每次回覆結尾三點：我做了什麼／有沒有成功／你接下來要做的一件具體的事。要他決定時最多兩個選項，各一行 trade-off，並給建議。
- 不用空泛詞（「已優化」「更穩健」），講具體改了什麼。
- 只有他明確說了才 commit／push。push 前一刻重列 `git log origin/main..main`，因為常有多個工作階段同時 commit 到 main。
- 刪資料、刪資料庫、改 schema、關掉別人的程序、動 repo 以外的東西之前，先用白話講風險、等他同意。
- 不能替他輸入 Google 密碼；登入請他自己按。
- 每個提議要標明來源：是 skill 的指示，還是 Claude 自己的判斷。
- Playwright 一律用獨立埠（3100 起，先 `netstat` 確認沒人在聽），不要連到 3000 的開發伺服器。

## 這輪做了什麼

依 `docs/superpowers/plans/teacher-experience-walkthrough/2026-10-24-first-time-teacher-walkthrough.md`（flow-walkthrough skill 產出的走查報告）改善第一次加入老師的流程。spec：`docs/specs/teacher-first-run-spec.md`。10 張票全部 done，已合併進 **main（merge commit `f76e233`），2026-10-24 產品主人說「可以先push」後已 push 到 origin**。

產品主人在這輪做的決定（原話與日期在 `loop-status.md`）：Q1–Q13 照建議（Q12 A、Q13 B 改 schema 新增兩個 enum 值）；請假也通知老師（「2」）；「開始使用」第 3 步維持現在的做法（前兩步完成就收起）。

## 目前狀態（2026-10-24 晚上）

| 項目 | 狀態 |
| --- | --- |
| feature-loop 階段 1–5 | 完成。階段 5 產品主人原話：「合併回 main，照你寫的做法處理 state-machines.md，也對開發資料庫跑那兩個 migration；不要 push。開始使用第 3 步維持現在的做法」 |
| main | 含 `f76e233`；已 push（origin/main = `f76e233`） |
| 開發資料庫 `freesoar_yoga_marketplace_dev` | 已套用 `20261024120000_notification_teacher_class_series_target`、`20261024120100_notification_demand_request_available`（只新增 enum 值）；`prisma generate` 已跑 |
| `docs/domain/state-machines.md` | main 工作區有**另一個工作階段**未 commit 的一行改動（團主本人授課那行）。合併時暫存、合併後已放回，沒有衝突。**不要 commit 或還原它**，那是別人的工作；備份在 `C:\Users\franz\fsy-state-machines-other-session.patch` |
| 本 handoff 與 `loop-status.md` 更新 | 在 main 工作區，尚未 commit |
| Codex 審查 | 本 handoff 已送 Codex 審查（見檔尾標記） |
| 驗證 | tsc、lint、build 通過；smoke 最後一輪 676 筆：644 過、19 失敗、13 略過。19 個失敗拿改版前的 main 對照也一樣失敗，是既有問題（清單在票 10 進度紀錄） |
| 開發伺服器 3000 | 交接時沒有在跑；產品主人要看畫面時請他自己 `npm run dev` |

## 接下來要做的事（依順序）

> 2026-10-25 進度：第 1 項（畫面驗收）與第 2 項（retro）已完成，見 `loop-status.md` 階段 6、7。第 5 項已改成 `docs/backlog.md` 第 27 項並標 `test.fixme`。驗收建立的測試資料（開發資料庫）列在 `tickets/10-acceptance-and-docs.md`「產品主人畫面驗收紀錄」，清理時一併考慮。

1. **畫面驗收（產品主人親自看）**：票 10 列了 5 項：開始使用卡、建課預設公開與直接開放、收款提醒、老師收到的通知（含請假）、團體需求頁。用 Claude 的瀏覽器面板看 3000 埠，他要自己登入 Google。看到的問題記進票 10 或 `docs/backlog.md`。
2. **feature-loop 階段 6：retro**。讀 `.claude/skills/retro/SKILL.md` 照做，依嚴重度列建議請產品主人挑；改完再問要不要 commit；在 `loop-status.md` 標「閉環完成」。可以打 `/feature-loop teacher-first-run` 從進度檔接續。
3. **問要不要 commit 本 handoff／loop-status**（main 已 push，這兩份是之後的未提交改動）。再 push 前重查 `git log origin/main..main`。
4. **清理（要先問產品主人，刪資料庫屬於刪除資料）**：
   - worktree：`C:\Users\franz\fsy-tfr`、`fsy-tfr-a`、`fsy-tfr-b`、`fsy-tfr-c`、`fsy-tfr-base`（用 `git worktree remove`）
   - branch：`teacher-first-run`、`teacher-first-run-a`、`-b`、`-c`（已合併）
   - 測試資料庫：`freesoar_tfr_a`、`freesoar_tfr_b`、`freesoar_tfr_c`、`freesoar_tfr_int`、`freesoar_tfr_base`（在 Docker 的 Postgres 容器 `freesoar-yoga-marketplace-postgres` 裡）
   - smoke 紀錄：`C:\Users\franz\fsy-tfr-smoke-full-1.log`
5. **既有的 19 個 smoke 失敗**：建議記進 `docs/backlog.md` 當成一項待查（不是這輪造成的）。
6. **下一輪範圍**：走查報告的 F7（建課欄位說明）、F10（老師介紹頁改版，要用 `/impeccable`）、F12（申請頁導覽列）、F14（待你處理卡看起來不能點）、F15（登入後回到原本頁面）。開新 feature-loop 前先問產品主人。

## 注意

- Docker Desktop 要開著，Postgres 才連得到（本輪中途曾因為沒開而卡住）。
- 新的流程走查 skill：`.claude/skills/flow-walkthrough/`，之後檢查學員、團主流程可以直接用。

<!-- codex-peer-reviewed: 2026-10-24T12:25:58Z rounds=1 verdict=approved -->
