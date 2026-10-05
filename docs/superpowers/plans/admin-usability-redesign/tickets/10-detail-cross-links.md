# 10: 詳情之間的關聯入口

**What to build:** 管理員在需求詳情看到「已成立的課程」可一鍵進該課程詳情；在課程詳情可一鍵進授課老師詳情、來源需求詳情，以及「所屬團體」（限定到該團體的團體列表）。關聯不存在或不可見時不出現連結，也不暴露隱藏紀錄。

**Blocked by:** 09：課程→所屬團體要用票 09 建立的關聯條件機制（團體列表以 `organizationId` 限定）。

**Status:** accepted（2026-10-05 產品主人回覆「09 通過，開始做 10」放行；同日實作後回覆「10 通過，開始做 11」，畫面驗收通過）

**Workflow mode:** STANDARD（詳情 DTO 補關聯 id，須做 security self review）

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、PERMISSION_BOUNDARY、SCOPE_DRIFT_RISK。

**來源：** 規格第 6 節；計畫第三批第 1 點與完成條件「老師自建課無需求／團體時不產生死連結」。

## Acceptance criteria

- [x] 需求詳情：狀態為已建課且存在課程時，顯示課程名稱與「查看課程」入口；沒有課程時不出現。
- [x] 課程詳情：授課老師名稱連到老師詳情；有來源需求且該需求不是草稿時連到需求詳情；有團體時「所屬團體」連到以 `organizationId` 限定的團體列表。
- [x] 老師自建課（無需求、無團體）只顯示中性文字（例如「老師開課」），不渲染任何死連結。
- [x] 來源需求若為草稿（理論上不應發生，但 DTO 須防守）或老師資料查無時，不渲染連結。
- [x] 團體列表支援以 `organizationId` 限定單一團體，顯示對象名稱與「解除限定」；同名團體時只顯示所選那一個。
- [x] 詳情間跳轉採最簡單規則：目的詳情的「回列表」回該類列表的預設條件（瀏覽器上一頁仍可回原詳情），不建立跨 kind 的返回堆疊。若產品主人希望保留來源，另提選項。
- [x] desktop 1280px／mobile 390px：關聯區塊在詳情的次要資料位置，長名稱換行不溢出，點擊區域足夠大。

## 實作紀錄（2026-10-05）

- 讀取：`getDemandRequestForAdmin` 另帶已成立課程（只取 id／名稱）；`getClassSessionDetailForAdmin` 的 `demandRequest` 補 id／status、`teacherProfile` 補 id／status、`organization` 補 id，只用來決定連結是否渲染。沒有新增其他角色可呼叫的讀取。
- 需求詳情：「這筆需求已處理」區塊在有課程時顯示「已成立的課程：查看課程「名稱」」，沒有課程不出現。
- 課程詳情：新增「相關資料」區塊（課程資料之後、名單之前）：授課老師（老師非草稿才給連結）、來源需求（存在且非草稿才給連結，否則「沒有來源需求」）、所屬團體（有團體才給連結，否則「沒有所屬團體」）。文字用「沒有來源需求／沒有所屬團體」而不寫「老師開課」，因為團主直接開團的課程也可能沒有來源需求。內容重排仍屬票 11。
- 團體列表：`list-context` 讓團體列表接受 `organizationId`；顯示「只看團體「名稱」」、解除限定與清除全部條件，可與關鍵字組合；查無 id 只說找不到。依 id 篩選，同名團體不混入。
- 詳情間跳轉不帶 `returnTo`：目的詳情的「回列表」回該類列表預設（瀏覽器上一頁仍可回原詳情）。
- 測試資料調整：共用本機資料庫已套用另一個 task 尚未 commit 的 `ClassSession_origin_invariants_check`（團主團課必須有來源需求）。票 09 測試原本建立沒有需求的團主團課，改為每堂團主團課都建立一筆已建課需求，新舊規則下都合法；團體 A 需求數因此由 2 變 3。本票沒有改 schema 或 migration。
- 驗證：tsc、lint、build（第一次因 OneDrive 鎖住 `.next` 刪除失敗，重跑通過）、`git diff --check` 通過；3100 執行 `admin-detail-links`（新增）＋`admin-list-context`＋`admin-related-lists`＋`admin-organizations` 30/30，回歸 `admin-demands`／`admin-class-session-management`／`admin-teachers`／`admin-dashboard`／`role-switch` 88/88，皆含 desktop 與 mobile。截圖 `.ai-runs/admin-usability/*-class-related.png`，已親看 390px 無橫向溢出。
- Codex peer review 第 1 輪指出：只隱藏連結不夠，課程詳情仍會露出草稿需求的程度、草稿老師的姓名／email。已改在讀取層防守：`getClassSessionDetailForAdmin` 遇到草稿需求整筆回 null、草稿老師不回傳姓名與 email（頁面顯示「老師資料無法查看」）；`listAllClassSessionsForAdmin` 草稿老師姓名也回 null（列表不顯示、搜尋不命中）。測試補上有程度的草稿需求、有姓名／email 的草稿老師課程，確認內容與連結都不出現；並驗證從詳情跳到課程／需求詳情後「回列表」是該類列表預設。`admin-detail-links`＋`admin-related-lists`＋`admin-class-session-management`＋`admin-list-context` 44/44 通過。

## Security self review 重點

- 只在既有 admin 詳情讀取中補 `demandRequestId`（含 status 檢查）、`teacherProfileId`、`organizationId`、需求的已建課 class id／title；不新增其他角色可呼叫的讀取。
- 連結是否渲染由 server 讀到的關聯與可見性決定；目的頁仍各自 `requireAdmin()` 並保留草稿排除，連結本身不代表授權。

## 候選檔案

- `src/app/admin/demands/[demandRequestId]/page.tsx`、`src/app/admin/classes/[classSessionId]/page.tsx`（只加關聯區塊，課程內容重排屬票 11）
- `src/app/admin/organizations/page.tsx`、`src/app/admin/_lib/list-context.ts`（團體列表 `organizationId` 限定）
- `src/domain/demand-request/admin-service.ts`（詳情補已建課資訊）、`src/domain/class-session/admin-service.ts`（詳情補關聯 id）、`src/domain/organizer-profile/admin-service.ts`
- `tests/smoke/admin-demands.spec.ts`、`admin-class-session-management.spec.ts`、`admin-organizations.spec.ts`

## 不做

不新增團體／團主詳情 route，不改需求或課程狀態、不代建課或代選老師。不得 commit／push。

<!-- codex-peer-reviewed: 2026-10-04T22:20:22Z rounds=2 verdict=approved -->

<!-- codex-peer-reviewed: 2026-10-05T08:01:49Z rounds=2 verdict=approved -->
