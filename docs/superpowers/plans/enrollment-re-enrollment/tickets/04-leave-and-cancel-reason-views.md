# 04: 老師名單與管理員顯示取消原因

來源：[spec 4.5](../../../../specs/enrollment-re-enrollment-spec.md)。

**What to build:** 老師看期班整期學員名單時，「請假」和「管理員取消」分開列示，舊資料「原因未記錄」另列，不再靠推測。管理員在課程詳情頁完整名單中，已取消的報名旁邊顯示取消原因（學員取消、學員請假、老師婉拒、管理員取消、老師停課、學員退出整期、系統取消、原因未記錄）。不新增代學員取消請假的操作。

**Blocked by:** 01

**Status:** 完成（2026-10-10，測試通過）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（唯讀顯示；不改 schema、權限、state machine）。

- [x] `listOwnTermEnrollmentsForTeacher`：`leaveDates` 改依 `cancelledBy = member`，另回傳管理員取消日期與原因未記錄日期；老師停課、退出整期、婉拒整期造成的取消沿用現狀不列
- [x] 老師期班頁整期學員列顯示三組日期，文案分開
- [x] 管理員課程詳情頁完整名單顯示取消原因（對照 spec 4.1 顯示表）
- [x] 測試：各種取消來源在老師端與管理員端顯示正確；舊資料顯示「原因未記錄」

## 進度紀錄（2026-10-10）

- 新增 `cancel-reason.ts`（顯示用取消原因，不另存）；管理員課程詳情頁名單在已取消的報名旁顯示原因；老師期班頁整期學員列拆成「請假」「管理員取消」「已取消（原因未記錄）」三組，不再用「請假或取消」。
- 新增 `cancel-reason-views.spec.ts`（桌面＋手機 4 項）；更新 `term-acceptance` 的預期。相關 spec 41 項通過；`admin-class-session-management` 的「取消中狀態」測試第一次失敗，與先前記錄的不穩定一致（單獨重跑通過）。

<!-- codex-peer-reviewed: 2026-10-09T16:22:17Z rounds=3 verdict=approved -->
