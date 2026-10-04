# 06: 需求閱讀與審核回饋

**What to build:** 管理員先閱讀需求內容與聯絡資訊，再公開或展開原因退回；失敗保留原因，成功回原列表。退回結果及範本清楚說明需另建需求，讓管理員與團主得到一致的下一步資訊。

**Blocked by:** 05：沿用已在老師審核流程驗證的表單狀態、送出中與失敗回饋模式；不依賴票 07 或 08。

**Status:** accepted（2026-10-04 實作；2026-10-05 產品主人畫面驗收通過）

**Workflow mode:** STANDARD

**Human Gate:** yes（2026-10-04 產品主人已確認四票粒度與依賴並授權寫入文件；第一批畫面驗收及第二批 Builder 放行仍須另有紀錄）。

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。僅調整既有公開／退回的 UI 與回饋，不改 Auth、schema、permissions 或 state machine。

**來源：** 管理後台第二輪規格與四批計畫的第二批；Q7、Q8、Q14、Q15、Q17、Q19、Q20，以及本次四票確認。

## Acceptance criteria

- [x] 詳情先顯示對象／狀態／時間與摘要，再呈現重要內容、次要資料與操作；有合法審核時提供頁內跳轉，次要資訊可展開，不遺失原可讀資訊。
- [x] 上課對象、人數、時間、地點、頻率、預算、需求說明與團體／團主聯絡資料容易找到；不能只憑標題做決定。
- [x] 公開一鍵送出；退回先展開可編輯原因，再明確送出，清楚說明團主看得到原因。逐字使用規格核准的需求三句範本。
- [x] 需求範本、已退回結果與無原因時的 fallback 提示皆說明「另建需求」，不得暗示可修改原需求重新送審；老師重新送審文案不得混用。
- [x] 保留既有必填／長度／trim、確認欄位與 server 驗證。原因不足、service 失敗或資格已變時留在同一筆需求，保留原因並顯示可行下一步，不提供已失效的審核操作。
- [x] 原因只存在本頁表單狀態，不進 URL 或新增持久化草稿。送出中顯示處理狀態並阻擋重複／互斥提交，失敗後能依合法資格修正／重試。
- [x] 成功保留原搜尋／分類與結果追查；已處理需求不出現不合法審核動作，非 admin 與需求草稿仍不可讀。
- [x] desktop 1280px／mobile 390px 完成閱讀、跳轉、公開、退回、範本編輯、失敗修正與返回；長內容與聯絡 email 不溢出，鍵盤／觸控可用。

## 實作紀錄（2026-10-04）

- 共用：票 05 的審核面板抽成 `src/app/admin/_components/AdminReviewPanel.tsx`，老師與需求共用（刪除 `TeacherReviewPanel.tsx`）；失敗分類抽成 `adminReviewFailure()`（`src/app/admin/_lib/action-state.ts`）。老師 smoke 全數回歸通過。
- 公開／退回 action 改為回傳狀態：失敗不跳頁、不 revalidate，原因留在本頁；`demand_request_not_submitted` → stale `changed`（畫面說明改為「這筆需求已不是待審狀態，可能剛才已經被處理過。」，service 原文不變），`demand_request_not_found` → stale `missing`（回需求列表，不落入 404）。成功訊息補「團主需另建一筆需求」。
- 詳情頁重排：摘要（團體・人數・頻率・地點）與「前往審核操作」→ 處理結果 → 需求內容 → 團主與聯絡資料 → 其他資料（每堂長度、團體類型，收合）→ 審核操作。已退回結果與無原因 fallback 都說明另建需求，移除舊的「團主修改後可以重新送審」。
- 範本換成規格第 9 節需求三句。詳情欄位改用 `wrap-anywhere`，長 email 不撐開手機版面（老師詳情同步）。
- 驗證：tsc、lint、build、diff check 通過；`admin-demands`、`admin-teachers`、`notification` smoke 60/60（desktop＋mobile）；截圖 `.ai-runs/admin-usability/*-demand-review-stale.png`。
- 未驗證：連點兩次與公開／退回互斥提交只靠按鈕停用邏輯；service 暫時失敗（`demand_request_publish_failed`／`reject_failed`）後重試沒有專門測試，只能靠程式碼確認走一般可重試錯誤；鍵盤只驗證展開後焦點落在原因欄。團主端看到的退回文案屬其他角色 UI，未改。

## Checks 與完成邊界

沿用票 05 的模式，但以需求自己的資格、原因與錯誤測試證明完整流程。使用現有 typecheck、lint、build、diff check、相關 admin smoke、返回與 role guard 回歸及雙裝置畫面檢查。須驗證退回終局文案、失敗輸入保留、資格變動與重複提交；未驗證項須明列。

不新增需求重新送審、admin 代建需求、選老師或建課能力；不改 domain mutation、state transition、原因規則或通知。跨資料導覽仍屬第三批。不得 commit／push／部署。

<!-- codex-peer-reviewed: 2026-10-03T22:58:01Z rounds=1 verdict=approved -->
