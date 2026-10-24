# 06: 新團體需求通知老師、名稱統一為「團體需求」

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 需求經管理員核准公開時，所有已通過審核的老師（排除發起這筆需求的團主本人）收到站內通知，點了到老師的「團體需求」頁。老師導覽列「需求池」改為「團體需求」；空畫面拿掉「符合條件」，說明需求要經過平台審核才公開、目前大新竹地區數量還不多，有新需求時會收到通知。

**Blocked by:** 05（兩張票都改 schema 與 migration，排隊做避免衝突）

**Status:** in-progress（程式完成，smoke 待跑）

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** Prisma schema：`NotificationType` 新增一個 enum 值（只新增，需 migration）；在獨立 worktree＋獨立測試資料庫做（需產品主人確認：2026-10-24 Q12 已同意 schema 方向，執行仍需放行）

- [ ] migration 只新增一個 enum 值
- [ ] 需求公開時，所有 approved 老師收到一則站內通知；暫停、審核中、被退回、草稿的老師不會收到
- [ ] 發起的團主本人若也是老師，只收到團主那則
- [ ] 通知失敗不影響需求公開
- [ ] EMAIL_POLICY 為新類型加一筆空陣列
- [ ] 導覽列與頁面標題都是「團體需求」，空畫面文案更新
- [ ] data-model 文件同步更新
- [ ] smoke 測試通過（含 teacher-demand-pool 既有文案更新）

## 進度紀錄

- 2026-10-24 動工前計畫：schema 只在 `NotificationType` 加 `demand_request_available`（migration 只有一行 `ALTER TYPE "NotificationType" ADD VALUE 'demand_request_available'`）；在 `publishDemandRequestForAdmin` 既有的團主通知之後，另外發給所有 `approved` 老師（排除發起團主本人的 userId），不帶 target，`link.ts` 依類型連到 `/teacher/demands`；`EMAIL_POLICY` 加空陣列；失敗沿用 try/catch 只記 log，不影響公開。介面文字「需求池」統一改「團體需求」（glossary 已列為避免用詞），空畫面文案照 spec。只在 worktree 的 `freesoar_tfr_b` 跑。回滾：revert 這張票的 commit；Postgres 不能刪 enum 值，已套用的資料庫留著不用的值不影響既有資料。
- 2026-10-24 程式、migration `20261024120100_notification_demand_request_available`（只有一行 ADD VALUE）與 smoke 測試（`tests/smoke/teacher-demand-available-notification.spec.ts`）已寫好，tsc／lint 通過；本機 Postgres 沒啟動，migration 尚未套用、smoke 尚未執行。範圍差異：「需求池」在團主下一步、管理員需求頁、FAQ、需求公開通知的文案也一起改成「團體需求」（glossary 已列為避免用詞）。空畫面文案沒有 smoke（共用資料庫裡的公開需求數量不固定）。
