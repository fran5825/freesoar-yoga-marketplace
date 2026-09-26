# 管理員後台流程整理票券總表

來源：`docs/admin-usability-plan.md`（2026-09-26 切票）。**跑 Playwright 請用 `PORT=3100`。** 每批做完由 Franz 看過畫面再做下一批。

HEAVY 票（06、07）動工前需 security review 與 Franz 放行；02 也需放行。

| # | 標題 | Blocked by | Mode | Human Gate |
| --- | --- | --- | --- | --- |
| [01](01-admin-layout-nav.md) | 共用 layout、導覽列、頁寬、中文標題（已完成 2026-09-26） | None | STANDARD | no |
| [02](02-role-switch-account-card.md) | 角色切換與管理後台卡片（已完成 2026-09-26） | 01 | STANDARD | yes |
| [03](03-admin-dashboard-pending.md) | 總覽「待你處理」（已完成 2026-09-26） | 01 | STANDARD | no |
| [04](04-shared-list-components.md) | 共用列表元件（已完成 2026-09-26） | 01 | STANDARD | no |
| [05](05-confirm-dialog-reason-templates.md) | 確認視窗與退回範本（已完成 2026-09-26，範本文字待確認） | 04 | STANDARD | no |
| [06](06-admin-teacher-review.md) | 老師審核改版（已完成 2026-09-26） | 04、05 | HEAVY | yes |
| [07](07-admin-demand-review.md) | 需求審核改版（已完成 2026-09-26） | 04、05 | HEAVY | yes |
| [08](08-admin-class-management.md) | 課程管理改版（已完成 2026-09-26） | 04、05 | STANDARD | no |
| [09](09-admin-organizations-layout.md) | 團體頁版面統一（已完成 2026-09-26） | 01 | LIGHT | no |
| [10](10-admin-wrap-up.md) | 收尾（已完成 2026-09-26） | 02、03、06、07、08、09 | LIGHT | no |

**2026-09-26：01–10 全部完成，待 Franz 看畫面；退回原因範本文字待確認。**

建議順序：01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10。
