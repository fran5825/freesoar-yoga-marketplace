# 學員流程第二輪：票券總覽

來源：`docs/member-flow-redesign-plan.md`（Q1–Q14 已確認）。建立日期：2026-10-04。舊票 `docs/superpowers/plans/member-usability/tickets/` 保留作為歷史，不覆寫。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 01 | [背景預先載入不再改寫上次身分](tickets/01-fix-last-role-prefetch.md) | HEAVY | yes | – | 已實作驗證，待 review（未 commit） |
| 02 | [第一批 review 與結案](tickets/02-batch-one-review-and-close.md) | STANDARD | no | 01 | 驗收完成（第一批 22 檔未 commit） |
| 03 | [單堂課的適合對象與準備事項](tickets/03-single-class-suitable-for-and-preparation.md) | HEAVY | yes | – | draft |
| 04 | [系列課（每週固定與指定日期）沿用課程資訊](tickets/04-recurring-series-class-info.md) | HEAVY | yes | 03 | draft |
| 05 | [從課程直接 Google 登入](tickets/05-direct-google-sign-in-from-class.md) | HEAVY | yes | – | draft |
| 06 | [完整學員旅程 usability 驗收](tickets/06-full-member-journey-acceptance.md) | STANDARD | no | 02、04、05 | draft |

需要產品主人親自放行的 HEAVY 票：01、03、04、05。

```text
01 ──> 02 ──┐
03 ──> 04 ──┼──> 06
05 ─────────┘
```

## 建議順序

1. 01（最小、已定位）→ 02（讓第一批結案）
2. 03 → 04（schema 相關，連續做）
3. 05
4. 06

03 和 05 之間沒有程式相依，但不要同時修改共用檔案（例如課程詳情頁），也不要同時跑共用 DB fixtures。

## 目前證據

- 第一批：`.ai-runs/member-flow-batch-one/`（diff、checks、截圖）。90 passed／2 failed，不是一次 92/92。
- 票 01 定位：`.ai-runs/member-flow-redesign-01/head-prefetch-diagnostic.log`。HEAD baseline 同一案例 6/6 通過；診斷顯示 HEAD 上也會因 `/member/*` prefetch 把上次身分改成學員，只是測試換頁比較快所以沒抓到。
- `.ai-runs/` 是本機證據，不進 git。
- 既有 open redirect：`sanitizeCallbackUrl` 放行 `/\evil.example/`，瀏覽器會解析成外站（Codex 審查發現、已驗證）。修正納入票 05，見該票。

## 待產品主人確認

- 2026-10-04 發現另一項工作新增（未 commit）的 `docs/adr/0005-term-class-series-enrollment.md` 與 backlog 第 18 項，記載產品主人已確認「期班／整期報名」。票 04 目前寫「保留逐場報名、不新增整期報名、系列場次 `isPublic = false`」，依據是本輪 Q9／Q11。開始票 04 前須先確認兩者如何銜接，不自行改票。

## 不放進任何票的事項

- 公開詳情可讀 `confirmed`、登入學員詳情不可讀的差異：獨立待驗證／待決，需另外提出 scope 與產品決策。
- 整期報名、取消後重報、付款、公開老師介紹：不在本輪。

<!-- codex-peer-reviewed: 2026-10-03T21:19:08Z rounds=3 verdict=approved -->
