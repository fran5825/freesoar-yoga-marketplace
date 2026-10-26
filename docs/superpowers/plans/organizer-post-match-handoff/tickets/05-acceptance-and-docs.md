# 05: 驗收與文件同步

來源：[spec](../../../../specs/organizer-post-match-handoff-spec.md)「Testing Decisions」「文件」；[plan](../plan.md) 第 3 批。

**What to build:** 用手機與桌機走完整段交接（選定老師 → 雙方看到聯絡方式 → 建課 → 總覽提醒 → 開放報名 → 提醒消失），確認 01–04 合起來是通的；文件與走查報告跟實作一致。

**Blocked by:** 01、02、03、04

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no（只驗收與改文件；驗收時若發現要改權限、通知或狀態的修正，停下另開票）

**Risk flags:** 無

- [x] 390px、1280px 各走一次完整段交接，留截圖（`.ai-runs/`，不進版控）
- [x] 01–04 相關 smoke 全組與 `npm run build` 通過；記錄實際命令與結果，失敗先換空埠重跑再判讀
- [x] `docs/domain/permissions.md`、`permissions-matrix.md` 與票 04 實作一致；`docs/domain/state-machines.md` 確認不需要改（D3＝A）
- [x] [走查報告](../../organizer-first-run-walkthrough/review.md) F1、F2 標註「已由 organizer-post-match-handoff 處理，待真人驗證」
- [x] spec 與 plan 的實作狀態更新；沒做到或延後的項目記進 `docs/backlog.md`
- [x] 交付 review packet（self review、scope drift、剩餘風險）；不 commit、不 push，除非產品主人另外要求

## 進度紀錄

- 2026-10-26 完成：新增整段旅程 smoke（選定 → 雙方看到聯絡方式 → 建課 → 總覽提醒 → 開放報名 → 提醒消失），桌機 1280 與手機 390 各跑一次，每步檢查沒有水平捲動，截圖在 `.ai-runs/organizer-post-match-handoff/`。相關 smoke 全組（`organizer-*`、`organizers-request`、`demand-*`、`teacher-demand*`、`teacher-dashboard*`、`notification*`、`class-session-creation`、`admin-demands`）：407 passed、7 skipped（backlog 第 27 項的既有 `test.fixme`）、0 failed，16.6 分鐘（`PORT=3300`，測試庫 `freesoar_opmh_test`）。審查：內建 code-review 7 項，修 4 項（課程列表共用同一個「現在」、還沒選定時不多查、總覽改成只查可開放草稿、老師回應頁未登入帶 `callbackUrl`），不修 3 項（trim-to-null 小工具合併會動到付款快照、團體聯絡狀態多一次小查詢、雙方缺聯絡的判斷目前只有一處用到）；spec-review 兩軸沒有硬性違規、沒有 spec 外的權限／狀態機／schema 變更，依建議修正「團體三項都缺時叫已填的老師再去填」的重複提醒，並補「需求取消通知仍連列表」的測試。修正後 build 並重跑相關 7 檔：80 passed、2 skipped。`docs/domain/state-machines.md` 確認不需要改（D3＝A；該檔目前有其他工作階段的未提交修改，本任務未碰）。剩餘：真人驗證；暫停老師是否仍看得到團體聯絡窗口待產品主人決定（backlog 第 32 項）。

<!-- codex-peer-reviewed: 2026-10-26T11:47:59Z rounds=2 verdict=approved -->
