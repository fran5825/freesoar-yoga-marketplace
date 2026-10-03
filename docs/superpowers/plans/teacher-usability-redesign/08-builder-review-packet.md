# 老師 usability redesign：Builder Review Packet（票 01–08）

日期：2026-10-04。Builder：Claude Code。授權：產品主人採用精簡版八票執行 prompt，並選擇「每票通過後在本機 commit 該票檔案、不 push」（見票券 README「執行授權紀錄」）。

## 1. 完成結果

八票全部完成（01–07 實作、08 整合驗收與文件同步）。各票驗收逐項記在 `tickets/0N-*.md` 的「執行紀錄」。

| 票 | 結果 | Commit |
| --- | --- | --- |
| 01 單堂開課 | 三區、建立前核對摘要取代確認勾選、失敗留在原頁保留輸入、送出中防重按、未建立離頁提醒 | `5bf6ec8` |
| 02 重複開課 | 每週固定／指定日期套用摘要（每週日期用 domain 同一函式推算）、失敗保留、`series_create_failed` 不提供重送 | `1c0345c` |
| 03 單堂詳情 | 頂端課程重點＋下一步操作；婉拒／取消先在確認視窗說明影響；送出中防重按 | `77d2c3f` |
| 04 我的課程 | 即將上課／草稿／過往／全部分頁、建立入口上移、白名單返回上下文 | `bf37291` |
| 05 系列管理 | 逐場日期／狀態／已報名／待確認、場次返回系列、整系列取消先確認 | `8220c69` |
| 06 老師申請 | 七項必填集中、選填收合、即時缺項聚焦、送審摘要＝送出內容、儲存只認列送出 snapshot、逾時不冒稱已存 | `7615941` |
| 07 暫停老師 | 導覽補「我的課程」，只讀；不加需求池或建課 | `4dca28f` |
| 08 整合驗收 | 完整老師旅程回歸、修正寫死日期的既有系列測試、文件同步、本 packet | 本票 commit |

## 2. Changed files（本工作，`e7598a3..HEAD` 加本票）

- Source：`src/app/teacher/classes/new/`（`actions.ts`、`recurring-actions.ts`、`_components/ClassSessionCreateForm.tsx`、`_components/ClassCreateSummary.tsx`、`_lib/form-state.ts`、`_lib/use-unsaved-changes.ts`）；`src/app/teacher/classes/`（`page.tsx`、`actions.ts`、`[classSessionId]/page.tsx`、`series/[recurringClassSeriesId]/page.tsx`、`_components/ConfirmActionDialog.tsx`、`_components/PendingSubmitButton.tsx`、`_lib/class-list-tabs.ts`、`_lib/return-context.ts`）；`src/app/teacher/_components/TeacherShell.tsx`；`src/app/teachers/join/_components/TeacherApplicationForm.tsx`；`src/domain/class-session/read-service.ts`（只加票 05 的 own-scoped counts）。
- Tests：新增 `teacher-class-usability.spec.ts`、`teacher-class-list-navigation.spec.ts`；修改 `teacher-class-detail-page`、`teacher-initiated-open-classes`、`teacher-recurring-class-series`、`teacher-join`、`class-yoga-styles`、`class-session-cancellation`／`completion`／`creation`、`create-actions-placement`、`enrollment-approval`（只改老師婉拒那步）、`enrollment`（只改老師那步，該檔其他 task 的修改未 commit）。
- Docs：票券 01–08 與 README、`docs/specs/teacher-usability-redesign-spec.md`、`docs/domain/state-transition-details.md`（一句說明）、`docs/product/route-map.md`（只 commit 本工作那段）、本 packet。
- 共 7 個票 commit 44 個檔案（+4121／−862），完整 diff：`git diff e7598a3..HEAD`。

## 3. Checks

