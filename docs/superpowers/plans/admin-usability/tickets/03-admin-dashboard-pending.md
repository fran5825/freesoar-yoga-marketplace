# 03: 總覽「待你處理」（決策 3、8）

**What to build:** 總覽最上方列出前 5 筆待審老師申請與待審需求（誰、多久前），整列可點；沒有時顯示「目前沒有待處理事項」。KPI 數字收成次要區塊。

**Blocked by:** 01

**Status:** done（2026-09-26，待 Franz 看畫面）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 只讀取現有資料

**Source:** `docs/admin-usability-plan.md`

- [x] 順序：老師申請在前、需求在後
- [x] 每項一行，點擊進對應列表（詳情頁完成後改連詳情）
- [x] 無待處理時顯示空狀態文案
- [x] 團體不出現在待處理
- [x] 更新 `admin-dashboard` 測試通過

**實作紀錄：** 新增 `listAdminPendingItems()`（`src/domain/admin/dashboard-service.ts`，`requireAdmin()` 把關，核心在 `__internal__/pending-items-core.ts`），只讀取現有資料。「待你處理」分兩組：老師申請待審、需求待審，**各組最多 5 筆**（等最久的排最前面），每組標題顯示總筆數，超過 5 筆時顯示「看全部 N 筆」；兩組都沒有時顯示「目前沒有待處理事項」。時間顯示「N 天前」（新增 `src/lib/format-relative-time.ts`）。原本的「待審事項」兩張數字卡改成這個清單，其餘 5 個數字改名「數字概況」並中文化。詳情頁（票 06、07）完成前，每一列先連到對應的審核列表頁。老師「多久前」用最後更新時間，因為送審後老師不能再編輯，等同送審時間（資料表沒有獨立的送審時間欄位）。
另外（Franz 同時要求）：團主需求的「下一步」文案，在「等待審核」與「已公開」兩個狀態多寫明「老師在需求池看得到 → 老師回應時通知你 → 由你選擇合作的老師」（`src/domain/demand-request/next-step.ts`，只改字，不動流程）。
