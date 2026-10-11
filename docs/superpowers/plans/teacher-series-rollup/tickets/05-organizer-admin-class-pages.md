# 05: 團主與管理員單堂頁套用操作列與期班標籤

來源：[spec 2.2、2.3、2.4](../../../../specs/teacher-series-rollup-and-action-bar-spec.md)。

**What to build:** 依 spec 2.2「角色別按鈕」：團主單堂頁草稿＝開放報名、開放中＝複製報名連結（`ClassShareLink`）＋取消課程、已結束＝標記完成；把分散的「開放報名」「標記完成」「取消課程」區塊收進操作列。管理員單堂頁只在可取消時露出「取消課程」一顆，不新增管理員沒有的 action，加期班標籤；報名名單依 spec 2.4 改一排（實作前與產品主人確認一次）。

**Blocked by:** 01

**Status:** 待開始 ・ **Workflow mode:** STANDARD ・ **Human Gate:** no

**Risk flags:** 團主頁的「開放報名後先分享」順序（organizer-usability-redesign 票 14）要保留在第一屏。

- [ ] 團主單堂頁操作列，舊測試更新
- [ ] 管理員單堂頁操作列、期班標籤、名單一排
- [ ] 測試：團主各狀態（確認沒有出現團主沒有的修改課程）、管理員各狀態（只有取消課程）、手機 375px

<!-- codex-peer-reviewed: 2026-10-11T00:37:44Z rounds=3 verdict=approved -->
