# 09: 團體／老師的關聯限定列表

**What to build:** 管理員從團體卡片一鍵看到「這個團體的需求」或「這個團體的課程」，從老師詳情一鍵看到「這位老師的課程」。限定列表清楚顯示目前限定的對象名稱與「解除限定」，可再與關鍵字、狀態分類組合；進入詳情再返回、操作成功回列表時都保留這個限定條件。

**Blocked by:** None（第三批內無票券依賴；沿用第一、二批已驗收的列表上下文與回饋模式）。

**Status:** accepted（2026-10-05 產品主人回覆「第三批切票確認，開始做 09」放行；同日實作後回覆「09 通過，開始做 10」，畫面驗收通過）

**Workflow mode:** STANDARD（新增 admin 讀取條件，須做 security self review）

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、PERMISSION_BOUNDARY（新讀取條件，不改 permission model）、SCOPE_DRIFT_RISK、LOW_PRESSURE_UX_RISK。

**來源：** 規格第 4、5、6 節；計畫第三批第 1、5 點。

## Acceptance criteria

- [x] `src/app/admin/_lib/list-context.ts` 擴充關聯條件：需求列表接受 `organizationId`，課程列表接受 `organizationId` 或 `teacherProfileId`；只接受對應列表允許的參數，格式不合法（非字串、過長、含非 id 字元）時安全丟棄、回列表預設，不產生外部或跨角色 redirect。`safeAdminReturnTo`／`adminDetailHref`／`adminFeedbackHref` 一併保留合法關聯條件。
- [x] 限定條件以 id 精準篩選，不用名稱匹配；兩個同名團體／老師時只出現所選那一個的資料。
- [x] 限定列表顯示可辨識的對象名稱（由 admin 讀取依 id 查得）與「解除限定」入口；id 查無資料時顯示「找不到這個團體／老師」並提供解除，不顯示其他資料、不洩漏是否曾存在草稿。
- [x] 團體→需求：只列 non-draft 需求；團體卡片上「需求數」與點進去後「全部」分類的數量一致（沿用票 04 的 non-draft 計數）。數量為 0 時不渲染入口或以純文字顯示，不做死連結。
- [x] 團體→課程、老師→課程：課程數與限定列表「全部」數量一致；老師沒有任何課程時不渲染死連結。
- [x] 關鍵字搜尋、狀態分類與關聯條件可組合；分類數量先套用搜尋＋關聯再計數；「清除關鍵字」保留關聯條件，「清除全部條件」同時解除關聯並回預設分類（規格第 5 節）。
- [x] 從限定列表進詳情 → 返回、或審核／取消成功回列表，關聯條件、關鍵字、分類都保留；重新整理不遺失。
- [x] desktop 1280px／mobile 390px：限定對象名稱、解除入口、長名稱不溢出；鍵盤可操作。

## 實作紀錄（2026-10-05）

- `list-context.ts`：新增 `organizationId`／`teacherProfileId`。需求列表只接受團體、課程列表接受兩者（同時帶時取交集）、老師與團體列表不接受；值須符合 `^[A-Za-z0-9_-]{1,64}$`，否則丟掉。`adminListHref`／`safeAdminReturnTo` 帶上合法關聯，所以既有詳情返回與審核／取消成功導向不用改就會保留限定。
- 新元件 `AdminRelationNotice`（在 `AdminSearchForm.tsx`）：顯示「只看團體／老師「名稱」的需求／課程」、「解除限定」（保留關鍵字與分類）與「清除全部條件」；查無 id 顯示「找不到這個限定對象，可能已不存在。」。搜尋表單以隱藏欄位、`AdminFilterBar` 以 `relation` 參數保留限定。
- 讀取：需求詳情 DTO 補 `organizationId`、課程列表 DTO 補 `organizationId`／`teacherProfileId`（只用來篩選）；新增 `getOrganizationNameForAdmin`、`getTeacherDisplayNameForAdmin`（草稿老師回 null）、`countClassSessionsForTeacherForAdmin`，全部先 `requireAdmin()`，只 select 需要的欄位。需求篩選建立在原本就排除草稿的 `listDemandRequestsForAdmin` 上。
- 入口：團體卡片數量 > 0 時顯示「查看需求（N）」（連到「全部」分類）與「查看課程（N）」，0 時保留純文字；老師詳情「教學資料」區顯示「這位老師的課程（N）」或「尚無課程」。
- 驗證：tsc、lint、build、`git diff --check` 通過；3100 執行 `admin-related-lists`（新增：非 admin 404、同名團體／老師依 id 區分、草稿不出現、數量一致、搜尋＋分類＋限定組合、清除關鍵字保留限定、詳情返回保留、解除限定、查無 id、格式不合法 id）＋`admin-list-context`（新增關聯參數純函式測試）＋`admin-organizations` 26/26；回歸 `admin-demands`／`admin-class-session-management`／`admin-teachers`／`admin-dashboard`／`role-switch` 88/88，皆含 desktop 與 mobile。截圖 `.ai-runs/admin-usability/*-related-*.png`，已親看 desktop／390px 無橫向溢出。
- Codex peer review 第 1 輪指出兩個測試缺口，已補第三條流程測試：(1) 從「團體＋關鍵字＋待審」限定列表公開需求、從「團體＋關鍵字＋開放中」限定列表取消整堂，成功後回同一個限定列表、條件全保留、已移出分類的對象仍有「查看」入口，重新整理不遺失，課程「清除全部條件」回預設；(2) 草稿老師 id 與不存在的 id 顯示相同的「找不到」、不出現草稿老師姓名；沒有課程的老師顯示「尚無課程」、沒有連結。`admin-related-lists` 6/6（雙裝置）通過。

## Security self review 重點

- 頁面、讀取函式仍各自 `requireAdmin()`；關聯 id 只是篩選條件，不作為授權依據——即使 id 被竄改，也只能看到 admin 本來就能看的資料。
- 需求限定讀取必須保留 `status: { not: "draft" }`；不能因為帶了 `organizationId` 就改走沒有草稿排除的查詢。
- 名稱查找用窄 select（只取顯示名稱），不擴大其他 DTO。

## 候選檔案

- `src/app/admin/_lib/list-context.ts`（關聯參數 normalize／href／returnTo）
- `src/app/admin/_components/AdminSearchForm.tsx`、`AdminFilterBar.tsx`（保留關聯參數；必要時新增限定對象提示元件）
- `src/app/admin/demands/page.tsx`、`src/app/admin/classes/page.tsx`、`src/app/admin/organizations/page.tsx`（團體卡片入口）
- `src/app/admin/teachers/[teacherProfileId]/page.tsx`（只加「這位老師的課程」入口）
- `src/domain/demand-request/admin-service.ts`、`src/domain/class-session/admin-service.ts`（列表 DTO 補 `organizationId`／`teacherProfileId`，或接受篩選參數）、`src/domain/organizer-profile/admin-service.ts`、`src/domain/teacher-profile/service.ts`（老師課程數，僅 admin 讀取）
- `tests/smoke/admin-list-context.spec.ts`、`admin-organizations.spec.ts`、`admin-demands.spec.ts`、`admin-class-session-management.spec.ts`、`admin-teachers.spec.ts`

## 不做

不新增團體／老師／團主詳情 route；不改 mutation、Auth、schema、permissions、state machine；不做跨 kind 的多層返回堆疊（詳情間跳轉屬票 10）。不得 commit／push。

<!-- codex-peer-reviewed: 2026-10-04T22:20:22Z rounds=2 verdict=approved -->

<!-- codex-peer-reviewed: 2026-10-05T03:25:05Z rounds=2 verdict=approved -->
