# 我的行事曆（第一階段）：票券總覽

來源：[spec](../../../specs/teacher-my-calendar-spec.md)、[ADR 0009](../../../adr/0009-teacher-google-calendar-connection.md)。建立日期：2026-10-11。產品主人已核准拆法與四項預設（月曆不分頁、系列逐場顯示、電腦版「還有 N 筆」、與系列卡錯開施工）。

第一階段不改 Prisma schema、不碰 Google、不改 state machine 與權限，因此沒有 HEAVY 票。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 01 | 清單／月曆切換，月曆顯示自己的課 | STANDARD | no | – | 部分完成：查詢、純函式、元件；待接頁面 |
| 02 | 可授課時間淡色底與當日時段 | STANDARD | no | 01 | 部分完成：計算與元件；待畫面驗收 |
| 03 | 合作邀請顯示在月曆 | STANDARD | no | 01 | 部分完成：查詢與標籤；待畫面驗收 |
| 04 | 從月曆點進單堂頁再回到同月同日 | STANDARD | no | 01 | 待開始 |
| 05 | 驗收與文件同步 | STANDARD | no | 02、03、04 | 待開始 |

```text
01 ──> 02 ──┐
01 ──> 03 ──┼──> 05
01 ──> 04 ──┘
```

## 施工前提

- `inline-enroll-rollup` 工作階段（就地報名＋系列卡）正在修改 `/teacher/classes` 清單頁、單堂頁、系列頁、編輯相關的 action 與 schema。票 01 與 04 會改到同樣的檔案，要等那批合併進 main 之後再接到頁面上，或只先做不重疊的新檔案（domain 查詢、純函式、月曆元件）。

## 進度紀錄

- 2026-10-11：產品主人選擇「先做不重疊的部分」。已完成新檔案：`src/domain/teacher-calendar/`（月份、每日項目、可授課時間、按月只查本人的查詢）、`_lib/calendar-view.ts`、`_lib/calendar-params.ts`、`_components/TeacherMonthCalendar.tsx`，以及單元測試 `tests/smoke/teacher-calendar-domain.spec.ts`（7 項通過）。月曆課程連結已帶 `from=calendar&month&day`，單堂頁要到票 04 才會讀取。
- 待 `inline-enroll-rollup` 合併後：在清單頁加「清單／月曆」切換並接上元件（票 01）、返回月曆（票 04），再做畫面與 E2E 驗收（票 01–03、05）。

## 共同規則

- 日期一律用台灣當地日期計算；月曆從星期日開始。
- 只讀本人資料、按月份查詢；頁面元件不放商業邏輯。
- 每個畫面跑 375px 橫向溢出檢查；電腦版與手機版各驗一次。
- 測試用獨立埠（3100 起）；改動只 commit 自己的檔案，push 前重查 `origin/main..main`。
