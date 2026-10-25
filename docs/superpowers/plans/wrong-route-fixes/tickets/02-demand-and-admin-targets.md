# 02: 需求類與管理員類通知直達

來源：[spec](../../../../specs/wrong-route-fixes-spec.md)「通知 target」。

**What to build:** 需求送審、老師回應需求、選定老師、需求取消、老師申請送出這些通知，發送時給團主、老師、管理員各帶自己身分的 target。同時是老師＋團主的帳號，以及同時是團主或老師的管理員，點進去都走到對的頁面。

**Blocked by:** 01（用到 01 新增的 enum 值與連結白名單）

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（只用 01 已加的 target 值；不改權限，點進去照既有檢查）

- [x] 需求送審：團主帶 `organizer_demand_request`，管理員帶 `admin_demand_request`
- [x] 老師回應需求：團主帶 `organizer_demand_request`，管理員帶 `admin_demand_request`
- [x] 選定老師：團主帶 `organizer_demand_request`，老師帶 `teacher_demand_request`（連「團體需求」列表）
- [x] 需求取消：團主帶 `organizer_demand_request`，受影響老師帶 `teacher_demand_request`
- [x] 老師申請送出：管理員帶 `admin_teacher_application`，申請人本人不變
- [x] smoke：同時是老師＋團主的帳號、同時是團主的管理員各驗證一次

## 進度紀錄

- 2026-10-25 完成：需求送審、老師回應、選定老師、需求取消、老師申請送出都帶 target。smoke 驗證了團主（回應、選定）、回應老師（需求取消）、兼團主＋老師的管理員（回應）。範圍差異：需求送審與老師申請送出要登入狀態才能觸發，沒寫 smoke，只有程式與型別檢查，畫面驗收時用管理員帳號看。

<!-- codex-peer-reviewed: 2026-10-25T01:42:34Z rounds=2 verdict=approved -->
