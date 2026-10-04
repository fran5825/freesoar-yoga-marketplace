# 02: 多團體 ownership 相容擴充

**What to build:** 在多團體新流程尚未上線時，原有團主仍可註冊、提出需求與管理舊課程；資料安全地加入 owner 關聯。

**Blocked by:** 01：正式 contract 文件

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK

- [ ] 此票為 expand–contract 的機械相容擴充例外；新增 nullable owner FK／index 與明確 relation，保留 legacy organizationId，不先公開未完成的多團體 CTA。
- [ ] 只在測試資料庫驗證回填；舊 group ID、demand／class FK、歷史課程與既有單團體功能均保留。
- [ ] 對照 legacy profile、需求及課程歸屬；重複或矛盾 owner 停止並回報可核對的 ID／筆數，不輸出私人聯絡資料、不默認挑第一人。
- [ ] 無法判定 owner 的孤立團體保留 admin-only，不自動授權給任何團主；刪除行為不得讓另一團主接管。
- [ ] 相容期的新增資料與 fixtures 有一致的 owner／legacy pointer；既有單團體讀寫仍能運作，後續多團體授權使用 owner。
- [ ] 驗證新舊 relation 並存、migration 前後完整性、ambiguous owner 失敗及舊註冊／需求／課程回歸；更新正式文件的實作狀態。
- [ ] 提供測試 DB 的 expand／rollback evidence；不重設資料庫、不 db push、不操作 production、不混入其他欄位清理。

