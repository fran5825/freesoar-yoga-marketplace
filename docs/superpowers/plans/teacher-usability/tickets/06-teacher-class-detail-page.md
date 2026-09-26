# 06: 單堂課詳情頁與列表整張可點（決策 2、6）

**What to build:** 新頁面 `/teacher/classes/[classSessionId]`，順序為：下一步提示 → 報名狀況與名單 → 課程內容 → 操作（發布開放報名、取消、標記完成、確認／婉拒待審報名，全部沿用現有 action）。`/teacher/classes` 列表卡片整張可點進詳情，操作從列表搬進詳情頁。不新增編輯課程內容（backlog 第 11 項）。

**Blocked by:** 02、05

**Status:** done（2026-09-26）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 不改狀態機與 action 行為；下一步文案依 `ClassSession` 狀態顯示，放 domain 層共用（總覽第 08 票會重用）

**實作紀錄：** 新增 `/teacher/classes/[classSessionId]`：回我的課程 → 標題與狀態／來源／系列徽章 → 「下一步」→ 報名狀況（待確認報名＋已報名名單）→ 課程內容（含課程風格、瑜伽類型、公開與報名方式）→ 評價（已完成才顯示）→ 課程操作（開放報名、標記完成、取消，只對自己開的課）。別人的課 404。下一步文案放在 domain 層 `getTeacherClassNextStep`（列表、詳情、總覽共用）。列表卡片整張可點，顯示日期地點、報名人數、待確認人數與一句話下一步；列表不再有任何操作按鈕；系列徽章在列表是文字（卡片本身已是連結，不能再包連結），系列管理連結在詳情頁。操作按鈕送出後回到同一堂課的詳情頁（`classSessionId` 只接受 id 格式，組站內路徑，不接受外部網址）。更新 5 個舊測試改到詳情頁操作；另修 3 個測試檔寫死的過期日期（backlog 1b 的一部分），才能驗證詳情頁流程。

**Source:** `docs/teacher-usability-plan.md`

- [x] 每種課程狀態（draft、open_for_enrollment、completed、cancelled）都有下一步文案
- [x] 列表卡片整張可點；系列課仍導到系列詳情
- [x] 待審報名可確認／婉拒，結果與原本一致
- [x] 桌機與手機皆可正常操作，老師課程相關 smoke 測試更新後通過
