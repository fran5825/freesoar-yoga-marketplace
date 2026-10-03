# 06：老師申請：必填集中與摘要送審

**What to build:** 老師在一致的手機表單完成七項必填、選擇是否保存草稿，直接核對摘要送審；能理解審核中與退回後的下一步。

**Blocked by:** None（申請可獨立驗收；實作仍需本票 Human Gate）。

**Status:** done（2026-10-04）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

## 驗收條件

- [x] 顯示名稱、介紹、教學風格、年資、專長、服務地區、授課形式七項必填集中呈現，必填與驗證不減少；選填收在「其他資料（可之後補）」。
- [x] 即時缺項提示可帶到欄位，取代重複「檢查準備狀態」按鈕；主要送審與可選儲存草稿清楚，不要求先存才能送審。
- [x] 既有二次送審確認顯示本次實際送出的摘要，返回能修正；確認前不送審，pending 防重複，送審成功依既有流程轉唯讀。
- [x] 儲存成功只把送出的 snapshot 視為已存，儲存途中新增修改仍未存；讀取／儲存 timeout 或失敗不宣稱已存、不把 timeout 當取消 server 請求。
- [x] 首次載入、既有資料整理與預填不誤觸未存提醒；使用者修改後提醒有效，保存失敗保留輸入，成功送審解除提醒，不新增自動儲存。
- [x] 審核中唯讀摘要、退回理由與修正再送、通過／暫停進既有老師總覽的銜接完整；登入 session、申請狀態與導向政策不變。
- [x] outcome tests 覆蓋七項缺漏、選填錯誤、未先存直接送審、摘要、失敗保留、儲存競態、timeout 及各審核狀態。
- [x] 375px／768px／1440px 檢查初次填寫、唯讀、退回、長內容、focus 與觸控目標，沿用老師專區視覺與低壓文案。

## 實作與驗證邊界

- 只調整既有表單與確認呈現，不改 Auth、公開 onboarding policy、審核資格、狀態轉換、domain validation 或通知。
- 不重設 admin 審核、不加即時核准或暫停者建立能力；其他老師功能不混入本票。
- 執行 diff whitespace、TypeScript、ESLint、build、申請與既有狀態回歸 smoke，完成 RWD／鍵盤 QA。
- rollback 僅回復表單與測試／描述，不變更已送審資料與歷史狀態。
- 實作需本票範圍核准；若必須改 session、審核或導向 policy，停止另提 HEAVY decision plan。

## 執行紀錄（2026-10-04）

- 改動：`src/app/teachers/join/_components/TeacherApplicationForm.tsx`；`src/app/teacher/classes/new/_lib/use-unsaved-changes.ts` 加可選提醒文字參數供申請頁沿用。Auth、導向、審核狀態、domain validation、通知不變；`application-fields.ts` 未改。
- 七項必填集中在「送審必填（7 項）」，選填收在可展開的「其他資料（可之後補）」；移除「檢查準備狀態」。送審按鈕缺項時仍可按，按下會標出缺項並聚焦第一個欄位，不開確認；缺項清單的連結也會聚焦該欄位。
- 送審確認顯示「這次送出的申請內容」（打開確認當下的 snapshot，按確認就送這一份；改任何欄位會收起確認）。
- 儲存草稿只把送出的那份視為已存（途中再改仍顯示「有尚未儲存的修改」）；逾時改為「無法確定是否已經存好」，不再誤顯示「請先登入」，也不宣稱已存。載入與整理舊資料當作基準不算修改；有未存修改時離頁提醒，送審成功轉唯讀後解除。
- 選填格式錯誤：domain 目前沒有選填欄位格式驗證，所以沒有可觸發的情境；程式已在儲存／送審回傳選填錯誤時自動展開「其他資料」，待日後有規則時生效。
- Checks：`tsc`、`eslint`、`npm run build` 通過；Playwright 申請／用語／登入導覽／角色切換／老師總覽／建課 6 個檔 78 個測試中 76 個通過（新增摘要＝送出內容、返回不送審、儲存競態、逾時、離頁提醒）。
- 2 個失敗是 `signed-in-navigation.spec.ts:83`（桌機＋手機）：造訪公開頁 `/classes` 後「上次使用的專區」變成學員。與本票無關，來自其他 task 尚未 commit 的 `src/app/classes/**` 修改，本票未處理，留給該 task。
- RWD：375／768／1440 無橫向捲動，按鈕與收合標題 ≥ 44px，缺項時焦點到第一個欄位；擅長類型等標籤沿用共用 `TagCheckbox`（約 32px 高，見票 01 已知限制）。
