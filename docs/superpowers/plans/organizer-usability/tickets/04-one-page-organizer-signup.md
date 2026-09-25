# 04: 一頁式團主註冊（決策 3、11）

**What to build:** 第一次成為團主只填一頁：顯示名稱、組織名稱與類型、聯絡窗口姓名、信箱、電話。信箱預填登入 email、姓名預填登入名稱；顯示名稱與聯絡窗口姓名預設同步（手動改過後不再同步）。送出後直接進新需求表單，不再回資料頁補聯絡資料。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-25）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** 核心使用者流程；動到建立團主資料的 action，需維持既有驗證與「一人一團主」限制；不改 Prisma schema

**實作紀錄：** 已完成。建立團主的 domain 驗證新增三個必填聯絡欄位（不動 Prisma schema）；註冊表單為 client component，顯示名稱與聯絡窗口姓名預設同步。

**Source:** `docs/organizer-usability-plan.md`

- [x] 一頁填完即建立團主與組織，聯絡資料一併寫入
- [x] 預填與同步行為符合說明，手動改過後不再同步
- [x] 送出成功直接導向新需求表單
- [x] 既有驗證（必填、格式、重複建立）維持有效並有測試
- [x] 更新 `organizer-profile-edit`、`organizer-demand` 中建立團主的測試，桌機與手機通過
- [x] 不修改 `prisma/schema.prisma`
