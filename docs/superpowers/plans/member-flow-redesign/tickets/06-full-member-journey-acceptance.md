# 06: 完整學員旅程 usability 驗收

**What to build:** 用三批都完成後的版本，把學員整段旅程走一遍：找課 → 詳情 → 註冊／登入 → 本人報名 → 已報名或等待老師確認 → 查看上課資訊或取消。確認步驟精簡、排版一致、資訊好找，留下畫面證據。

**Blocked by:** 02、04、05

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（以驗證為主；發現的問題若需動 Auth／schema，另開票）

**Source:** `docs/member-flow-redesign-plan.md` Q14、「收斂後的共同理解」。

**範圍說明（2026-10-04）：** 期班的整期報名、請假、退出整期與期班卡片，屬於老師排課計畫（`docs/specs/teacher-class-scheduling-spec.md`），由該計畫的票 13 驗收，不在本票。本票只驗收單堂報名的學員旅程；若驗收時期班功能已上線，確認單堂旅程不受影響即可。

## Acceptance criteria

- [ ] 團主團課與老師開課各走一次完整旅程
- [ ] 桌機、手機 375／390 寬
- [ ] 長標題、約 2000 字說明、長地址；200% 文字放大；只用鍵盤操作
- [ ] 空狀態、篩選返回保留、錯誤（無效日期）、額滿、已開始、登入取消／失敗、回來後不可報名
- [ ] 直接確認與需老師確認兩種報名；pending → confirmed 的顯示
- [ ] 步驟數：已登入學員為列表 → 詳情同頁送出；訪客為詳情 → Google → 同一詳情確認送出
- [ ] 小問題在本票修；超出範圍的記 `docs/backlog.md`
- [ ] 報告區分自動化 smoke、手動畫面檢查，以及未驗收項目（如真實裝置鍵盤）
- [ ] 票 05 的真實 Google OAuth 手動驗收未完成時，本票不得宣稱完整旅程已通過


<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->
