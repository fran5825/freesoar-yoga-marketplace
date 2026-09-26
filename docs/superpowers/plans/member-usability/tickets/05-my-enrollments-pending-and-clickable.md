# 05: 我的報名：待你處理與卡片可點（決策 12、14）

**What to build:** 「我的報名」頂部有「待你處理」區塊（待老師確認的報名、已完成課程待評價），卡片整張可點進課程詳情。空狀態改成「去找一堂課」按鈕連到 `/classes`，不再寫過期文案。

**Blocked by:** 01

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（動工前先查證「待評價」能否用現有資料判斷，查不到就先不放並回報）

**Source:** `docs/member-usability-plan.md`

- [ ] 「待你處理」列出待老師確認與待評價項目，沒有時顯示「目前沒有待處理事項」
- [ ] 報名卡片整張可點進 `/classes/[id]`
- [ ] 空狀態有「去找一堂課」按鈕，文案不再提「團主分享的連結」
- [ ] 手機沒有橫向捲動；smoke 測試通過
