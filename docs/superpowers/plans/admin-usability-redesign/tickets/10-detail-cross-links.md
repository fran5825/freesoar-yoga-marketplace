# 10: 詳情之間的關聯入口

**What to build:** 管理員在需求詳情看到「已成立的課程」可一鍵進該課程詳情；在課程詳情可一鍵進授課老師詳情、來源需求詳情，以及「所屬團體」（限定到該團體的團體列表）。關聯不存在或不可見時不出現連結，也不暴露隱藏紀錄。

**Blocked by:** 09：課程→所屬團體要用票 09 建立的關聯條件機制（團體列表以 `organizationId` 限定）。

**Status:** in-progress（2026-10-05 產品主人回覆「09 通過，開始做 10」放行本票 Builder）

**Workflow mode:** STANDARD（詳情 DTO 補關聯 id，須做 security self review）

**Human Gate:** yes（切票確認與第三批 Builder 放行須分別有產品主人紀錄）。

**Risk flags:** ADMIN_FLOW、PERMISSION_BOUNDARY、SCOPE_DRIFT_RISK。

**來源：** 規格第 6 節；計畫第三批第 1 點與完成條件「老師自建課無需求／團體時不產生死連結」。

## Acceptance criteria

- [ ] 需求詳情：狀態為已建課且存在課程時，顯示課程名稱與「查看課程」入口；沒有課程時不出現。
- [ ] 課程詳情：授課老師名稱連到老師詳情；有來源需求且該需求不是草稿時連到需求詳情；有團體時「所屬團體」連到以 `organizationId` 限定的團體列表。
- [ ] 老師自建課（無需求、無團體）只顯示中性文字（例如「老師開課」），不渲染任何死連結。
- [ ] 來源需求若為草稿（理論上不應發生，但 DTO 須防守）或老師資料查無時，不渲染連結。
- [ ] 團體列表支援以 `organizationId` 限定單一團體，顯示對象名稱與「解除限定」；同名團體時只顯示所選那一個。
- [ ] 詳情間跳轉採最簡單規則：目的詳情的「回列表」回該類列表的預設條件（瀏覽器上一頁仍可回原詳情），不建立跨 kind 的返回堆疊。若產品主人希望保留來源，另提選項。
- [ ] desktop 1280px／mobile 390px：關聯區塊在詳情的次要資料位置，長名稱換行不溢出，點擊區域足夠大。

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