| Check | 結果 |
| --- | --- |
| `git diff --check e7598a3..HEAD` | 通過 |
| `npx tsc --noEmit` | 通過（每票） |
| `npx eslint`（老師相關目錄） | 通過（每票） |
| `npm run build` | 通過（每票改 source 後重建） |
| Codex review 第 1 輪修正後（PORT=3200） | `npm run build` 通過；`teacher-class-usability`、`teacher-recurring-class-series`、`teacher-join`、`teacher-class-detail-page`、`class-yoga-styles` 76 個通過；新增「送審中欄位鎖住、唯讀摘要＝送出內容」測試 2 個通過（桌機＋手機） |
| 完整老師旅程 Playwright（`teacher-*.spec.ts`＋建課／報名審核／取消／完成／建立入口，桌機＋手機，PORT=3200） | 284 個中 283 通過；1 個（`class-session-completion.spec.ts:209` 團主標記完成，桌機）單獨重跑 8/8 通過，判定為負載下偶發 |

限制與未處理的既有失敗（不在本工作範圍，未修改）：

- `signed-in-navigation.spec.ts:83`：造訪 `/classes` 後上次使用專區變學員。來自其他 task 尚未 commit 的 `src/app/classes/**` 修改。
- `teacher-profile-suspension.spec.ts:328`：admin「暫停這位老師」按鈕改成確認視窗。來自其他 task 尚未 commit 的 `src/app/admin/teachers/**` 修改。
- 未跑全 repo 的 admin／organizer／member 測試；其他 task 的 working tree 正在變動中。

## 4. RWD／鍵盤／畫面證據

每票以臨時 Playwright 腳本在 375／768／1440 截圖並量測（腳本跑完即刪，截圖在 Builder scratchpad，未進 repo）：

- 所有頁面無橫向捲動；main 內按鈕、連結、單選卡片、收合標題高度 ≥ 44px。
- 建課錯誤後焦點到第一個可修正欄位；申請缺項時焦點到第一個缺項；確認視窗預設焦點在「先不要」、Escape 關閉、焦點回觸發按鈕；單選可用方向鍵切換；建課與列表可用 Tab 走到主要操作。
- 長課名、長地址、長備註、26 場日期清單（建課摘要兩欄、取消視窗內捲動）都正常換行。
- Codex review 第 1 輪後實測：月曆前後月按鈕、單堂詳情系列標籤在三種寬度皆 44px；月曆日期格 768px 寬 90、1440px 寬 51、高 44；**375px 寬 42、高 44**（七欄已貼齊老師專區頁寬，差 2px，需改共用外框才能再加寬，列為已知限制）。
- 已知限制：課程風格／瑜伽類型／擅長類型標籤用共用 `TagCheckbox`（`src/app/_components/tag-checkbox.tsx`，約 32px 高），其他角色也在用，不在本工作允許範圍。

## 5. Self review

- V1：都在既有老師流程內；沒有課程編輯、系列公開、批次操作、套裝報名、自動儲存、付款／退款、AI、native App、Wellness／Academy／Retreat、老師 SaaS。
- 角色／權限：沒改 Auth、session、role、capability、service guard。暫停老師只補原本 D15 允許的讀取入口；建課頁仍顯示「老師資格已暫停」。團主媒合課的老師操作資格不變。
- 狀態機／資料：沒改 Prisma schema、migration、state transition、mutation policy、通知。read DTO 只加票 05 的 counts，查詢仍限定本人系列，只讀報名狀態不讀學員資料。
- Route／安全：返回上下文只收白名單參數，系列必須是這堂課自己的系列；外部網址、雙斜線、未知參數一律退回我的課程（有測試）。成功 redirect 都不在 try/catch 內；未知送出結果不自動重送。
- 品牌：沿用既有色票、`rounded-full` 按鈕與老師專區頁寬；沒有斜體強調、01／02 編號標籤或等寬字小標；文案低壓、不承諾未做的 email 或公開功能。
- 無關變更：沒有修改其他 task 的檔案內容；共用檔（`route-map.md`、`enrollment.spec.ts`）只把本工作那段放進 commit。
- Commit／push：依產品主人選擇每票本機 commit；未 push、未部署、未操作 production。

## 6. Scope drift check

- 票 01 為了保留輸入，表單改成自己攔截送出後用 `startTransition` 呼叫 action（React 19 `<form action>` 回傳後會自動重設勾選欄位畫面）。屬於表單銜接方式，不改 action 結果。
- 票 03 把婉拒成功文案「已拒絕」改成「已婉拒」，與按鈕用詞一致。
- 票 04 讓「＋ 建立課程」只在 `approved` 時顯示（原本列表底部對所有人顯示，非 approved 點進去才被擋）。符合規格「資格不足時不提供可執行的新建操作」。
- 票 06 讓送審按鈕缺項時仍可按（按下帶到缺項、不開確認），取代原本停用狀態；domain 送審驗證不變。
- 票 08 修改既有 `teacher-recurring-class-series.spec.ts` 的寫死日期（2026-10-05 起），避免明天開始失敗；只改測試資料日期，斷言不變。
- 沒有其他超出票券的改動。

