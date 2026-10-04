# 05: 老師申請閱讀與審核回饋

**What to build:** 管理員先看清楚老師與教學資料，再一鍵通過或展開原因退回；送出中不重複提交，失敗仍留在同一位老師的詳情並保留原因，成功回原查找位置且能追查結果。此票同時建立可供需求審核與老師狀態操作沿用的表單／回饋模式。

**Blocked by:** None（第二批內無票券依賴；開工仍須符合本批共同 Human Gate）。

**Status:** accepted（2026-10-04 實作；2026-10-05 產品主人畫面驗收通過）

**Workflow mode:** STANDARD

**Human Gate:** yes（2026-10-04 產品主人已確認四票粒度與依賴並授權寫入文件；第一批畫面驗收及第二批 Builder 放行仍須另有紀錄）。

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。僅調整既有審核的閱讀、表單與回饋；不改 Auth、schema、permissions 或 state machine。

**來源：** 管理後台第二輪規格與四批計畫的第二批；Q7、Q8、Q14、Q15、Q17、Q19、Q20，以及本次四票確認。

## Acceptance criteria

- [x] 詳情順序為返回 → 對象／狀態／時間與摘要 → 重要資料 → 次要資料 → 操作。有合法操作時提供頁內跳轉，不重複整套表單，也不增加固定底部操作列。
- [x] 教學年資、簡介、教學風格、擅長、服務地區、授課形式與聯絡資料容易找到；證照、偏好等次要資料可展開，保留原可讀資訊及既有評價。
- [x] 通過一鍵送出；退回先展開原因，再明確送出。逐字使用規格核准的老師三句範本，帶入後仍可編輯，並說明老師看得到原因。
- [x] 保留既有原因長度、trim 與 server 驗證。原因不足、service 回報失敗或審核資格已變時，保留本頁已填原因、顯示失敗與可行下一步，不假稱成功；資格已變時不可繼續提供不合法操作。
- [x] 原因只保留在本頁表單狀態，不放 URL、不寫入新增的資料庫／瀏覽器持久化草稿；不承諾離開頁面或重新整理後仍保留。
- [x] 請求處理中顯示狀態並阻擋重複或互斥提交；失敗後可依當下資格修正／重試，不留下永久停用的按鈕。
- [x] 成功回原搜尋／分類並可追查老師；已處理狀態顯示對應結果，非 admin／草稿限制與 server-side guard 保持原樣。
- [x] desktop 1280px／mobile 390px 完成閱讀、跳轉、範本編輯、通過、退回、錯誤修正及返回；長內容不溢出，鍵盤與觸控可操作。

## 實作紀錄（2026-10-04）

- 共用模式：`src/app/admin/_lib/action-state.ts`（失敗回傳狀態、成功 redirect）。06、07 沿用同一模式。
- 通過／退回 action 改為回傳狀態，失敗時一律不跳頁、不呼叫 `revalidatePath`（只在成功時呼叫），已填原因留在本頁。原因不足或暫時失敗時可修正後重試。資格已變時另外標記 stale：`teacher_profile_not_submitted` → `changed`，停用本頁審核並提供「重新載入，查看目前狀態」；`teacher_profile_not_found` → `missing`，停用並提供「回老師列表」（不落入 404）。說明一律取自回報 stale 的那次結果，stale 時隱藏所有「再送出」提示。service、原因驗證、通知不變。
- `TeacherReviewPanel` 以 `onSubmit` 自行送出，避免 React 在 action 結束後清空表單；任一送出中兩鈕皆停用。
- 退回範本換成規格第 9 節老師三句；暫停／恢復表單只移到最下方操作區，互動未改（屬票 07）。
- 驗證：tsc、lint、build、diff check 通過；`admin-teachers` smoke 22 項（desktop＋mobile），含失敗保留原因、資格變動保留原因、資料已刪除、兩表單混合失敗等新測試；`notification` smoke 通過；截圖 `.ai-runs/admin-usability/*-teacher-review-error.png`。
- 偶發：「通過申請後回列表」測試在另一個 task 同時 build／dev server 高負載時 5 秒內未跳轉 3 次；低負載下兩測試 ×5 次 ×雙裝置 20/20 通過。判斷為負載造成，未能完全排除點擊落在 hydration 期間的可能。
- 未驗證：連點兩次的阻擋只靠按鈕停用邏輯，沒有寫專門的連點測試；鍵盤只驗證展開後焦點落在原因欄，沒有手動按過整條 Tab 流程。

## Checks 與完成邊界

開工前讀票單的共同 gate 與四批計畫。驗證正常成功、空白／不足原因、失敗保留、資格變動與連續點擊，並回歸第一批返回條件、結果追查及角色限制。使用現有 typecheck、lint、build、diff check、相關 admin smoke 與雙裝置畫面檢查；未驗證項須明列。

老師暫停／恢復的互動調整屬票 07，本票重排詳情時保留既有合法能力。只建立本票完整審核流程需要的共用模式，不做獨立大型表單框架。不得改 domain mutation、原因規則、權限、通知效果或新增其他批次能力；不得 commit／push／部署。

<!-- codex-peer-reviewed: 2026-10-03T22:14:37Z rounds=3 verdict=approved -->
