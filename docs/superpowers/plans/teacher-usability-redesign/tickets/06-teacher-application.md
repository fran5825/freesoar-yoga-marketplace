# 06：老師申請：必填集中與摘要送審

**What to build:** 老師在一致的手機表單完成七項必填、選擇是否保存草稿，直接核對摘要送審；能理解審核中與退回後的下一步。

**Blocked by:** None（申請可獨立驗收；實作仍需本票 Human Gate）。

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

## 驗收條件

- [ ] 顯示名稱、介紹、教學風格、年資、專長、服務地區、授課形式七項必填集中呈現，必填與驗證不減少；選填收在「其他資料（可之後補）」。
- [ ] 即時缺項提示可帶到欄位，取代重複「檢查準備狀態」按鈕；主要送審與可選儲存草稿清楚，不要求先存才能送審。
- [ ] 既有二次送審確認顯示本次實際送出的摘要，返回能修正；確認前不送審，pending 防重複，送審成功依既有流程轉唯讀。
- [ ] 儲存成功只把送出的 snapshot 視為已存，儲存途中新增修改仍未存；讀取／儲存 timeout 或失敗不宣稱已存、不把 timeout 當取消 server 請求。
- [ ] 首次載入、既有資料整理與預填不誤觸未存提醒；使用者修改後提醒有效，保存失敗保留輸入，成功送審解除提醒，不新增自動儲存。
- [ ] 審核中唯讀摘要、退回理由與修正再送、通過／暫停進既有老師總覽的銜接完整；登入 session、申請狀態與導向政策不變。
- [ ] outcome tests 覆蓋七項缺漏、選填錯誤、未先存直接送審、摘要、失敗保留、儲存競態、timeout 及各審核狀態。
- [ ] 375px／768px／1440px 檢查初次填寫、唯讀、退回、長內容、focus 與觸控目標，沿用老師專區視覺與低壓文案。

## 實作與驗證邊界

- 只調整既有表單與確認呈現，不改 Auth、公開 onboarding policy、審核資格、狀態轉換、domain validation 或通知。
- 不重設 admin 審核、不加即時核准或暫停者建立能力；其他老師功能不混入本票。
- 執行 diff whitespace、TypeScript、ESLint、build、申請與既有狀態回歸 smoke，完成 RWD／鍵盤 QA。
- rollback 僅回復表單與測試／描述，不變更已送審資料與歷史狀態。
- 實作需本票範圍核准；若必須改 session、審核或導向 policy，停止另提 HEAVY decision plan。
