# 02: 單堂重新報名

來源：[spec 4.2、4.6、4.7](../../../../specs/enrollment-re-enrollment-spec.md)。

**What to build:** 學員開課前自己取消單堂報名後，在課程頁可以重新報名（需老師確認的課重新送出申請）；次數不限、要還有名額、要重新勾選同意。老師婉拒、管理員取消、舊的已取消紀錄、整堂課被取消的，顯示對應原因，不能重新報名。取消確認框改成說明可以重新報名。

**Blocked by:** 01

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（動報名建立路徑與 state machine；產品主人已放行）

**Risk flags:** 報名 state machine（`cancelled → confirmed／pending`）、併發鎖、`consentedAt` 覆寫；不改權限、不改 schema。

- [ ] `createEnrollmentForUser`：已有 `cancelled` 且 `cancelledBy = member` 且非整期的報名時，更新同一筆為新狀態（`requiresApproval` 決定 pending／confirmed），覆寫 notes 與 consentedAt、清 `cancelledBy`；更新條件寫進 WHERE
- [ ] 名額已滿回 `class_session_full`；`term_only` 期班的單堂仍不收；老師非 approved 仍拒絕
- [ ] 不能重新報名的取消（teacher／admin／system／NULL／整期請假）維持 `already_enrolled`，訊息依原因
- [ ] 通知沿用既有：直接成立 `enrollment_confirmed`；需確認 `enrollment_pending_review`（學員與老師）
- [ ] `getClassSessionForMember` 在 service layer 算好「可否重新報名」與不能的原因（含名額已滿、老師非 approved、課程已開始），單堂頁只依結果顯示：可重新報名表單、各種不能重新報名的原因文案（整期 withdrawn 與 declined 文案分開）；不能時不顯示表單
- [ ] 單堂取消確認框文案改為「取消後，開課前可以重新報名；名額被報滿則不能。」
- [ ] 測試：重新報名成功（直接成立、需確認）、次數不限（取消→重報→再取消→再重報）、額滿與老師非 approved 時顯示原因且沒有表單、額滿失敗、各種不能重報的原因、課程已開始、併發（同時重報兩次、重報與別人搶最後名額）、通知

<!-- codex-peer-reviewed: 2026-10-09T16:22:17Z rounds=3 verdict=approved -->
