# Account Dashboard Navigation Plan

## 狀態

IMPLEMENTED — 2026-08-01

## 目標

在既有 `/account` authenticated entry 提供清楚、低壓力的 Member 與 Organizer workspace 入口，讓已登入使用者能找到已落地的 `/member/dashboard` 與 `/organizer/dashboard`。

## 產品主人已核准決策

- 採用 Option A：保留 `/account` 的基本帳號資訊，新增兩個靜態 workspace links。
- Member 入口導向 `/member/dashboard`。
- Organizer 入口導向 `/organizer/dashboard`；尚未建立 `OrganizerProfile` 時，由目標 route 顯示 bootstrap CTA。
- 本 slice 不把 `/account` 擴張成完整四角色 launcher 或正式會員中心。

## Allowed Files

- `src/app/account/page.tsx`
- `tests/smoke/account-dashboard-navigation.spec.ts`
- `docs/engineering/auth-entry-strategy.md`
- `docs/product/route-map.md`
- `docs/superpowers/plans/2026-08-01-account-dashboard-navigation-plan.md`

## 明確不做

- 不改 `/sign-in` redirect。
- 不改 Auth、domain、Prisma schema、permission 或 marketplace state machine。
- 不在 `/account` 查詢 `TeacherProfile` 或 `OrganizerProfile`。
- 不加入 Teacher／Admin workspace links。
- 不建立 shared header、global navigation 或新的 package/config。
- 不更動 Member／Organizer Dashboard 本身。

## UI 與內容

- 新增「我的使用入口」區塊。
- 提供「會員總覽」與「團主總覽」兩張可點擊卡片，附上簡短用途說明。
- 採 mobile-first 單欄、較寬畫面雙欄的 layout，維持 gentle、clear、spacious 的品牌語氣。

## 測試與驗證

- 未登入使用者進入 `/account` 仍導向 `/sign-in`。
- 已登入使用者看得到兩個入口與正確 href。
- 實際點擊後分別抵達 Member Dashboard 與 Organizer bootstrap state。
- 360px viewport 無水平 overflow。
- 執行 lint、build、targeted smoke、full smoke 與 `git diff --check`。

## 驗證結果

- `npm run lint`：通過。
- `npm run build`：通過。
- Account、Member、Organizer Dashboard targeted smoke：22/22 通過（desktop + mobile）。
- `npm run test:smoke`：執行 10 分鐘後由工具 timeout 終止，未回傳失敗案例，因此記為未完成而非通過。
- `git diff --check`：通過。

## Rollback

移除 `/account` 的「我的使用入口」區塊、新增 smoke spec，並回復本輪兩份 route/auth 文件說明；無資料 migration 或外部狀態需要回復。
