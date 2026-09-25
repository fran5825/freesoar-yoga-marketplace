# 09: 總覽「待你處理」區塊（決策 8）

**What to build:** 團主總覽最上方新增「待你處理」：有老師回應待選擇、需求被退回要修改、草稿未送出各列一項並連到對應頁；沒有待辦時顯示「目前沒有待處理事項」。下方才是需求列表與通知。

**Blocked by:** 08（共用下一步文案）

**Status:** done（2026-09-25）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無

**實作紀錄：** 已完成。草稿因下方「我的需求」已逐筆列出，在「待你處理」只顯示一行摘要（連到草稿篩選），其他需要動作的狀態逐筆列出。

**Source:** `docs/organizer-usability-plan.md`

- [x] 三種待辦都會出現並連到正確頁面
- [x] 無待辦時顯示空狀態文案
- [x] 文案與詳情頁一致（共用同一來源）
- [x] 更新 `organizer-dashboard` smoke 測試，桌機與手機通過
