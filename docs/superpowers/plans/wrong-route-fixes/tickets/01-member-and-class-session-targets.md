# 01: 新增 5 種通知 target，課程與報名類通知直達

來源：[spec](../../../../specs/wrong-route-fixes-spec.md)「通知 target」。

**What to build:** 一次 migration 新增 5 種 target 值，通知連結白名單補上對應頁面；課程與報名類通知（課程已建立〔團主媒合〕、課程異動、課程取消、報名待審核、補課自動報名）發送時給每位收件人帶上自己身分的 target。同時是老師＋團主＋學員的帳號，收到這些通知點進去都走到對的頁面，email 連結也一樣。

**Blocked by:** None (can start immediately)

**Status:** done

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** Prisma schema：`NotificationTargetType` 新增 5 個 enum 值（只用 ADD VALUE，不改既有資料，需 migration）；在獨立 worktree＋獨立測試資料庫做，不碰本機開發資料庫（需產品主人確認：2026-10-25 grill Q1 已選丙，執行仍需放行）

- [x] migration 只新增 `member_class_session`、`organizer_demand_request`、`teacher_demand_request`、`admin_demand_request`、`admin_teacher_application`
- [x] 連結白名單補 5 種；`member_class_session` 依通知類型：課程取消 →「我的報名」，其餘 → 學員課程頁
- [x] 課程已建立（團主媒合建課）：老師、團主各帶自己的單堂 target
- [x] 課程異動（老師改單堂）：學員帶 `member_class_session`
- [x] 課程取消（團主／管理員取消、老師取消一堂）：團主、老師、學員各帶自己的單堂 target；批次取消維持連系列頁
- [x] 報名待審核：單堂學員帶 `member_class_session`、老師帶 `teacher_class_session`；整期老師帶 `teacher_class_series`、學員維持連期班頁
- [x] 整期報名待審核的學員 email 也要連期班頁：目前站內靠「有系列、沒 target」連系列頁，email 卻只在 `linkToSeries` 為 true 時才用系列連結，否則退回依身分猜；這張票要讓 email 也走系列連結（例如發送時傳 `linkToSeries: true`），smoke 驗證多重身分學員的站內連結與 email 連結都是 `/classes/terms/<id>`
- [x] 系列場次帶單堂 target 後：單獨一則直達那堂課；同系列同一天合併成一則時連系列頁（smoke 各驗一次）
- [x] 補課自動報名：學員帶 `member_class_session`
- [x] 舊通知（沒有 target）連結不變
- [x] email 連結與站內一致
- [x] smoke：用同時是老師＋團主＋學員的帳號驗證以上每一種
- [x] `docs/domain/data-model.md` 同步更新

## 進度紀錄

- 2026-10-25 完成：migration `20261025120000_notification_role_targets`（5 個 ADD VALUE）已套用到 `freesoar_wrf_a`；`link.ts` 白名單補 5 種（`member_class_session` 依通知類型分流）；課程已建立（團主媒合）、課程異動、課程取消（團主／管理員、老師）、報名待審核（單堂、整期老師）、補課自動報名都帶 target。email 規則改成比照通知頁：屬於系列又沒帶 target 就連系列頁（整期待審核、改整個系列的學員 email 因此不再依身分猜）。新 smoke `notification-role-targets.spec.ts` 10/10 過；相關既有 smoke 248 過、12 個既有 skip。範圍差異：補課自動報名只有程式，沒有獨立 smoke（同一個 target 與連結已由其他案例涵蓋）。

<!-- codex-peer-reviewed: 2026-10-25T01:42:34Z rounds=2 verdict=approved -->
