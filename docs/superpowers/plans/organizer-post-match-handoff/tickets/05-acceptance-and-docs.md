# 05: 驗收與文件同步

來源：[spec](../../../../specs/organizer-post-match-handoff-spec.md)「Testing Decisions」「文件」；[plan](../plan.md) 第 3 批。

**What to build:** 用手機與桌機走完整段交接（選定老師 → 雙方看到聯絡方式 → 建課 → 總覽提醒 → 開放報名 → 提醒消失），確認 01–04 合起來是通的；文件與走查報告跟實作一致。

**Blocked by:** 01、02、03、04

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no（只驗收與改文件；驗收時若發現要改權限、通知或狀態的修正，停下另開票）

**Risk flags:** 無

- [ ] 390px、1280px 各走一次完整段交接，留截圖（`.ai-runs/`，不進版控）
- [ ] 01–04 相關 smoke 全組與 `npm run build` 通過；記錄實際命令與結果，失敗先換空埠重跑再判讀
- [ ] `docs/domain/permissions.md`、`permissions-matrix.md` 與票 04 實作一致；`docs/domain/state-machines.md` 確認不需要改（D3＝A）
- [ ] [走查報告](../../organizer-first-run-walkthrough/review.md) F1、F2 標註「已由 organizer-post-match-handoff 處理，待真人驗證」
- [ ] spec 與 plan 的實作狀態更新；沒做到或延後的項目記進 `docs/backlog.md`
- [ ] 交付 review packet（self review、scope drift、剩餘風險）；不 commit、不 push，除非產品主人另外要求

## 進度紀錄

<!-- codex-peer-reviewed: 2026-10-26T11:47:59Z rounds=2 verdict=approved -->
