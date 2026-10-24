# 02: 單堂課建立後直接開放報名

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 單堂建課表單加入「建立後直接開放報名／先存成草稿」，預設直接開放。選直接開放時，建好就是開放報名中，畫面顯示「已開放報名。下一步：把報名連結傳給學員」與複製連結按鈕；開放失敗時保留為草稿並說明原因。選先存草稿則照舊。開放後與 0 人報名時的下一步文字改成同樣意思。

**Blocked by:** 01（同改建課表單，避免衝突）

**Status:** done

**Workflow mode:** HEAVY

**Human Gate:** yes

**Risk flags:** 狀態轉換時點改變（`draft → open_for_enrollment` 在建立的同一個操作完成），狀態機本身不變、沿用既有開放報名 service 的權限檢查；推翻 2026-10-03 Q6（產品主人 2026-10-24 Q4 已確認）。依 `risk-based-workflow.md` §4.3 改變核心建課流程屬 HEAVY：要有計畫、rollback 方式、驗證與獨立 review。不改 schema，所以不需要獨立資料庫

- [x] 單堂建課表單有兩個選項，預設建立後直接開放報名
- [x] 直接開放：建立後課程狀態為開放報名中，詳情頁顯示新的成功訊息與下一步
- [x] 先存草稿：行為與改版前相同
- [x] 「建立成功、開放失敗」時：課程留在草稿，頁面導到這堂草稿的詳情頁並說明「課程已建立，但還沒開放報名：原因…」，老師可以在詳情頁直接重試開放；不能顯示成「尚未建立」，也不能讓老師重送表單建出第二堂（現有表單狀態與防重送邏輯假設錯誤都發生在寫入前，要一併調整）
- [x] rollback 方式寫進進度紀錄（例如把預設改回先存草稿即可回到舊行為）
- [x] 開放後（含 0 人報名）的下一步文字提示傳連結給學員
- [x] 相關 smoke 測試通過（teacher-initiated-open-classes、teacher-class-usability）

## 進度紀錄


- 2026-10-24 計畫（HEAVY，動手前）：
  1. domain：`service.ts` 新增 `createOwnClassSessionAndMaybeOpenForTeacher`（暫名），先呼叫既有 `createOwnClassSessionForTeacher`；建立成功且選了直接開放時，再呼叫既有 `openOwnClassSessionForEnrollmentForTeacher`（權限、資格、狀態檢查完全沿用，狀態機不變）。開放失敗（含例外）時課程保留草稿，回傳 `{ ok: true, classSessionId, openOutcome: "failed", openFailureMessage }`，不回傳成「建立失敗」。
  2. Server Action：建立成功後一律 redirect 到這堂課的詳情頁，所以表單不會再出現「課程還沒建立」或重送按鈕；開放失敗時用 `result=error` 顯示「課程已建立，但還沒開放報名：原因…」，詳情頁本來就有「開放報名」按鈕可重試。建立本身拋例外時維持 `result_unknown`（擋重送）。
  3. 表單：單堂「報名設定」加「建立後直接開放報名／先存成草稿」，預設直接開放；摘要與頁首說明跟著改。單堂用自己的欄位，不改系列的預設（系列仍預設先存草稿）。
  4. 文案：詳情頁開放報名成功、建立即開放都顯示「已開放報名。下一步：把報名連結傳給學員。」；`getTeacherClassNextStep` 開放中（含 0 人）改成提示傳連結。
  5. 測試：teacher-initiated-open-classes、teacher-class-usability 加直接開放、先存草稿、開放失敗三條路徑，並更新受影響的既有文案。
- Rollback 方式：把單堂表單 `openForEnrollmentSingle` 的預設值改回 `false`（先存成草稿）即回到舊行為；完全撤回則 revert 本票 commit。沒有 schema 或資料變更，不需要資料修復。
- 2026-10-24：實作完成。`createOwnClassSessionForTeacher` 加 `openForEnrollment`，建立後用 `openNewlyCreatedClassSessionForTeacher`（沿用 `openClassSessionForEnrollmentForTeacher` 核心）開放；失敗或例外都回傳「課程已建立，但還沒開放報名：原因」並導到草稿詳情頁。tsc、lint 通過；smoke 因本機 PostgreSQL（Docker）未啟動尚未執行。
- 2026-10-24：smoke 通過——teacher-initiated-open-classes 17/18、teacher-class-usability 15/16、teacher-class-detail-page 14/14、class-yoga-styles 14/14、class-member-info 16/16、class-cover-photo 16/16。兩個手機版失敗在改版前的 66363eb 也一樣失敗，與本票無關：teacher-class-usability「leaving with unsaved input」（手機版找不到可見的 /teacher/dashboard 連結）、teacher-initiated-open-classes「action buttons only appear…」（草稿的「取消課程」在手機收進「更多」）。公開選項說明原本含「地點」，會讓 getByLabel("地點") 撞到兩個欄位，已改成「看得到課程內容」。獨立 review 依協調者指示合併後再做。
