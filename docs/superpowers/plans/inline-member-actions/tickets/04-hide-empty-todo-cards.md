# 04: 「待你處理」沒事項時隱藏、有事項放第一張

來源：[spec 3.5、I10](../../../../specs/member-inline-actions-and-card-cleanup-spec.md)。

**What to build:** 學員、老師、團主、管理員四個總覽與「我的報名」頁，沒有待處理事項時整張「待你處理」卡不出現；有事項時它是頁面標題與提示橫幅之後的第一張卡（學員總覽要移到快速入口卡之前）。「等待對方回覆」「等老師確認」維持現狀。管理員沒有待審項目時，最上面直接是數字統計。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** LIGHT

**Human Gate:** no

**Risk flags:** 無（只動顯示條件與排列）。

- [ ] 四個總覽與「我的報名」頁：「輪到自己處理」的事項為空時整張卡不渲染（無空標題、無「目前沒有待處理事項」）；`waiting` 事項不讓「待你處理」出現
- [ ] 老師總覽把 `action` 與 `waiting` 拆成「待你處理」與緊接在後的「等待對方回覆」兩張卡，各自沒事項時不出現
- [ ] 有事項時位置為第一張卡；學員總覽移到快速入口之前；其餘卡片順序不變
- [ ] 測試：各角色有事項與沒事項兩種情況；更新既有依賴「目前沒有待處理事項」文字的測試

<!-- codex-peer-reviewed: 2026-10-09T23:48:40Z rounds=6 verdict=approved -->
