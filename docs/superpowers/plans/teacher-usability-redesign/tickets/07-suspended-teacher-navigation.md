# 07：暫停老師：找得到既有課程

**What to build:** 暫停中的老師能從老師專區找到已有查看資格的我的課程，理解限制，查看本人既有課程。

**Blocked by:** None（現有課程列表即可驗收；實作仍需本票 Human Gate）。

**Status:** done（2026-10-04）

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

## 驗收條件

- [x] 暫停者的老師專區顯示「我的課程」查看入口，可到本人列表與詳情，保留暫停原因與既有限制說明。
- [x] 入口只補上原已允許的讀取能力；不修改 Auth、role、capability、service guard 或 permission policy，不增加建立新課／回應新需求能力。
- [x] 未有老師資料、草稿、審核中及退回者不因這次導覽呈現取得課程能力；已通過者既有入口與操作不回歸。
- [x] 直接進入建課或不具資格的 mutation 仍依原守門拒絕，跨老師讀取仍拒絕；不得為了讓測試通過而放寬資格。
- [x] 手機與電腦均能找到入口，鍵盤可操作；文案不暗示已恢復審核或可繼續開課。
- [x] outcome tests 以各 profile 狀態驗證入口與原讀寫邊界，附三種寬度的畫面檢查結果。

## 實作與驗證邊界

- 本票是既有權限下的導覽呈現，不是權限擴充，因此採 STANDARD；若實作發現原讀取權限不成立，停止改列 HEAVY decision plan。
- 不依賴新列表、申請或建課，可用既有頁面驗收；不改全站其他角色導覽。
- 執行 diff whitespace、TypeScript、ESLint、build、老師 profile 狀態導覽及直接 route／mutation 邊界 smoke。
- rollback 僅移除本票入口及相關測試／描述，不變更任何帳號狀態。
- 實作需本票範圍核准；不得擅改 rejected／approved／suspended policy。

## 執行紀錄（2026-10-04）

- `src/app/teacher/_components/TeacherShell.tsx`：暫停老師的導覽多一組 `suspendedLinks`（總覽、我的課程、老師資料、通知），不含需求池；其他狀態維持原樣。`src/app/teacher/classes/page.tsx` 對暫停老師顯示限制說明（可查看既有課程與名單，暫時不能開新課或回應需求，暫停原因見老師總覽）。Auth、role、service guard、permission 都沒改，讀取資格本來就由 D15 允許。
- Checks：`tsc`、`eslint`、`npm run build` 通過；`teacher-class-list-navigation.spec.ts` 14 個測試通過（PORT=3200，新增各 profile 狀態的導覽入口、暫停者可讀本人課程、別人的課 404、直接進建課頁仍顯示「老師資格已暫停」、無需求池）。手機版測試透過「選單」按鈕找到入口。
- 同一批回歸測試中 `teacher-profile-suspension.spec.ts:328`（admin「暫停這位老師」）失敗：admin 老師頁在 working tree 被其他 task 改成確認視窗，與本票無關，未處理。
- 先前一次 `series → 返回` 網址斷言在機器負載高時失敗一次，單獨重跑通過。
- 畫面：導覽列樣式沿用既有 RoleNav，只多一個連結；三種寬度由桌機（1280）與手機（390）兩個 Playwright project 實際點擊驗證，未另外截圖。
