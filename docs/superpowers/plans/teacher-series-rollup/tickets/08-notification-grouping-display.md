# 08: 通知頁合併顯示

來源：[spec 2.5](../../../../specs/teacher-series-rollup-and-action-bar-spec.md)。圖七。

**What to build:** 通知頁（老師、團主、學員共用 `OwnNotificationsContent`）把同一位收件人、同類型、同系列、同一天（台北時間）的通知合成一則，標示則數與最新時間；合併後連到系列頁，連結依 spec 2.5 由 server 推導：收件人是授課老師→老師系列管理頁；學員→期班頁，持續開課則系列頁可見才連、否則退回「我的報名」。email 的連結用同一個推導函式。沒有系列 ID 的通知維持原樣。

**Blocked by:** 07

**Status:** 待開始 ・ **Workflow mode:** STANDARD ・ **Human Gate:** no

**Risk flags:** 合併邏輯放 read service，不放元件；連結沿用既有白名單推導，不存網址。

- [ ] read service 合併（同類型＋同系列＋同一天），保留排序
- [ ] 合併一則的顯示：標題、則數、最新時間、系列頁連結（依身分）
- [ ] 單元測試：跨日不合併、不同類型不合併、無系列 ID 不合併、時區邊界；連結推導（授課老師、學員期班、學員持續開課公開與非公開、已無未來場次、兼具老師與學員身分的人收到學員通知）
- [ ] smoke：老師與學員通知頁、手機 375px

<!-- codex-peer-reviewed: 2026-10-11T00:37:44Z rounds=3 verdict=approved -->
