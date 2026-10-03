# 01：單堂開課：分區、摘要與錯誤保留

**What to build:** 老師在單頁填寫單堂課程，核對實際設定後建立完整草稿；被拒絕時能直接修正原輸入，離開未完成表單時得到提醒。

**Blocked by:** None（無票券依賴；實作仍需本票 Human Gate）。

**Status:** done（2026-10-04）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

## 驗收條件

- [x] 單堂預設，以「課程內容／時間地點／報名設定」三區呈現；選填說明預設收合，必填與既有預設保留。
- [x] 三種排程入口清楚可見；本票完成單堂流程，另外兩種仍可走既有流程且切換保留輸入，其完整摘要與錯誤保留由 02 完成。
- [x] 公開列表可見性與是否需老師確認報名分成兩組選項；不將非公開稱為私密或指定名單可見。
- [x] 單堂即時摘要顯示名稱、日期、24 小時時間、地點、名額與報名設定，與實際提交值一致；取代單堂泛用確認勾選，提醒建立後不能編輯，不加新的建立確認視窗。
- [x] 缺項、時間／衝突或 service 驗證失敗後原輸入與摘要保留，錯誤可辨識及修正；pending 防止重複送出，不自動重試未知結果。
- [x] 成功只建立一堂完整 draft，依原成功 id 進詳情；不提前開放、不更改公開設定、不吞掉成功 redirect。
- [x] 載入與預填不被誤判為使用者改動；修改後離頁有提醒，取消離開留在原表單，成功建立解除提醒。無瀏覽器持久化、自動儲存或離頁續填。
- [x] 單堂主要成功／失敗路徑有 outcome tests；原建課資格、ownership、輸入與時間邊界維持，重複排程及團主建課案例無回歸。
- [x] 375px／768px／1440px 檢查長文字、錯誤、摘要、焦點與至少 44px 操作目標，沿用老師專區品牌與頁寬。

## 實作與驗證邊界

- 共用局部表單型別、摘要與離頁提醒只在本票必要時整理，與完整單堂成果一起交付；不另外做空的基礎架構票。
- 單堂 action 只改失敗回傳與 UI 銜接，成功 redirect、domain service、寫入規則、通知副作用不變；重複建課 action 留 02。
- 不包含詳情重排、列表入口上移、篩選、系列管理或申請。
- 執行 diff whitespace、TypeScript、ESLint、build、老師單堂建課與輸入驗證相關 smoke；重複模式至少回歸現有成功路徑。檢查失敗須區分本票與其他 task 的變更。
- rollback 僅回復本票的呈現、action adapter 與測試／描述變更，不刪除已建立課程、不回復他人的 working tree。
- 實作前確認整體 shared understanding 與本票 allowed files／checks。需改 Auth、schema、權限、狀態或 mutation policy 時停止，另提 HEAVY decision plan。

## 執行紀錄（2026-10-04）

- 授權：產品主人採用精簡版八票執行 prompt，並選擇「每票通過後在本機 commit 該票檔案，不 push」。
- 改動：`src/app/teacher/classes/new/` 的 `actions.ts`、`_components/ClassSessionCreateForm.tsx`，新增 `_components/ClassCreateSummary.tsx`、`_lib/form-state.ts`、`_lib/use-unsaved-changes.ts`；測試新增 `tests/smoke/teacher-class-usability.spec.ts`，並調整 4 個既有老師建課 smoke 的舊勾選／模式名稱步驟。domain service、權限、寫入與通知不變。
- 實作重點：單堂 action 失敗回傳結果（不再導回空白頁），成功 redirect 不放在 try/catch；表單改為自己攔截送出後用 `startTransition` 呼叫 action，避免 React 19 `<form action>` 回傳後自動重設勾選欄位畫面。
- Checks：`tsc --noEmit`、`eslint`、`npm run build`、`git diff --check` 通過；Playwright（PORT=3100，桌機＋手機）6 個檔共 70 個測試通過。
- RWD：375／768／1440 截圖檢查，無橫向捲動；衝突錯誤後焦點移到開始時間；單選可用方向鍵切換；本票新增的按鈕、單選卡片、收合標題高度皆 ≥ 44px。
- 已知限制：(1) 課程風格／瑜伽類型標籤用共用元件 `TagCheckbox`（約 32px 高），屬共用檔、不在本票範圍，留給 08 統一處理或另提決策。(2) 離頁提醒涵蓋關閉分頁／重新整理與站內連結點擊；瀏覽器「上一頁」不提醒（App Router 無可靠攔截方式）。(3) 網路中斷等未知結果會進既有錯誤頁，不自動重送。
- 系列兩種模式仍保留舊確認勾選，摘要與錯誤保留由票 02 完成。
