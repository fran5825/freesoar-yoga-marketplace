# 12: 報名名單搜尋、分類與待確認報名取消

**What to build:** 管理員在課程詳情的名單看到每位學員的姓名與 email，可用姓名或 email 搜尋，並在全部／待老師確認／已報名／已取消之間切換（各有數量）。待老師確認的報名也能取消；取消後留在名單、保留搜尋與分類，若該筆因此離開目前分類，提示仍指出學員與結果並提供查看入口。

**Blocked by:** 11：名單放在票 11 建立的詳情順序之下，且本票分類數量在未搜尋時須與票 11 的報名摘要一致，需先有票 11 的詳情順序與摘要。

**Status:** accepted（2026-10-05 產品主人在 10、11 push 後回覆「好」放行；同日實作後回覆「12 通過」，畫面驗收通過）

**Workflow mode:** STANDARD（新增報名者 email 進 admin DTO，必須做 security self review）

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、PRIVACY_RISK（學員姓名／email）、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

**來源：** 規格第 2、8 節；計畫第三批第 3 點。

## Acceptance criteria

- [x] Admin 名單 DTO 分開帶 `memberName` 與 `memberEmail`（取代只有 `memberLabel` 的合併顯示）；姓名缺漏時有中性 fallback，email 缺漏時清楚標示。
- [x] 名單搜尋比對姓名或 email；分類「全部／待老師確認／已報名／已取消」，數量先套用搜尋再計數。票 11 的報名摘要（已報名／待老師確認／名額佔用）與整堂取消確認的連帶報名數一律用未篩選的完整名單，不受名單搜尋影響；只有未搜尋時分類數量與摘要相同。驗證案例：整堂 8 筆 confirmed、2 筆 pending，搜尋只命中 1 位 confirmed 時，分類顯示 1／0，摘要仍為 8／2、佔用 10。若有 `attended`／`no_show` 等歷史狀態，在「全部」中清楚標示，不新增出席管理動作。
- [x] 狀態標籤用「待老師確認」（取代目前的「處理中」）、「已報名」、「已取消」。
- [x] pending 報名在課程未開始時顯示取消入口，確認視窗沿用票 08（學員、課程、不可恢復、同學員不可重報）；資格仍完全由既有 `cancelEnrollmentForAdmin` 依當下狀態與開始時間判斷——取消核心已支援 pending，本票不改核心（`src/domain/enrollment/admin-service.ts` 寫「status="confirmed"」的過時註解可順手更正）。
- [x] 名單條件放在課程詳情 URL（例如 `rq`、`rstatus`），經 `list-context.ts` 式的白名單 normalize；與課程詳情原有的 `returnTo` 並存且互不覆蓋。
- [x] 單筆取消成功：留在同一課程名單並保留搜尋與分類；若該筆已離開目前分類，提示指明「學員＋已取消」並提供「查看這筆」（例如切到已取消分類並定位）入口。失敗：留在名單、保留條件，訊息說明原因與下一步（沿用票 08 回饋）。
- [x] 整堂取消仍回原課程列表（沿用第一批／票 08）。
- [x] 回饋 URL 不放 email（用 enrollment id 定位提示），避免 email 出現在網址列與伺服器 log；名單搜尋關鍵字本身可能是 email，只存在本頁 URL，不寫入其他紀錄。
- [x] desktop 1280px／mobile 390px：姓名／長 email 換行不溢出，名單卡片在手機單欄；搜尋、分類、取消可用鍵盤與觸控完成。

## 實作紀錄（2026-10-05）

