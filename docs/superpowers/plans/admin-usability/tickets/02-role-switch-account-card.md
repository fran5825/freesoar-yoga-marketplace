# 02: 角色切換選單與 /account 管理後台卡片（決策 6、7）

**What to build:** 導覽列右側有「目前身分」下拉，只列出此帳號已有的身分（學員／團主／老師／管理員），一點就切過去。管理員本人在選單與 `/account` 看得到「管理後台」，其他人看不到。

**Blocked by:** 01

**Status:** done（2026-09-26，待 Franz 看畫面）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** 決定誰看得到管理後台入口，屬於權限相鄰；只是連結顯示，不改權限，目標頁仍各自把關

**Source:** `docs/admin-usability-plan.md`

- [x] 有哪些身分沿用 `/account` 現有判斷，不重寫
- [x] 沒有的身分不顯示；一般使用者完全看不到管理後台入口
- [x] 團主端、老師端導覽列也出現同一個角色切換（共用元件）
- [x] 非管理員直接開 `/admin/*` 仍是 404
- [x] 桌機與手機 smoke 測試通過

**實作紀錄：** 角色切換做在共用的 `RoleNav`／`RoleShell`，所以管理後台、團主、老師、學員四個專區的導覽列都有。判斷擁有哪些身分的邏輯抽成 `src/app/_components/role-switch-options.ts`（與 `/account` 相同：有團主資料算團主、有老師資料算老師、`User.isAdmin` 算管理後台），只有兩種以上身分才顯示「目前身分」按鈕。`/account` 對管理員多一張「管理後台」卡片。新增 `tests/smoke/role-switch.spec.ts`（管理員四身分互相切換、非管理員看不到入口且 `/admin` 仍 404、只有學員身分不顯示切換），桌機＋手機通過；相關的 admin、account、organizer-usability、notification 測試共 38 支也通過（`PORT=3100`）。

**2026-09-26 後續調整（Franz 決定）：** 「我的帳戶」頁面（`/account`）已整個移除，所以本票的「`/account` 管理後台卡片」不再存在；管理後台入口只在角色切換選單。選單改成只要登入就顯示，沒有的身分列成「＋ 成為團主／老師」；登入後預設導向 `/member/dashboard`，公開網站頂端「我的帳戶」改為「我的專區」連到學員總覽。老師端「＋ 建立課程」、團主端「＋ 發起新需求」從導覽列右上角移到各自列表最底；四個總覽頁多餘的「老師專區」小字也拿掉。測試：新增 `create-actions-placement.spec.ts`，改寫 `role-switch.spec.ts`，刪除 `account-dashboard-navigation.spec.ts`；相關 76 支通過，`public-trust-pages` 的標題失敗是 backlog 1c 既有問題。
