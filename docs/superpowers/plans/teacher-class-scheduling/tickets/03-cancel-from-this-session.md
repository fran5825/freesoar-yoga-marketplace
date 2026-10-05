# 03：從這場以後全部取消

**What to build:** 老師在系列中選一場，取消這場與之後所有尚未開始、未取消的場次，之前的場次照常；確認視窗先列出實際會取消的場次與報名人數。

**Blocked by:** None (can start immediately)

**Status:** done（2026-10-05，待產品主人看畫面）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** SCOPE_DRIFT_RISK（沿用既有單場取消與連帶取消報名、通知，不新增狀態；若需改取消核心則停止改提 HEAVY）

規格：[4.6 停課](../../../../specs/teacher-class-scheduling-spec.md)（Q6、Q13）；情境 S10、S18。

- [x] 系列頁每一場與該場詳情頁都有「從這場以後全部取消」入口，放在次要操作區。
- [x] 確認視窗列出會取消的場次、合計報名人數與通知影響；取消前不寫入。
- [x] 確認後沿用既有老師取消場次規則，連帶取消報名並通知；之前的場次與已完成紀錄不受影響。
- [x] 先鎖系列列，鎖內重新讀取「這場以後」的場次集合，再依 id 排序逐場取消（規格第 6 節鎖定協定）。
- [x] 系列保留；持續開課仍可再生成更多。
- [x] own-scoped：他人系列拒絕；暫停中的老師沿用既有取消資格規則。
- [x] Smoke 測試覆蓋：只取消選定場次之後的未開始場次、連帶報名、取消前無寫入、他人拒絕；tsc、lint、受影響 smoke 通過；RWD 檢查。

## 執行紀錄（2026-10-05）

- 老師取消單堂核心拆出 `cancelClassSessionForTeacherInTransaction`（不拋預期錯誤、回傳通知資料）與 `notifyClassSessionCancelledForTeacher`；原 `cancelClassSessionForTeacher` 行為不變。
- 新增 `__internal__/cancel-series-from-occurrence-core.ts`：鎖本人系列列 → 鎖內確認這一場屬於這個系列 → 重讀「這一場起」尚未開始的草稿／開放報名場次 → 依 id 排序在同一 transaction 內逐場取消（連帶取消 confirmed／pending 報名）→ commit 後每場各發一則取消通知。系列保留。
- 畫面：系列頁每一場（尚未開始的草稿／開放報名）多「從這場以後全部取消」；單堂詳情頁若屬於系列且之後還有場次，在「取消這堂課」區塊下方提供同一操作。確認視窗列出實際會取消的場次與報名數；完成後回到系列頁。指定日期系列的說明不寫「可以再生成」。
- 既有測試調整：`teacher-class-list-navigation` 原本斷言「草稿場次沒有任何按鈕」，改為精確斷言「沒有複製報名連結、有從這場以後全部取消」，已完成場次仍無任何按鈕。
- Checks：整個 repo `tsc`、`eslint` 通過；`next build` 通過；Playwright 112 個中 108 個通過，2 個是本票新測試資料錯誤（同老師兩系列同時段，已修正並重跑通過），2 個是上述既有斷言（已更新並重跑通過）。重跑時資料庫連線數次中斷（`Can't reach database server`，多個 task 同時跑測試），列表導覽 28 次執行中 1 次不同步驟偶發失敗，判斷為環境不穩。
- RWD：375／768／1440 系列頁、確認視窗、單堂詳情無橫向捲動，按鈕高度 ≥ 44px。
- 執行方式同票 01：3100 埠被另一個 task 占用，複製到暫存資料夾 build，用 3200 埠測試。

<!-- codex-peer-reviewed: 2026-10-04T00:20:21Z rounds=4 verdict=approved -->
