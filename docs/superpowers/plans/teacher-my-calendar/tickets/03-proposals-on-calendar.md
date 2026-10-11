# 03: 合作邀請顯示在月曆

來源：[spec 2.2、2.2.2、2.5](../../../../specs/teacher-my-calendar-spec.md)。

**What to build:** 團主寄給老師的合作邀請出現在月曆上：等老師回覆的標「待你確認」，老師已確認但團主還沒開課的標「已確認，等團主開課」。點下去進合作邀請頁。已經轉成課程的邀請不重複顯示，只顯示課程本身。

**Blocked by:** 01

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 新增按月、只查本人的邀請查詢；範圍要和老師總覽一致（團主就是自己的邀請不列、草稿不給老師看）。

- [x] 只查寄給本人、狀態為 `pending_confirmation` 或 `confirmed`、日期和月份重疊的邀請；團主是自己的不列；沒有日期的不顯示
- [x] 兩種標籤與各自的樣式（電腦版文字、手機版色點）
- [x] 點擊進合作邀請頁
- [x] 單元測試：狀態篩選（`converted`／`declined`／`withdrawn`／`draft` 不出現）；畫面驗兩種標籤
