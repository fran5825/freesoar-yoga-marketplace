# 05: 整期報名與退出整期時通知老師（新增系列 target）

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 新增「連到老師系列頁」的通知 target。學員整期報名時老師收到一則站內通知，學員退出整期時也收到一則，點了直達老師的系列頁。學員通知不變。

**Blocked by:** 04（共用報名通知的程式與測試）

**Status:** done

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** Prisma schema：`NotificationTargetType` 新增一個 enum 值（只新增，需 migration）；在獨立 worktree＋獨立測試資料庫做，不碰本機開發資料庫（需產品主人確認：2026-10-24 Q13 已同意 schema 方向，執行仍需放行）

- [x] migration 只新增一個 enum 值，不改不刪既有資料
- [x] 通知連結白名單新增老師系列頁，點進去照既有權限檢查
- [x] 退出整期目前用 `enrollment_cancelled`（切票時已查證），沿用同一類型新增老師收件人
- [x] 整期報名：老師一則站內通知，帶系列 target；一筆整期報名只發一則
- [x] 退出整期：老師一則站內通知，帶系列 target
- [x] 學員通知文案與目的地不變
- [x] data-model 文件同步更新
- [x] smoke 測試通過
- [x] 整期學員單堂請假：老師收到站內通知「有學員請假」（帶日期），連到那堂課的老師頁；學員通知不變、不寄 email（產品主人 2026-10-24 決定）

## 進度紀錄

- 2026-10-24 動工前計畫：schema 只在 `NotificationTargetType` 加 `teacher_class_series`（migration 只有一行 `ALTER TYPE "NotificationTargetType" ADD VALUE 'teacher_class_series'`）；`link.ts` 白名單對應 `/teacher/classes/series/<id>`（該頁照既有本人檢查，越權 not-found）；整期報名成立（confirmed）在既有那次通知加老師 counterpart 收件人；退出整期另發一則給老師（學員那次呼叫完全不動）。待確認的整期報名維持既有 `enrollment_pending_review`。只在 worktree 的 `freesoar_tfr_b` 跑。回滾：還沒上線，revert 這張票的 commit 即可；Postgres 不能刪 enum 值，若已套用到某個資料庫，留著不用的值不影響既有資料（或重建該測試資料庫）。
- 2026-10-24 程式、migration `20261024120000_notification_teacher_class_series_target`（用 `prisma migrate diff` 產生，只有一行 ADD VALUE）與 smoke 測試已寫好，tsc／lint 通過；本機 Postgres 沒啟動，migration 尚未套用、smoke 尚未執行。退出整期給老師的那則另外呼叫一次 notifyUsers，學員那次呼叫不動。
- 2026-10-24 產品主人決定（回答「2」）：整期學員單堂請假也通知老師（站內、`teacher_class_session` target、獨立的請假文案帶日期），取代 teacher-class-scheduling 推導規則 10 的老師端；已實作並加 smoke。完成：相關 smoke 通過；順手修正 `term-leave-withdraw.spec.ts` 一個既有的模糊 locator（「你已退出這一期」對到 4 個元素）。
