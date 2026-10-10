# 05: 驗收與文件同步

來源：[spec](../../../../specs/member-inline-actions-and-card-cleanup-spec.md)。

**What to build:** 確認學員旅程完整可用並同步文件：整期學員從「我的報名」「期班頁」「單堂頁」三處都能就地請假與取消請假，退出整期在「我的報名」與「期班頁」兩處就地完成（單堂頁沒有退出整期）；單堂學員的取消與重新報名在第一張卡完成；各總覽沒事項時乾淨。桌面與手機都跑一次。

**Blocked by:** 02、03、04

**Status:** 完成（2026-10-10，測試通過）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無。

- [x] Playwright 旅程驗收（桌面與手機）：三處就地請假與取消請假各一條、兩處就地退出整期各一條，並驗證請假與取消請假成功後保持展開並捲到該列、失敗時捲到可見的失敗原因、退出整期後回到同一頁並顯示結果訊息；單堂取消與重新報名；各總覽「待你處理」有／無
- [x] 更新 `docs/product/route-map.md` 與 `docs/context/glossary.md`（「請假」「重新報名」的畫面位置描述）；`enrollment-re-enrollment` spec 4.6 補一句「操作入口改為就地，見本 spec」
- [x] 受影響 spec 全過；TypeScript、ESLint、build 通過；全套 smoke 跑一次並記錄不穩定項目

## 進度紀錄（2026-10-10）

- 新增 `inline-actions-acceptance.spec.ts`（桌面＋手機 4 項）：三處就地請假與取消請假、兩處就地退出整期、每個展開畫面 375px 不橫向溢出。
- 文件同步：`route-map.md`（我的報名、單堂頁、期班頁）、`glossary.md`（請假改為就地、名額保留說明）、`enrollment-re-enrollment` spec 4.6 補指向本 spec。
- Codex 對實作做獨立 code review，找到 2 個真問題並已修：過去的請假列在「過去與已取消」顯示成「已取消」（改為「請假中」）；`attended`／`no_show` 的報名在單堂頁被說成「已取消」（新增「已出席」「未出席」標籤與說明）；各補測試。
- 全套 smoke（`PORT=3600`）：1299 項通過、14 項跳過、11 項失敗。其中 3 項是這次改動的預期後果（`enrollment` 我的報名、`organizer-usability` 空狀態、`organizer-keyboard`），已更新預期並重跑通過；其餘 8 項（手機版 hydration 時序與 Google 連線不穩定的既有項目）單獨重跑全部通過。TypeScript、ESLint、build 通過。

<!-- codex-peer-reviewed: 2026-10-09T23:48:40Z rounds=6 verdict=approved -->
