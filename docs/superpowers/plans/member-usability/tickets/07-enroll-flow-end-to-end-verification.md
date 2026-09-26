# 07: 登入回原頁的全流程驗證（決策 2、3、4）

**What to build:** 用真實流程驗證「點分享連結 → 看詳情 → 按報名 → Google 登入 → 回原頁 → 再按報名 → 完成」在手機與桌機都順暢，畫面數 ≤ 3，並補上 smoke 測試。這張以驗證與補洞為主，發現的問題在此票內修。

**Blocked by:** 02, 04

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（測試請用 `PORT=3100`，避免連到 3000 開發伺服器）

**Source:** `docs/member-usability-plan.md`

- [ ] 桌機與手機（375 寬）各完整走一次，記錄畫面數，確認 ≤ 3
- [ ] smoke 測試涵蓋：訪客看詳情、登入回原頁、報名成功、待確認顯示、取消
- [ ] 一屏內看到關鍵資訊，手機單手可完成
- [ ] 發現的問題記在票內；超出範圍的放 `docs/backlog.md`
