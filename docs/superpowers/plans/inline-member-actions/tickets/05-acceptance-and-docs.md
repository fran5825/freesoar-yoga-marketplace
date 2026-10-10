# 05: 驗收與文件同步

來源：[spec](../../../../specs/member-inline-actions-and-card-cleanup-spec.md)。

**What to build:** 確認學員旅程完整可用並同步文件：整期學員從「我的報名」「期班頁」「單堂頁」三處都能就地請假與取消請假，退出整期在「我的報名」與「期班頁」兩處就地完成（單堂頁沒有退出整期）；單堂學員的取消與重新報名在第一張卡完成；各總覽沒事項時乾淨。桌面與手機都跑一次。

**Blocked by:** 02、03、04

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無。

- [ ] Playwright 旅程驗收（桌面與手機）：三處就地請假與取消請假各一條、兩處就地退出整期各一條，並驗證請假與取消請假成功後保持展開並捲到該列、失敗時捲到可見的失敗原因、退出整期後回到同一頁並顯示結果訊息；單堂取消與重新報名；各總覽「待你處理」有／無
- [ ] 更新 `docs/product/route-map.md` 與 `docs/context/glossary.md`（「請假」「重新報名」的畫面位置描述）；`enrollment-re-enrollment` spec 4.6 補一句「操作入口改為就地，見本 spec」
- [ ] 受影響 spec 全過；TypeScript、ESLint、build 通過；全套 smoke 跑一次並記錄不穩定項目

<!-- codex-peer-reviewed: 2026-10-09T23:48:40Z rounds=6 verdict=approved -->
