# 03: 詳情頁直接取消報名（決策 13）

**What to build:** 學員在課程詳情頁就能取消自己的報名，不必繞去「我的報名」。確認框明寫「取消後無法再次報名此課程」。取消規則與權限不變。

**Blocked by:** 02

**Status:** done（2026-09-27）

**Workflow mode:** STANDARD（2026-09-27 產品主人同意由 HEAVY 降級：查證後完全重用 `cancelOwnEnrollment` 的登入、本人、狀態與時間檢查，不新增任何權限邏輯）

**Human Gate:** yes（已放行，2026-09-27）

**Risk flags:** 取消報名入口新增，屬權限相關；需 security review，需產品主人確認

**Source:** `docs/member-usability-plan.md`

- [x] 動工前先確認能否重用現有 `cancelEnrollment` 與本人權限檢查；若需新增 action，走 service layer 並回報
- [x] pending、confirmed 且課程尚未開始時，詳情頁顯示取消入口；其他狀態不顯示
- [x] 確認框明寫「取消後無法再次報名此課程」
- [x] 他人不能取消不屬於自己的報名（有測試）
- [x] 取消後詳情頁與「我的報名」狀態一致；smoke 測試通過

**實作紀錄：** 課程詳情頁新增 `cancelEnrollmentFromClassAction`，只呼叫既有 `cancelOwnEnrollment`（service layer 以 `userId` 綁定本人、只取消處理中／已報名、課程未開始），取消後回到同一堂課詳情頁並顯示「報名已取消。」。取消表單抽成共用元件 `CancelEnrollmentForm`（詳情頁與「我的報名」共用），確認區明寫「取消後無法再次報名此課程。」。產品主人決定（2A）：課程開始後兩頁都不顯示取消入口；伺服器端規則不變。D14 測試改為「先打開取消表單、送出前把課程改成已開始」，照樣驗證伺服器擋下，並驗證兩頁重新載入後不再顯示取消。新增測試：竄改表單改成別人的報名 id 也取消不了；正常取消後詳情頁顯示已取消、名額釋出、我的報名狀態一致。驗證：build、tsc、eslint 通過；`enrollment`、`member-dashboard`、`notification`、`class-session-cancellation` 桌機＋手機共 74 支全過。
