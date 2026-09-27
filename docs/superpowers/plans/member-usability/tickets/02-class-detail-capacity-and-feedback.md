# 02: 課程詳情：名額、狀態與報名成功回饋（決策 2、3、8、11、12）

**What to build:** 學員打開課程詳情，一屏內看到時間、地點、老師、剩餘名額、狀態標籤與報名鈕。按下報名後留在同一頁，頂部出現成功橫幅，按鈕變成狀態標籤並附「查看我的報名」連結。需老師確認的報名，明確顯示「已送出，老師確認後會通知你」。未登入訪客登入後回到原頁，仍要自己按一次「報名」。

**Blocked by:** 01

**Status:** 大致完成，一項驗收未達成（2026-09-26）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（不動 schema；剩餘名額以現有 enrollment 規則計算，動工前先查證 pending 是否佔名額）

**Source:** `docs/member-usability-plan.md`

- [x] 詳情頁顯示剩餘名額與狀態標籤（開放報名／額滿／已開始），不顯示價格
- [x] 報名成功後同頁顯示成功橫幅與「查看我的報名」連結
- [x] 需審核的報名顯示「老師確認後會通知你」的下一步文字
- [x] 未登入按報名 → 登入 → 回原頁，不會自動送出報名
- [ ] 手機一屏內看得到關鍵資訊與報名鈕；相關 smoke 測試通過

**實作紀錄：** 新增 `getClassAvailability`（`src/domain/class-session/availability.ts`，純函式；規則沿用 Gate G3 = A：pending＋confirmed 都佔名額）與共用元件 `ClassAvailabilityBadge`（票 04 的列表可重用）；`getClassSessionForMember`、`getPublicClassSessionDetail` 多回傳 `activeEnrollmentCount`（只多一個計數查詢，不動 schema）。詳情頁：標題下顯示狀態與剩餘名額、「我要報名」跳到報名表單；成功橫幅補「查看我的報名」；待確認文案改為「確認結果會顯示在「通知」」（不提 email，因為尚未寄信）；額滿時以說明取代報名表單；訪客版額滿或已開始時，按鈕改為「看看其他課程」。未登入登入後回原頁仍需自己按報名（沿用既有 callbackUrl，未自動送出）。拿掉英文小字「Class」。驗證：build 通過；`enrollment.spec`（含新增名額測試）、`member-dashboard`、`public-classes-discovery`、`teacher-initiated-open-classes` 桌機＋手機全過。
**未達成：** 「手機一屏內看得到關鍵資訊與報名鈕」。實測手機第一屏被公開 header（品牌、四個連結、登入資訊、登出、我的專區）佔掉約 470px，第一屏只看到標題、狀態、剩餘名額與「我要報名」，時間、地點、老師要往下捲。這要改公開 header（`public-header.tsx`，首頁等公開頁共用），已超出這張票與「只碰自己檔案」的範圍，需另案決定。
