# 團主流程整理票券總表

來源：`docs/organizer-usability-plan.md`（第 1 批導覽列與統一頁寬已完成，2026-09-25）。
本批票券沒有 HEAVY；02、04 涉及核心使用者流程，Human Gate: yes。

| # | 標題 | Blocked by | Mode | Human Gate |
| --- | --- | --- | --- | --- |
| [01](01-fix-organizer-demand-tests.md) | 釐清並修復團主需求 smoke 測試失敗（已完成） | None (can start immediately) | LIGHT | no |
| [02](02-organizer-entry-paths.md) | 團主入口路徑（決策 1 修訂、13） | None (can start immediately) | STANDARD | yes |
| [03](03-account-hub.md) | 我的使用入口中心 /account（決策 15） | None (can start immediately) | STANDARD | no |
| [04](04-one-page-organizer-signup.md) | 一頁式團主註冊（決策 3、11） | None (can start immediately) | STANDARD | yes |
| [05](05-organizer-profile-single-save.md) | 資料頁單一儲存與完整度（決策 12） | 04 | STANDARD | no |
| [06](06-demand-form-contact-banner.md) | 新需求表單頂端聯絡提醒（決策 16） | 05 | STANDARD | no |
| [07](07-demand-form-sections.md) | 需求表單區塊化與缺項提示（決策 4） | 01、06 | STANDARD | no |
| [08](08-demand-detail-next-step.md) | 需求詳情頁重排與下一步提示（決策 6） | None (can start immediately) | STANDARD | no |
| [09](09-dashboard-pending-actions.md) | 總覽「待你處理」區塊（決策 8） | 08 | STANDARD | no |
| [10](10-demand-list-filter-cards.md) | 需求列表篩選與可點卡片（決策 9） | 08 | STANDARD | no |
| [11](11-notification-links.md) | 通知與 email 連結（決策 10，方案 B） | None (can start immediately) | STANDARD | no |

**2026-09-25：01–11 全部完成**（11 的 email 部分不適用，見票內紀錄）。**跑 Playwright 請用 `PORT=3100 npx playwright test ...`，不要連開發伺服器。**