- 讀取：admin 專用的 `AdminClassSessionRosterEntry` 以 `memberName`／`memberEmail` 取代 `memberLabel`；只在 `getClassSessionDetailForAdmin`（`requireAdmin()` 之後）出現，沒有改其他角色的名單型別。`enrollment/admin-service.ts` 過時的「只有 confirmed」註解已更正，取消核心未改。
- 名單：顯示姓名（缺漏「未填姓名」）與 email（缺漏「未提供 email」）；姓名／email 搜尋；分類「全部／待老師確認／已報名／已取消」，數量先套用搜尋再計數；已出席／未出席只在「全部」出現並標示，沒有操作按鈕。pending 標籤由「處理中」改為「待老師確認」。上方報名摘要（票 11）與整堂取消影響數仍用完整名單。
- 條件：`list-context.ts` 新增 `normalizeAdminRosterQuery`（`rq` 去空白、最多 200 字；`rstatus` 白名單，其他值回「全部」）與 `adminClassRosterHref`（與 `returnTo` 並存）。搜尋表單、分類連結、單筆取消表單、整堂取消表單都帶著條件（整堂取消失敗時留在同一課程並保留條件，成功仍回原課程列表）。
- 取消：pending 與 confirmed 在課程未開始時都有入口；pending 的確認視窗多一句「這筆報名還在等老師確認。」資格仍完全由 `cancelEnrollmentForAdmin` 判斷。成功／失敗都留在同一課程名單，保留 `rq`／`rstatus`／`returnTo`，並帶 `item`（enrollment id）。該筆已離開目前分類時，提示提供「查看這筆（學員・狀態）」，切到該筆目前的分類並定位到那一列。整堂取消仍回原課程列表。
- 隱私修正：原本的結果提示用「姓名，沒有就用 email」，而提示會進網址。現在 action 不讀任何學員姓名或 email：網址只帶通用文字（「已取消這筆報名…」／「這筆報名沒有取消：…」）與格式合法的 `item`（enrollment id，不合格式就不帶）；頁面用 `item` 對照自己讀到的名單，才在畫面上把「這筆報名」換成學員名稱（沒有姓名時用 email，只在頁面上）。對照不到（例如被竄改）就只顯示通用文字。表單不再有 `memberLabel`／`memberName` 隱藏欄位。
- 驗證：tsc、lint、build 通過；3100 執行新增 `admin-roster`（非 admin 404；姓名＋email、未填姓名、已出席標示；email 片段搜尋時分類 1／0 而摘要仍 3／1／4；姓名搜尋＋待老師確認分類取消 pending；成功後保留條件與返回、查看這筆定位到已取消；無姓名學員取消後網址無 email；回課程列表保留搜尋；不合法分類回全部）＋`admin-list-context`（名單條件純函式）通過。截圖 `.ai-runs/admin-usability/*-roster.png`。回歸 `admin-*`＋`role-switch`＋`enrollment*`＋`notification`＋`class-session-cancellation` 共 212 項，210 項首輪通過；2 項失敗（`admin-related-lists` 長流程 desktop、`notification` 老師送審 mobile）發生在約 13 分鐘的整輪高負載下，單獨重跑各 ×2 ×雙裝置 8/8 通過。
- Codex peer review 第 1 輪指出：(1) 姓名本身可能是 email、竄改的 `enrollmentId` 會原樣進 `item`，網址仍可能出現 email；(2) 整堂取消表單沒帶名單條件；(3) 失敗重試、搜尋時整堂取消影響數、開始後 pending、缺 email、未出席、鍵盤操作沒有測試。已改為上述「網址只帶通用文字＋合格 id，名稱由頁面補」的設計並補整堂取消條件；`admin-roster` 擴充為單一長流程測試：缺 email、未出席、搜尋中整堂取消確認顯示完整 5 筆、鍵盤完成搜尋與 pending 取消（網址 message 為通用文字）、背後狀態改變的失敗保留條件與 item、`enrollmentId` 竄改成 email 時網址無 email 且無 item 後重試成功、無姓名學員網址無 email、整堂取消失敗保留條件、開始後 pending 無取消、非 admin 以真實課程 404。票 08 的竄改測試改為斷言通用文字。`admin-roster`＋`admin-class-session-management`＋`admin-list-context`＋`admin-class-detail-summary` 43/44 首輪通過，唯一失敗為資料庫連線初始化錯誤，單獨 ×2 ×雙裝置 4/4 通過。

- Codex peer review 第 2 輪指出：網址參數重複時 Next 會給陣列，`message` 不是字串會讓頁面拋錯。課程詳情的 `result`／`message`／`item` 改為只接受單一字串，其餘忽略；`rq`／`rstatus`／`returnTo` 原本就經 normalize 安全回退。`admin-roster` 補重複參數案例（頁面 200、分類回全部、搜尋清空、返回回預設列表）。`admin-roster`＋`admin-class-session-management`＋`admin-class-detail-summary`＋`admin-detail-links` 32/32 通過。Codex 第 3 輪核准後重跑完整回歸 `admin-*`＋`role-switch`＋`enrollment*`＋`notification`＋`class-session-cancellation` 210/210 首輪全數通過（desktop＋mobile）。

## Security self review 重點

- 學員姓名／email 只出現在 `getClassSessionDetailForAdmin`（已 `requireAdmin()`）的 admin 專用型別；不放進公開、老師、團主或學員使用的共用 DTO，也不改 `ClassSessionRosterEntry` 等其他角色型別。
- 名單篩選在 server 端以已授權讀到的資料進行；URL 條件只是 UI 狀態，不影響可見範圍或取消資格。
- 回饋訊息與額外定位參數（`result`／`message`／`item` 等）不加入 email；唯一例外是管理員自己輸入的名單搜尋詞 `rq`，它可能是 email，因此無法保證 email 不出現在該網址或存取紀錄，這是已知取捨。新增測試確認非 admin 仍拿不到名單頁。

## 候選檔案

- `src/app/admin/classes/[classSessionId]/page.tsx`、`src/app/admin/classes/[classSessionId]/actions.ts`（保留名單條件的 redirect）
- `src/app/admin/_lib/list-context.ts`（名單條件 normalize／href）
- 必要時新增 `src/app/admin/_components/AdminRoster*.tsx`
- `src/domain/class-session/admin-service.ts`（名單 DTO）、`src/domain/enrollment/admin-service.ts`（只更正註解）
- `tests/smoke/admin-class-session-management.spec.ts`、回歸 `enrollment.spec.ts`／`enrollment-approval.spec.ts` 的不可重報與 pending 邊界

## 不做

不改報名／取消核心、名額規則、不可重報規則或通知；不新增 admin 確認報名、全站學員搜尋、報名詳情 route 或匯出。不得 commit／push。

<!-- codex-peer-reviewed: 2026-10-04T22:20:22Z rounds=2 verdict=approved -->

<!-- codex-peer-reviewed: 2026-10-05T13:52:50Z rounds=3 verdict=approved -->
