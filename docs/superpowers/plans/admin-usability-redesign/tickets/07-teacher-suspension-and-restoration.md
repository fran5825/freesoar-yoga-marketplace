# 07: 老師暫停與恢復

**What to build:** 管理員在老師詳情填寫暫停原因，確認對象與影響後送出；失敗不丟失原因且可修正。已暫停老師可一鍵恢復，兩種操作成功後回到原查找位置並能追查老師結果。

**Blocked by:** 05：沿用已調整的老師詳情布局與經驗證的表單／回饋模式；不依賴需求票 06 或取消票 08。

**Status:** accepted（2026-10-04 實作；2026-10-05 產品主人畫面驗收通過）

**Workflow mode:** STANDARD

**Human Gate:** yes（2026-10-04 產品主人已確認四票粒度與依賴並授權寫入文件；第一批畫面驗收及第二批 Builder 放行仍須另有紀錄）。

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。只調整既有暫停／恢復的互動與回饋，不變更老師資格政策或權限模型。

**來源：** 管理後台第二輪規格與四批計畫的第二批；Q8、Q14、Q15、Q20，以及本次四票確認。

## Acceptance criteria

- [x] 暫停入口位於閱讀後的操作區，僅在現有資格允許時顯示；必填原因及原長度／trim 驗證不變，畫面說明老師看得到原因。
- [x] 原因有效後才開啟確認視窗；視窗顯示老師名稱與實際影響，不宣稱既有課程會一併取消，也不新增 email 通知承諾。
- [x] 確認、返回、Esc 與焦點回到觸發位置可用；返回或關閉不送出、不清空原因，再次開啟仍可完成操作。
- [x] 恢復維持一鍵送出，不增加多餘確認步驟；請求處理中顯示狀態並阻擋重複／互斥操作。
- [x] 原因不足、service 失敗或資格已變時留當前老師詳情，保留已填原因、顯示正確失敗與下一步，失敗後依合法資格可修正／重試，不留下永久停用控制項。
- [x] 暫停／恢復成功保留原搜尋／分類，結果指出老師與狀態並提供追查入口，即使老師已離開原分類仍找得到。
- [x] 原因只保留在本頁表單狀態，不進 URL 或新增持久化草稿；既有 admin guard、暫停／恢復資格、domain 狀態與通知效果保持原樣。
- [x] desktop 1280px／mobile 390px 驗證正常操作、原因驗證、失敗保留、資格變動、處理中、取消確認及鍵盤／觸控流程；回歸票 05 的通過／退回。

## 實作紀錄（2026-10-04）

- 新增 `TeacherStatusPanel`（老師詳情操作區）：暫停先填原因，原因通過瀏覽器驗證才開確認視窗，視窗顯示老師名稱與依既有 domain 規則的實際影響：無法再被團主選定、課程從公開課程列表移除且不能接受新報名、已建立的課程與既有報名不會自動取消、原因會顯示給老師、之後可恢復（Codex peer review 指出原「已建立的課程不受影響」不精確，已修正）；恢復維持一鍵送出。
- 原因欄（`ReasonTemplateField`，老師退回／需求退回／暫停共用）新增 trim 後字數的 custom validity：前後補空白的短原因在送出或開確認視窗前就被擋下，伺服器驗證照舊。測試以 `bypassClientReasonValidation` 繞過瀏覽器檢查，另外證明伺服器仍擋下。
- 暫停／恢復 action 改為回傳狀態：失敗不跳頁、不 revalidate，原因留在本頁可修正重試；`teacher_profile_not_approved`／`not_suspended` → stale `changed`（停用並提供重新載入），`not_found` → `missing`（回老師列表）。成功才 revalidate 並回原搜尋／分類。移除不再使用的 `redirectToDetail`。
- 共用確認元件 `AdminConfirmButton` 新增選填 `pending`／`pendingLabel`：有傳時依呼叫端的處理中狀態停用，失敗後解除；沒傳的課程／報名取消呼叫者維持原行為。視窗關閉（返回、Esc、點背景）時焦點回到觸發按鈕。
- 失敗提示抽成 `AdminActionFeedback.tsx`（`AdminStaleNotice`、`AdminActionError`、`findStaleState`），審核面板與狀態面板共用。
- 老師列表的結果追查連結補目前狀態：「查看 ○○（目前：已暫停）」。
- 驗證：tsc、lint、build、diff check 通過；全部 admin smoke＋`role-switch`＋`notification` 126/126（desktop＋mobile），包含課程／報名取消（共用確認元件回歸）與票 05 通過／退回回歸。新增暫停完整流程（空白或補空白短原因不開視窗、Esc 不送出不清空且焦點回到按鈕、伺服器拒絕後保留原因並可重試、成功追查、一鍵恢復）與暫停／恢復資格變動測試。截圖 `.ai-runs/admin-usability/*-teacher-suspend-confirm.png`。
- 未驗證：連點兩次與延遲請求中的處理中文字只靠停用邏輯，沒有專門的延遲測試；service 暫時失敗（`suspend_failed`／`restore_failed`）重試沒有專門測試，走一般可重試錯誤；確認視窗只驗證 Esc 與焦點返回，未手動逐一按過 Tab 順序。

## Checks 與完成邊界

使用現有 typecheck、lint、build、diff check、老師 admin smoke 與雙裝置畫面檢查。共用確認元件若有調整，須檢查其既有課程／報名呼叫者，避免暫停修正使其他操作失效；未驗證項須明列。

不改誰能暫停／恢復、老師狀態政策、需求媒合或既有課程行為。不新增授予／撤銷管理員功能，相關權限模型仍在 backlog 17；遇到需改 Auth、schema、permissions 或 domain transition 必須另提產品主人確認。不得 commit／push／部署。

<!-- codex-peer-reviewed: 2026-10-03T23:23:36Z rounds=2 verdict=approved -->
