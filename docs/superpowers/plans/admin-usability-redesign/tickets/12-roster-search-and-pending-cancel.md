# 12: 報名名單搜尋、分類與待確認報名取消

**What to build:** 管理員在課程詳情的名單看到每位學員的姓名與 email，可用姓名或 email 搜尋，並在全部／待老師確認／已報名／已取消之間切換（各有數量）。待老師確認的報名也能取消；取消後留在名單、保留搜尋與分類，若該筆因此離開目前分類，提示仍指出學員與結果並提供查看入口。

**Blocked by:** 11：名單放在票 11 建立的詳情順序之下，且本票分類數量在未搜尋時須與票 11 的報名摘要一致，需先有票 11 的詳情順序與摘要。

**Status:** draft（2026-10-05 產品主人已確認切票粒度與依賴；Builder 只放行到 09，本票待 09 完成並回報後依序接續）

**Workflow mode:** STANDARD（新增報名者 email 進 admin DTO，必須做 security self review）

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、PRIVACY_RISK（學員姓名／email）、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

**來源：** 規格第 2、8 節；計畫第三批第 3 點。

## Acceptance criteria

- [ ] Admin 名單 DTO 分開帶 `memberName` 與 `memberEmail`（取代只有 `memberLabel` 的合併顯示）；姓名缺漏時有中性 fallback，email 缺漏時清楚標示。
- [ ] 名單搜尋比對姓名或 email；分類「全部／待老師確認／已報名／已取消」，數量先套用搜尋再計數。票 11 的報名摘要（已報名／待老師確認／名額佔用）與整堂取消確認的連帶報名數一律用未篩選的完整名單，不受名單搜尋影響；只有未搜尋時分類數量與摘要相同。驗證案例：整堂 8 筆 confirmed、2 筆 pending，搜尋只命中 1 位 confirmed 時，分類顯示 1／0，摘要仍為 8／2、佔用 10。若有 `attended`／`no_show` 等歷史狀態，在「全部」中清楚標示，不新增出席管理動作。
- [ ] 狀態標籤用「待老師確認」（取代目前的「處理中」）、「已報名」、「已取消」。
- [ ] pending 報名在課程未開始時顯示取消入口，確認視窗沿用票 08（學員、課程、不可恢復、同學員不可重報）；資格仍完全由既有 `cancelEnrollmentForAdmin` 依當下狀態與開始時間判斷——取消核心已支援 pending，本票不改核心（`src/domain/enrollment/admin-service.ts` 寫「status="confirmed"」的過時註解可順手更正）。
- [ ] 名單條件放在課程詳情 URL（例如 `rq`、`rstatus`），經 `list-context.ts` 式的白名單 normalize；與課程詳情原有的 `returnTo` 並存且互不覆蓋。
- [ ] 單筆取消成功：留在同一課程名單並保留搜尋與分類；若該筆已離開目前分類，提示指明「學員＋已取消」並提供「查看這筆」（例如切到已取消分類並定位）入口。失敗：留在名單、保留條件，訊息說明原因與下一步（沿用票 08 回饋）。
- [ ] 整堂取消仍回原課程列表（沿用第一批／票 08）。
- [ ] 回饋 URL 不放 email（用 enrollment id 定位提示），避免 email 出現在網址列與伺服器 log；名單搜尋關鍵字本身可能是 email，只存在本頁 URL，不寫入其他紀錄。
- [ ] desktop 1280px／mobile 390px：姓名／長 email 換行不溢出，名單卡片在手機單欄；搜尋、分類、取消可用鍵盤與觸控完成。

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
