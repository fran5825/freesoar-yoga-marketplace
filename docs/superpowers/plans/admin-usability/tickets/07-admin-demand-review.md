# 07: 需求審核：列表改版、詳情頁、審核後回列表、退回範本（決策 4、9、11–13）

**What to build:** 需求列表與詳情比照老師審核的做法：詳情頁上方放需求內容與「發布／退回」，退回帶入範本，完成後回列表停在待審。

**Blocked by:** 04、05

**Status:** done（2026-09-26，待 Franz 看畫面）

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** 新增管理員讀單筆需求的 service 讀取，涉及 admin guard 與權限，動工前做 security review；不動狀態機與資料庫

**Source:** `docs/admin-usability-plan.md`

- [x] 查現有 admin-service 是否已可單筆讀取，沒有才新增並保留 `requireAdmin`
- [x] security review 通過
- [x] 發布、退回行為與現有狀態規則完全一致
- [x] 已處理過的詳情頁只顯示結果
- [x] 非管理員開詳情頁 404
- [x] 更新 `admin-demands` 測試通過

**實作紀錄：**
- **前置查證：** 原本只有「列出待審需求」，沒有單筆讀取。新增 `listDemandRequestsForAdmin()`（非草稿的需求）與 `getDemandRequestForAdmin()`（單筆；草稿、不存在都回 null），都在 `src/domain/demand-request/admin-service.ts`、`requireAdmin()` 把關。
- **Security review（自我檢查，未動權限、資料庫、狀態機）：** 做法與票 06 相同：layout、頁面、service 三層 `requireAdmin()`，非管理員一律 404；公開、退回兩個動作都先過 `readDemandRequestId()` 的 `requireAdmin()`，狀態規則仍由原本的 `publishSubmittedDemandRequest`／`rejectSubmittedDemandRequest` 執行、未修改；「確認退回」欄位改由隱藏欄位帶入（同票 06 說明）；詳情頁顯示的團體聯絡資料原本就在列表頁給管理員看；列表新增顯示已公開、已退回等非草稿需求，但只是讀取現有資料、且限於管理員可見。
- **畫面：** 需求列表篩選列（待審／已公開／已退回／全部，預設待審，等最久的排前面）＋卡片；詳情頁 `/admin/demands/[demandRequestId]`：下一步（待審：公開一鍵、退回附範本；已退回：顯示原因；其他狀態：已處理）→ 團主與團體 → 需求內容，全中文。審核後回列表並顯示成功提示，失敗留在詳情頁。「已公開」分頁含「已公開」與「老師已回應」兩種狀態。
- **同時完成票 03 的承諾：** 總覽「待你處理」每一列改連到該筆詳情頁。
- **測試：** `admin-demands`、`notification` 的需求審核流程改成列表 → 詳情；新增詳情頁測試（非管理員、草稿、不存在的 id 為 404；已退回、已公開只顯示結果；篩選分頁）。
