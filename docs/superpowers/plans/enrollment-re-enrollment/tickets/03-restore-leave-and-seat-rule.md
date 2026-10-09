# 03: 取消請假與名額占用規則

來源：[spec 4.3、4.4、4.6](../../../../specs/enrollment-re-enrollment-spec.md)。

**What to build:** 整期學員請假後，開課前可以在那一堂的頁面「取消請假」，回到原本的整期報名（狀態跟整期一致，不需重新勾選同意、不通知）。`term_only` 期班請假的名額保留給請假的人，新的整期學員占不到；`term_and_single` 請假名額釋出，被單堂買滿就不能取消請假並顯示「這一堂名額已被報滿，請聯絡老師」。整期退出或被婉拒後不能取消請假。請假確認框依兩種模式使用不同文案。

**Blocked by:** 01

**Status:** 完成（2026-10-10，測試通過）

**Workflow mode:** HEAVY

**Human Gate:** yes（動整期報名 state machine 與名額規則；產品主人已放行）

**Risk flags:** 報名／整期 state machine、鎖順序（RecurringClassSeries → ClassSession → TeacherProfile → 報名）、名額占用定義（跨多處）；不改 schema、不改權限。

- [x] 新增 `restoreLeaveForUser`（`__internal__` 核心＋`service.ts` 外層）：條件與結果依 spec 4.3；錯誤碼依 spec 5
- [x] 共用「占用名額」函式（spec 4.4），並套用於：整期報名名額檢查、單場改課與「從這場以後」改課的人數下限、補課追加（確認不受影響）、`read-service` 與 `term-read-service` 的剩餘名額與可報名判斷、公開列表期班卡的可報名判斷
- [x] 單堂頁：整期請假的已取消報名顯示「取消請假」與確認文字；`term_and_single` 名額已被報滿顯示聯絡老師；整期已終結依原因顯示：`withdrawn`「你已退出這一期，這一堂無法再報名」、`declined`「老師婉拒了你的整期報名，這一堂無法再報名」
- [x] 請假確認框依 `term_only`／`term_and_single` 分兩種文案（spec 4.6）；期班頁（尚未報整期的學員）`has_cancelled_enrollment` 提示改為「先到那一堂重新報名，再回來報整期」（該筆不能重新報名時維持原文案；退出或被婉拒的整期不適用，整期退出確認框文字不變）
- [x] 測試：兩種模式取消請假成功、狀態跟隨整期（confirmed／pending）、term_only 請假名額新整期學員占不到、term_and_single 名額被買滿不能取消請假、整期已退出／被婉拒不能取消請假、課程已開始、併發（取消請假與單堂搶最後名額、取消請假與退出整期同時）、改課人數下限含保留名額

## 進度紀錄（2026-10-10）

- 占用名額定義集中在 `seat-occupancy.ts` 的 `occupyingEnrollmentWhere`（Prisma 條件），套用於：單堂與整期報名的名額檢查、單場與「從這場以後」改課的人數下限、`read-service`／`term-read-service`／`public-read-service`（單堂、期班卡、公開詳情）的剩餘名額與可報名判斷。補課追加只看整期學員人數，確認不受影響（`term-acceptance`、`term-teacher-handling` 通過）。
- `restoreLeaveForUser`（`restore-leave-core.ts`）鎖順序 RecurringClassSeries → ClassSession → TeacherProfile → 報名；`restoreOwnLeave`（`term-service.ts`）為 auth 外層。可否重新報名／取消請假改由 `getReEnrollState`（`re-enroll-eligibility.ts`）算好。期班頁與整期報名核心的 `has_cancelled_enrollment` 帶 `reEnrollable`，是學員自己取消的單堂才提示「先重新報名」。
- 新增 `term-leave-restore.spec.ts`（桌面＋手機 30 項）。相關 spec 合計 266 項通過；`enrollment-cancelled-by` 的請假 UI 測試在批次中失敗一次，重跑 8/8 通過（hydration 時序不穩定）。

<!-- codex-peer-reviewed: 2026-10-09T16:22:17Z rounds=3 verdict=approved -->
