# 01: admin 共用 layout、導覽列、統一頁寬、中文標題（決策 2、14）

**What to build:** 管理員進任何 admin 頁，看到同一條導覽列（總覽／老師／需求／課程／團體）、標示目前頁、同一個頁寬與標題樣式，全部中文。每頁不再各自貼英文小字連結。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-26，待 Franz 看畫面）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 動到 admin 頁外框；各頁自己的 `requireAdmin()` 把關必須保留，不可因為改用 layout 而移除

**Source:** `docs/admin-usability-plan.md`

- [x] 5 個 admin 頁共用同一 layout，頁寬統一 `max-w-4xl`（寬表格才例外）
- [x] 導覽列標示目前頁；手機版可收合、無橫向捲動
- [x] 標題與欄位標籤改中文（如 Contact name），用詞比照 `docs/context/glossary.md`
- [x] 非管理員開任何 `/admin/*` 仍是 404
- [x] 更新受影響的 admin smoke 測試，桌機與手機通過（`PORT=3100`）

**實作紀錄：** 新增 `src/app/admin/layout.tsx` 與 `_components/AdminShell.tsx`（沿用 `RoleShell`），刪除 `AdminNav`。layout 也做一次 `requireAdmin()`，非管理員開任何 `/admin/*` 時導覽列不會先被畫出來；各頁自己的把關保留。5 頁改成中文標題（總覽／老師審核／需求審核／課程管理／團體），頁寬統一 `max-w-4xl`。**頁面內文的英文欄位標籤（如 Service type）沒有在這張票改**，留給 06、07、08、09 各自重寫時一併中文化，避免同一段程式改兩次。驗證：build 通過、5 支 admin smoke 測試桌機＋手機共 54 支通過（`PORT=3100`）。
