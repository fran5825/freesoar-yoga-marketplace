# 04: 從月曆點進單堂頁再回到同月同日

來源：[spec 2.4](../../../../specs/teacher-my-calendar-spec.md)。

**What to build:** 老師從月曆點一堂課進單堂頁，不管中間有沒有做操作（確認報名、開放、取消等）或修改課程，最後按「← 回我的課程」都會回到原本那個月、那一天的月曆。清單在修改課程後會遺失返回資訊，這張票一起修好。

**Blocked by:** 01；改到單堂頁、編輯頁與 action，要等 `inline-enroll-rollup` 合併。

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 返回網址白名單（防止被導到外部網址，open redirect）；與 `inline-enroll-rollup` 同改單堂頁與 action。

- [ ] return-context 白名單加入月曆：只接受 `YYYY-MM` 與 `YYYY-MM-DD`，日期必須在該月份內，其他一律忽略
- [ ] 頁面網址與表單隱藏欄位共用同一套解析函式（取代 action 裡的另一份）
- [ ] 單堂頁「修改課程」連結、編輯頁返回連結、編輯表單、儲存後的導向都帶返回參數（清單也適用）
- [ ] 單元測試：白名單（壞月份、日期不在月份內、外部網址）
- [ ] E2E：月曆→單堂→操作→返回；月曆→單堂→修改→儲存→返回；清單→修改→返回原分頁
