# 03: 我的使用入口中心 /account（決策 15）

**What to build:** 「我的帳戶」變成依身分列出入口的中心：會員總覽、團主總覽、老師總覽各自顯示；還沒有的身分顯示「開始成為團主／老師」。同時是老師又是團主的人可自己選要去哪。樣式與其他登入後頁面一致，不再是陽春的 smoke 頁。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-25）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 只讀取身分狀態顯示入口，不改權限

**實作紀錄：** 已完成。`/account` 改成入口中心，並補上共用 header／footer，與其他頁一致。

**Source:** `docs/organizer-usability-plan.md`

- [x] 有團主身分：顯示「團主總覽」；沒有：顯示「開始成為團主」連到招募頁
- [x] 有老師身分：顯示「老師總覽」；沒有：顯示「開始成為老師」連到老師合作頁
- [x] 會員總覽入口保留
- [x] 頁面版型、字級、卡片樣式與其他登入後頁面一致；手機無橫向捲動
- [x] 更新 `account-dashboard-navigation` smoke 測試，桌機與手機通過