### Codex peer review 第 1 輪後的修正（2026-10-04）

- 離頁提醒在送出中也保持啟用（建課、申請）：成功 redirect 是 router 導覽，不經過連結點擊或 beforeunload，不會被攔；送出中點連結離開會先問。
- 老師申請送審中鎖住所有欄位；送審成功後唯讀摘要改用實際送出的 snapshot，不會顯示送出後才改的內容。
- 建課結果不確定時不提供重送：`series_create_failed` 與新的 `result_unknown`（service 拋出例外時由 action 回傳，redirect 仍在 try/catch 外）都會隱藏建立按鈕；系列兩種模式共用這個判斷，切換模式也擋住。錯誤標題只有在確定寫入前失敗（驗證、時段衝突、未登入、無老師資料）時才寫「還沒建立」，其他寫「建立沒有完成」。
- 觸控目標：月曆前後月按鈕 `min-h-11 min-w-11`；月曆改手機一欄、`lg` 以上兩欄，日期格 `min-h-11` 且不留間距；手機建課卡片內距 `p-4`；單堂詳情的系列標籤連結 `min-h-11`。

## 7. 需要產品主人決定的事與已知限制

- `TagCheckbox` 觸控高度約 32px（規格要求 44px）。這是全站共用元件（團主需求、老師資料也在用），改它會影響其他角色畫面。建議另開一張小票統一調整。
- 系列「已建立但場次生成失敗」時，service 回傳結果不含系列 id；若系列一場都沒生成，「我的課程」只從場次列出系列入口，找不到它。要讓畫面直接帶到系列頁，需要 `createOwnRecurringClassSeriesForTeacher` 失敗結果多回傳 `recurringClassSeriesId`（domain service 回傳值變更，不在本次授權範圍）。目前做法：不提供重送、說明可能已建立並引導到我的課程（全部）或聯絡平台。
- 瀏覽器「上一頁／下一頁」不會觸發離頁提醒：Next.js App Router 沒有可靠攔截 popstate 的公開 API，自行改寫 history 會破壞 router 狀態。目前涵蓋關閉分頁、重新整理、輸入網址與站內連結。
- 系列場次不列在公開「找課程」，學員要有該場連結才能報名，但老師詳情頁沒有「複製報名連結」按鈕，老師要自己把網址的 `/teacher` 拿掉。產品主人已在使用中遇到這個問題，建議另開小票加上分享連結。

## Recommended Next Step（Common Handoff Schema）

- Level：L1。
- Recommended next work mode：Product Owner 檢視畫面＋決定是否 push；之後可選做 TagCheckbox 小票。
- Next smallest actionable slice：產品主人在本機實際操作一次老師旅程（建課 → 詳情 → 處理報名 → 返回），確認後決定是否 push 這 8 個 commit。
- Why this should be next：八票已完成且測試通過，剩下的是產品檢視與上傳決定；push 需要明確同意。
- Can Codex execute directly：可以執行 push 或 TagCheckbox 小票，但都需要產品主人明確要求。
- Suggested execution location：current task。
- Requires product owner decision：是（是否 push；是否開 TagCheckbox 小票）。
- Suggested next prompt：「我看過老師流程了，請 push 到 main，並另外開一張小票把 TagCheckbox 觸控高度調到 44px（先列影響的頁面給我看）。」
- Auto-continue allowed：否。
- Auto-continue reason：八票授權範圍已全部完成；push 與共用元件修改不在授權內。
- Stop condition triggered：授權範圍完成；push 需要明確同意。
- Notify human：是。
- Notification reason：八票完成，等待產品檢視與 push 決定。
- Approval noise reduction applied：是，八票在同一份授權內連續執行，沒有逐票重問已確認的設計。
- Approval boundary note：本工作停留在授權範圍內；未 push、未部署；TagCheckbox 與其他 task 的測試失敗都未處理，需另外決定。
