# 03: 詳情頁直接取消報名（決策 13）

**What to build:** 學員在課程詳情頁就能取消自己的報名，不必繞去「我的報名」。確認框明寫「取消後無法再次報名此課程」。取消規則與權限不變。

**Blocked by:** 02

**Status:** draft

**Workflow mode:** HEAVY（若查證後可完全重用現有取消 action 與權限檢查，可建議降為 STANDARD 並註明理由）

**Human Gate:** yes

**Risk flags:** 取消報名入口新增，屬權限相關；需 security review，需產品主人確認

**Source:** `docs/member-usability-plan.md`

- [ ] 動工前先確認能否重用現有 `cancelEnrollment` 與本人權限檢查；若需新增 action，走 service layer 並回報
- [ ] pending、confirmed 且課程尚未開始時，詳情頁顯示取消入口；其他狀態不顯示
- [ ] 確認框明寫「取消後無法再次報名此課程」
- [ ] 他人不能取消不屬於自己的報名（有測試）
- [ ] 取消後詳情頁與「我的報名」狀態一致；smoke 測試通過
