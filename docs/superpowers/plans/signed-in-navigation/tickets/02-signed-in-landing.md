# 02: 登入後直接到上次身分的總覽（決策 6、7）

**What to build:** 已登入的人打開首頁、Google 登入完成、已登入時打開登入頁，都直接到上次身分的總覽；網址有指定要回某堂課（callbackUrl）時照舊回那堂課。

**Blocked by:** 01

**Status:** done（2026-09-27）

**Workflow mode:** HEAVY

**Human Gate:** yes（2026-09-27 產品主人同意票單並要求整批做完，視為放行；完成後單獨列出登入流程改動給產品主人看）

**Risk flags:** Auth（登入完成後的導向）；需產品主人確認。callbackUrl 仍需經 `sanitizeCallbackUrl` 過濾，不能變成開放轉址。

**Source:** `docs/signed-in-navigation-plan.md`

- [x] 已登入開 / → 上次身分總覽；訪客照舊看首頁
- [x] 登入完成預設去上次身分總覽；有 callbackUrl 時回 callbackUrl
- [x] 已登入開 /sign-in → callbackUrl 或上次身分總覽
- [x] 外部網址的 callbackUrl 仍被擋下（既有測試通過）

**實作紀錄：** 首頁：已登入 → `redirect(getLastRoleHome())`。登入頁：已登入 → callbackUrl（先經 `sanitizeCallbackUrl`）或上次身分總覽；原本「你已經登入了」畫面移除。Google 登入完成預設回 `/`，再由首頁導到上次身分總覽，判斷只寫在一處。測試涵蓋：無上次身分→學員、進過老師專區→老師、站內 callbackUrl 優先、站外 callbackUrl 被擋。

驗證：build、tsc、eslint 通過；整套 smoke 測試 590 支中 587 通過，3 支失敗已處理（團主通知測試依決策 3 改為先進團主專區，重跑通過；老師申請頁一支在整套負載下載入逾時，單獨重跑 3 輪全過）；新增 `tests/smoke/signed-in-navigation.spec.ts` 桌機＋手機 10 支全過。
