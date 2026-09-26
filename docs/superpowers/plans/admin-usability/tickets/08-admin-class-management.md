# 08: 課程管理：篩選列、卡片、詳情頁寬、取消確認（決策 2、10、11）

**What to build:** 課程列表改用共用篩選列與卡片；課程詳情頁寬由 `max-w-2xl` 改 `max-w-4xl`；取消報名、取消整堂課套用確認視窗。

**Blocked by:** 04、05

**Status:** done（2026-09-26，待 Franz 看畫面）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 取消操作本身的規則不變，只加確認視窗

**Source:** `docs/admin-usability-plan.md`

- [x] 篩選列與其他兩個列表一致
- [x] 取消報名、取消整堂課需確認才送出
- [x] 更新 `admin-class-session-management` 測試通過

**實作紀錄：** 篩選列與卡片在票 04、取消確認視窗在票 05、頁寬統一在票 01 完成；本票補上詳情頁「← 回課程列表」連結，並改用共用的提示橫幅元件。取消報名、取消整堂課後仍留在詳情頁顯示結果（因為要立刻看到狀態變成「已取消」），這是刻意與審核類操作「回列表」不同。同時（Franz 回報）詳情頁的團主、授課老師、團體改顯示名稱加聯絡方式。測試：`admin-class-session-management` 18 支通過。
