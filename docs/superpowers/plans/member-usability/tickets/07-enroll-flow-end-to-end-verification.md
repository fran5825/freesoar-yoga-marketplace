# 07: 登入回原頁的全流程驗證（決策 2、3、4）

**What to build:** 用真實流程驗證「點分享連結 → 看詳情 → 按報名 → Google 登入 → 回原頁 → 再按報名 → 完成」在手機與桌機都順暢，畫面數 ≤ 3，並補上 smoke 測試。這張以驗證與補洞為主，發現的問題在此票內修。

**Blocked by:** 02, 04, 08

**Status:** done（2026-10-03）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（測試請用 `PORT=3100`，避免連到 3000 開發伺服器）

**Source:** `docs/member-usability-plan.md`

- [x] 桌機與手機（375 寬）各完整走一次，記錄畫面數，確認 ≤ 3
- [x] smoke 測試涵蓋：訪客看詳情、登入回原頁、報名成功、待確認顯示、取消
- [x] 一屏內看到關鍵資訊，手機單手可完成
- [x] 發現的問題記在票內；超出範圍的放 `docs/backlog.md`

**驗收結果：**
- 畫面數：站內 3 個畫面（課程詳情 → 登入頁 → 回到同一堂課並報名）＋ Google 自己的帳號畫面；不算 Google 的畫面則符合 ≤ 3。登入後回原頁不會自動送出，學員自己按「確認報名」，報名完成留在同一頁（成功橫幅＋「查看我的報名」）。
- 一屏：手機（375 寬）訪客與登入後的第一屏都看得到標題、來源標籤、狀態、剩餘名額、老師、時間、地點與報名按鈕（登入後改用學員專區導覽列，header 只剩一行，見 signed-in-navigation 計畫）。
- smoke 測試：新增 `public-classes-discovery.spec.ts`「share link to enrolled」串起訪客詳情 → 帶 callbackUrl 的登入頁 → 模擬 Google 登入完成回到同一堂課（確認未自動報名）→ 報名 → 處理中與下一步文案、名額減少。報名成功、取消、待確認、他人報名不可取消由 `enrollment.spec.ts` 既有與票 02、03、05 新增的測試涵蓋。

**本票內修正：** 課程詳情原本以「團體：老師自己開的課」表示來源，與課程列表的「老師開課」標籤及名詞表不一致；改為標題下方顯示「團主團課／老師開課」標籤（重用 `ClassOriginTag`），團體欄位只在團主團課時顯示。讀取層多帶 `origin`，不動 schema。同步更新 `teacher-initiated-open-classes.spec.ts` 的對應斷言（該段已隨 commit 18bec17 先進入 main）。

**超出範圍，已記 backlog：** 第 15 項「課程詳情的登入後報名直接開 Google，省掉登入頁」（動到 Auth，需另外放行）。

**驗證：** tsc 通過；`public-classes-discovery`、`teacher-initiated-open-classes`、`enrollment`、`signed-in-navigation` 桌機＋手機 68 支：64 支通過；其餘 4 支（老師名單、老師課程詳情）當輪顯示 Internal Server Error，經查為其他工作階段在測試途中重新 build，於 build 未變動的情況下單獨重跑 4 支全過。
