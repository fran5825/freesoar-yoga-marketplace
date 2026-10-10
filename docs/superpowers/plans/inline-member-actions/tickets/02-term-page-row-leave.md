# 02: 期班頁每一堂列的請假按鈕

來源：[spec I3、I5](../../../../specs/member-inline-actions-and-card-cleanup-spec.md)。

**What to build:** 整期學員在期班頁展開「查看每一堂」，每一列已報名標籤旁有「請假」按鈕、已請假的列有「請假中」與「取消請假」，就地操作、做完回到期班頁。期班頁版面其他部分不動（退出整期維持現在位置）；原本「點進那一堂按請假這一堂」的說明改成「到查看每一堂，按那一堂的請假」。

**Blocked by:** 01

**Status:** 完成（2026-10-10，測試通過）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無。

- [x] 期班頁讀取函式帶出每一堂的自己報名資料；有效報名的請假資格沿用 `cancelOwnEnrollment`，已請假的列用 `getReEnrollState` 判斷能否取消請假
- [x] 每一列用票 01 的共用元件；非整期學員與訪客的列表維持現狀（沒有按鈕）
- [x] 操作後回到期班頁並顯示結果訊息，網址帶 `open=sessions` 與 `focus` 參數，「查看每一堂」保持展開，成功捲到那一列、失敗捲到可見的結果訊息；說明文字更新
- [x] 測試：兩種模式請假與取消請假、退出整期後沒有按鈕、手機 375px 無橫向溢出

## 進度紀錄（2026-10-10）

- `getTermDetailForViewer` 每一堂帶 `ownEnrollmentId` 與 `rowControl`（`getTermRowControl`）；期班頁每一列用共用元件，退出整期改用就地共用元件（`withdrawTermAction` 不再被期班頁使用）。「查看每一堂」依 `open=sessions` 保持展開，結果訊息區 `id=action-feedback`，`ScrollToTarget` 依 `focus` 捲動。
- 新增 `inline-term-actions-term-page.spec.ts`（桌面＋手機 8 項）；相關期班 spec 共 65 項通過。

<!-- codex-peer-reviewed: 2026-10-09T23:48:40Z rounds=6 verdict=approved -->
