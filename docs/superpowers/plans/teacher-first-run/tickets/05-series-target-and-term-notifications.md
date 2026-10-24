# 05: 整期報名與退出整期時通知老師（新增系列 target）

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 新增「連到老師系列頁」的通知 target。學員整期報名時老師收到一則站內通知，學員退出整期時也收到一則，點了直達老師的系列頁。學員通知不變。

**Blocked by:** 04（共用報名通知的程式與測試）

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** Prisma schema：`NotificationTargetType` 新增一個 enum 值（只新增，需 migration）；在獨立 worktree＋獨立測試資料庫做，不碰本機開發資料庫（需產品主人確認：2026-10-24 Q13 已同意 schema 方向，執行仍需放行）

- [ ] migration 只新增一個 enum 值，不改不刪既有資料
- [ ] 通知連結白名單新增老師系列頁，點進去照既有權限檢查
- [ ] 退出整期目前用 `enrollment_cancelled`（切票時已查證），沿用同一類型新增老師收件人
- [ ] 整期報名：老師一則站內通知，帶系列 target；一筆整期報名只發一則
- [ ] 退出整期：老師一則站內通知，帶系列 target
- [ ] 學員通知文案與目的地不變
- [ ] data-model 文件同步更新
- [ ] smoke 測試通過

## 進度紀錄

