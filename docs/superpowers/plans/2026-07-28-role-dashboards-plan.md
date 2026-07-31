# Member / Organizer Dashboards — Implementation Plan

> Status: IMPLEMENTED — 2026-08-01 Product Owner 已確認 canonical routes 與 Organizer bootstrap policy；Builder 已完成實作與驗證。

## 1. 背景與目標

Member 與 Organizer 已有各自的完整列表頁，但缺少一個登入後可快速理解近況的彙整頁：

- Member 需要查看近期通知、自己的報名狀態與即將到來的課程。
- Organizer 需要查看近期通知、自己的需求狀態與最近更新的需求。

Admin Dashboard 已由獨立的 `admin-dashboard` slice 在 `/admin/dashboard` 出貨，不屬於本輪範圍；Teacher Dashboard 也已存在，不重做。

## 2. Product Owner Decisions

### D1 — Canonical routes

- Member Dashboard 使用 `/member/dashboard`。
- Organizer Dashboard 使用 `/organizer/dashboard`。
- 本輪不新增 `/member` 或 `/organizer` root-route alias / redirect。

這與 `docs/product/route-map.md`、`/teacher/dashboard`、`/admin/dashboard` 的既有命名一致。

### D2 — Organizer bootstrap

`/organizer/dashboard` 允許任何 signed-in user 進入：

- 已建立 `OrganizerProfile`：只讀取並顯示自己的通知與需求。
- 尚未建立 `OrganizerProfile`：只顯示前往 `/organizer/profile` 的建立 CTA，不顯示通知或需求資料。

這是 Organizer capability bootstrap 的窄例外，不開放任何其他 Organizer 的私有資料。

### D3 — Dashboard content

Member：

- 最近 5 筆 own notifications。
- `pending`／`confirmed`／`cancelled` enrollment 計數。
- 最早 5 筆尚未開始且狀態為 `confirmed` 的課程。
- 連到 `/notifications` 與 `/member/enrollments`。

Organizer：

- 最近 5 筆 own notifications。
- own demand requests 的非零狀態計數。
- 最近更新的 5 筆 own demand requests。
- 連到 `/notifications`、`/organizer/demands`、`/organizer/demands/new` 與各需求詳情。

### D4 — Data access

頁面只組合既有 exported read functions：

- `listOwnNotifications()`
- `listOwnEnrollmentsForMember()`
- `getOwnOrganizerContext()`
- `getOwnDemandRequestList()`

本輪不新增或修改 domain/service 查詢、Prisma schema、migration、mutation、permission helper、state machine 或 notification trigger。

### D5 — Test infrastructure

本輪不修改：

- `next.config.ts`
- `package.json`
- `package-lock.json`
- `playwright.config.ts`

Member／Organizer fixtures 都是 own-scoped，且測試帳號使用各自的 email domain 與唯一識別，不需要為本輪加入 `workers: 1`。若驗證失敗指向既有 config，應停止回報並另開獨立 slice，不在 Dashboard Builder 內修復。

## 3. Scope Boundary

### In scope

- `src/app/member/dashboard/page.tsx`
- `src/app/organizer/dashboard/page.tsx`
- `tests/smoke/member-dashboard.spec.ts`
- `tests/smoke/organizer-dashboard.spec.ts`
- 本 plan 與 `docs/product/route-map.md` 對齊

### Non-goals

- Admin／Teacher Dashboard
- `/member`、`/organizer` alias 或 redirect
- 全域 navigation 或 dashboard layout refactor
- Organizer ClassSession 摘要
- Member 課程 browse/search
- 已讀／未讀 notification state
- WebSocket／polling
- Auth、Prisma、permission、state machine、payment、email 或 notification 寫入改動

## 4. Security / Permission

- Member route 先執行 `requireUser()`，資料由 own-scoped read service 取得。
- Organizer route 先執行 `requireUser()`；只有 `getOwnOrganizerContext()` 成功取得自己的 profile 後，才讀取自己的 notifications 與 demand requests。
- 未建立 OrganizerProfile 時不呼叫 Dashboard 的 Organizer 私有資料彙整。
- 本輪沒有 mutation、表單或新的外部輸入，不新增 CSRF 或 IDOR surface。

## 5. Brand / UX / RWD

- 使用繁體中文、清楚且低壓的文案，不使用急迫或促銷式 CTA。
- 空狀態提供說明與自然下一步，不留空白區塊。
- Mobile-first cards / lists，不使用小螢幕難讀的表格。
- 既有 Playwright desktop 與 mobile projects 都需通過；另外以 360px 手動確認無橫向捲動、長文字不裁切且 CTA 可操作。

## 6. Implementation Slices

### Slice 1 — Member Dashboard

- 建立 `/member/dashboard`。
- 覆蓋未登入、空資料、報名計數、即將到來最多 5 筆、近期通知最多 5 筆及 outbound links。

### Slice 2 — Organizer Dashboard

- 建立 `/organizer/dashboard`。
- 覆蓋未登入、無 OrganizerProfile、無需求、多狀態需求、最近更新最多 5 筆、近期通知最多 5 筆及 outbound links。

### Slice 3 — Verification / Docs

- 更新 route map 的已落地狀態與 Organizer bootstrap 例外。
- 執行 lint、build、兩份 targeted smoke specs 與 full smoke suite。
- 手動執行 360px RWD 檢查。

## 7. Verification

```text
npm run lint
npm run build
npx playwright test tests/smoke/member-dashboard.spec.ts tests/smoke/organizer-dashboard.spec.ts
npm run test:smoke
```

若 checks 的修復需要觸碰本 plan 未授權的 config、Auth、Prisma、domain 或 Admin 檔案，立即停止並回報。

## 8. Rollback

兩個 Dashboard 與各自 smoke spec 可獨立移除，不涉及 migration 或資料回滾。文件只需恢復 route map 的落地標記與 bootstrap 說明。

## 9. Implementation Verification（2026-08-01）

- `npm run lint`：passed。
- `npm run build`：passed；route manifest 只包含 `/member/dashboard`、`/organizer/dashboard`，沒有 root aliases。
- Targeted Dashboard smoke：18/18 passed（desktop + mobile，並在有資料情境額外以 360px 驗證無橫向溢位）。
- Full smoke 首輪：364 tests 中 360 passed、4 個未修改的既有 cases 因 UI feedback / multi-page timeout 失敗；`npx playwright test --last-failed` 重跑 4/4 passed。失敗不涉及本輪 Dashboard files，Builder 未擴 scope 修改既有 specs 或 config。
