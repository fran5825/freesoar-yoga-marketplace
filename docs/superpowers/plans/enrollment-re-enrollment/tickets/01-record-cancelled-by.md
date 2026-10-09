# 01: 記錄是誰取消的

來源：[spec 4.1](../../../../specs/enrollment-re-enrollment-spec.md)、[ADR 0006](../../../../adr/0006-re-enrollment-after-self-cancel.md)。

**What to build:** 每一筆被取消的報名都記錄取消者：學員自己（含請假）、老師婉拒、管理員取消、系統連帶（整堂課被取消、學員退出整期）。舊資料維持「原因未記錄」。畫面行為此票不變。

**Blocked by:** None (can start immediately)

**Status:** 完成（2026-10-10，測試通過）

**Workflow mode:** HEAVY

**Human Gate:** yes（schema migration；產品主人已放行 additive 欄位與 enum，仍須在獨立 worktree＋獨立測試資料庫驗證，再對共用開發資料庫套 additive migration）

**Risk flags:** Prisma schema、migration、報名 state machine 寫入處；不改權限、不改 unique 約束。

- [x] 新增 enum `EnrollmentCancelledBy`（member／teacher／admin／system）與 `Enrollment.cancelledBy`（可為空）；DB check：`cancelledBy` 有值時 `status = cancelled`
- [x] 8 個取消寫入處都填對值：學員取消單堂與請假（`cancelOwnEnrollment`）＝member；老師婉拒單堂＝teacher；老師婉拒整期（連帶逐場）＝teacher；管理員取消＝admin；兩個整堂課取消核心（團主／老師，含 raw SQL）＝system；學員退出整期＝system；老師婉拒整期時，脫離整期的 `merged_single` 逐場若已是學員請假，同一動作把 `cancelledBy` 改為 system（spec 4.1，防止繞過 R8）
- [x] 測試：單堂報名→併入整期→請假→整期被婉拒，該筆 `cancelledBy` 為 system、之後不能重新報名
- [x] 舊資料 `cancelledBy` 為 NULL，migration 不補值
- [x] 每種來源各一個測試：取消後 `cancelledBy` 正確；DB check 擋下「非 cancelled 卻有 cancelledBy」
- [x] 既有報名、取消、期班、整堂取消相關測試全過
- [x] 更新 `docs/domain/data-model.md`（新欄位）

## 進度紀錄（2026-10-10）

- 獨立 worktree＋獨立資料庫 `freesoar_re_enroll_test`、獨立埠 3600。migration `20261009163320_enrollment_cancelled_by`（additive，已在測試庫套用；共用開發庫在合併時套用）。
- 新增 `enrollment-cancelled-by.spec.ts`（桌面＋手機 14 項）全過；相關既有 spec 共 164 項通過，3 項（admin 取消中狀態、admin-roster 手機）第一次失敗、重跑通過，與本票無關。

<!-- codex-peer-reviewed: 2026-10-09T16:22:17Z rounds=3 verdict=approved -->
