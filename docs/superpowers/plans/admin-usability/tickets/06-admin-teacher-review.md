# 06: 老師審核：列表改版、詳情頁、審核後回列表、暫停確認（決策 4、9–13）

**What to build:** 老師列表改成篩選列＋可點卡片；點進詳情頁，上方是申請內容與下一步按鈕（通過／退回／暫停／恢復）。按完回列表並停在待審，顯示成功提示；已處理過的詳情頁只顯示結果。暫停套用確認視窗，退回套用範本。

**Blocked by:** 04、05

**Status:** done（2026-09-26，待 Franz 看畫面）

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** 新增管理員讀單筆老師的 service 讀取，涉及 admin guard 與權限，動工前做 security review；不動狀態機與資料庫

**Source:** `docs/admin-usability-plan.md`

- [x] 動工前先查是否已有單筆讀取函式；新增者走 service layer 並保留 `requireAdmin`
- [x] security review 通過
- [x] 待審／已通過／已暫停／全部篩選正確
- [x] 通過、退回、暫停、恢復行為與現有狀態規則完全一致
- [x] 非管理員開詳情頁 404
- [x] 更新 `admin-teachers` 測試通過

**實作紀錄：**
- **前置查證：** 原本沒有單筆讀取函式，新增 `getTeacherProfileForAdmin()`（`src/domain/teacher-profile/service.ts`）：先 `requireAdmin()`；**草稿一律回 null**（草稿是老師私人資料，管理員原本就看不到，詳情頁一致）；一併算出平均評分。
- **Security review（自我檢查，未動權限、資料庫、狀態機）：** ① `/admin/*` 三層把關：layout、頁面、service 各自 `requireAdmin()`，非管理員一律 404；② 四個審核動作（通過、退回、暫停、恢復）都先過 `readTeacherProfileId()` 的 `requireAdmin()`，狀態轉換規則仍由原本的 service 函式執行，未修改；③ 「確認」欄位（`confirmReject`／`confirmSuspend`／`confirmRestore`）改由表單隱藏欄位帶入，代表畫面上已有明確操作（退回要填原因、暫停要過確認視窗）；伺服器端仍檢查這些欄位，但它們擋不了刻意偽造的請求（原本的勾選框也一樣擋不了），真正的把關是 `requireAdmin()`；④ 詳情頁多顯示的個資（Email、電話）原本就在列表頁顯示給管理員，沒有增加可見範圍；⑤ 提示訊息沿用網址參數 `?result=&message=` 顯示，React 會跳脫文字，不會執行內容，但別人可以做出帶假訊息的連結給管理員點（既有做法，所有 admin 頁都一樣，風險低，列 backlog）。
- **畫面：** 老師列表改成篩選列（待審／已通過／已暫停／全部，預設待審，等最久的排前面）＋卡片（名稱、狀態、服務地區與年資、多久前）；詳情頁 `/admin/teachers/[teacherProfileId]`：下一步（待審：通過、退回＋範本；已通過：暫停＋確認視窗；已暫停：暫停原因與恢復；已退回：只顯示結果）→ 聯絡方式 → 老師資料（全中文，含評價）。審核後回列表並顯示成功提示，失敗留在詳情頁顯示原因。訊息全部中文。「已退回」的申請不在列表任何分頁（原本就不在），只能用網址進詳情頁。
- **測試：** `admin-teachers`、`teacher-profile-edit`、`teacher-profile-suspension`、`notification`、`review-average-rating-display` 都改成「列表 → 詳情」流程；新增詳情頁權限與狀態測試（非管理員、草稿、不存在的 id 都 404；已退回只顯示結果；篩選分頁）。admin 全部＋角色切換＋上述 5 支共 150 支通過（`PORT=3100`）。
