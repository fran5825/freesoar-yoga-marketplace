# 01: 共用元件：操作列、期班標籤、報名名單一排

來源：[spec 2.2、2.3、2.4](../../../../specs/teacher-series-rollup-and-action-bar-spec.md)。

**What to build:** 三個共用元件，供老師、團主、管理員各頁使用。(1) 操作列：輸入「依狀態的第一顆」「最常用的第二顆」與其餘動作清單，桌面攤開成一排、手機放不下時其餘收進「更多」選單；支援「ⓘ」短說明。(2) 期班標籤：「期班・第 3 堂／共 8 堂」或「持續開課・每週四」，可點到指定的系列頁。(3) 報名名單一排：姓名、付款標籤、轉帳備註、右側按鈕，必要時「單堂」標籤，收款備註與退款說明在下一行。

**Blocked by:** `inline-member-enroll` 完成

**Status:** 待開始 ・ **Workflow mode:** STANDARD ・ **Human Gate:** no

**Risk flags:** 「更多」選單需鍵盤可操作、焦點可見；不可逆按鈕仍走確認視窗。

- [ ] 依狀態決定兩顆按鈕的共用函式（spec 2.2 表格），放 domain／lib 層，不放頁面
- [ ] 「第幾堂／共幾堂」計算：未取消場次依上課時間排序（spec 2.3）；`inline-member-enroll` 票 08 若已先做成共用函式，直接沿用
- [ ] 「單堂」標籤只在 `term_and_single` 且該筆為單堂報名時顯示（spec 2.4）
- [ ] 單元測試：按鈕表每一列、第幾堂計算（含已取消場次）、單堂標籤條件
- [ ] 元件測試或 smoke：攤開與收進「更多」、鍵盤操作、375px 無溢出

<!-- codex-peer-reviewed: 2026-10-11T00:37:44Z rounds=3 verdict=approved -->
