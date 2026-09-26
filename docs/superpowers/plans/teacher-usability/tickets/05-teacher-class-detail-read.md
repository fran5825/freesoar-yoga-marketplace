# 05: 單堂課詳情讀取（own-scoped）（決策 2）

**What to build:** 新增 service 層函式，讓老師只能讀取「自己的」單堂課詳情，含報名名單與狀態。讀不到別人的課、別人的報名資料。此票先不做頁面，只交付可驗證的讀取與權限行為。

**Blocked by:** 01

**Status:** done（2026-09-25）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認：誰能讀到哪些資料）

**Risk flags:** 權限（own-scoped 讀取、含學員個資如姓名／email／備註）；需 security review；不動 Prisma schema；沿用 `read-service.ts` 既有老師讀取的權限模式

**實作紀錄：** 新增 `getOwnClassSessionDetailForTeacher`（`read-service.ts`，外層 `requireUser()`）與不依賴登入狀態的核心 `getClassSessionDetailForTeacherUser`（`__internal__/class-session-detail-core-for-teacher.ts`）。列表與詳情共用同一份 select（列表輸出不變），沒有新增任何可讀欄位。產品主人 2026-09-25 已放行範圍。自我 security review：own-scope 在 WHERE（`teacherProfileId`）；別人的課與不存在無法區分；無老師資料回傳 null；學員電話、頭像與團主聯絡資料不在 select；只讀，無寫入，不動 schema 與狀態機。新增 5 個測試（本人、他人與不存在、無老師資料、suspended、團主媒合課只露出組織名稱）。

**Source:** `docs/teacher-usability-plan.md`

- [x] 放行前先給產品主人「可讀欄位與範圍」摘要並取得確認
- [x] 老師本人可讀取自己的課；讀取他人課程回傳找不到（不洩漏是否存在）
- [x] 未登入、非老師、已暫停老師的行為明確且有測試
- [x] 報名名單只包含應顯示的欄位，並完成 security review
- [x] 若權限規則有變動，同步更新 `docs/domain/permissions.md`
