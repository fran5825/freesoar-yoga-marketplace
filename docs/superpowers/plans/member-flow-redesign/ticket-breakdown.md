# 學員流程第二輪：票券總覽

來源：`docs/member-flow-redesign-plan.md`（Q1–Q14 已確認）。建立日期：2026-10-04。舊票 `docs/superpowers/plans/member-usability/tickets/` 保留作為歷史，不覆寫。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 01 | [背景預先載入不再改寫上次身分](tickets/01-fix-last-role-prefetch.md) | HEAVY | yes | – | 已實作驗證，待 review（未 commit） |
| 02 | [第一批 review 與結案](tickets/02-batch-one-review-and-close.md) | STANDARD | no | 01 | 驗收完成（第一批 22 檔未 commit） |
| 03 | [單堂課的適合對象與準備事項](tickets/03-single-class-suitable-for-and-preparation.md) | HEAVY | yes | – | draft |
| 04 | [系列課（每週固定與指定日期）沿用課程資訊](tickets/04-recurring-series-class-info.md) | HEAVY | yes | 03 | draft |
| 05 | [從課程直接 Google 登入](tickets/05-direct-google-sign-in-from-class.md) | HEAVY | yes | – | 已實作、自動化通過；真實 Google 登入待手動驗收（未 commit） |
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

## 與老師排課計畫的銜接（2026-10-04，產品主人選 A）

另一項工作的 `docs/specs/teacher-class-scheduling-spec.md`、`docs/adr/0005-term-class-series-enrollment.md` 與 `docs/superpowers/plans/teacher-class-scheduling/tickets/` 新增期班、整期報名、改課與系列公開設定。決定如下：

- 適合對象／準備事項屬於「內容類欄位」，建立後可改，規則同課程介紹（隨時可改、不通知）。責任以「後做的一方補齊」為準：老師排課票 04（單堂改課）／05（系列改課）先做，則本計畫票 03／04 要在既有改課路徑補上這兩段；本計畫先做，則由那兩張改課票補上。各票已寫條件式驗收。這修訂了 Q11「只支援建立時填寫」的長期限制；兩張改課票已加跨計畫註記。
- 系列公開設定交給老師排課票 06；票 04 不再把「系列一律不公開」當成要維持的規則。
- 期班、整期報名與期班卡片由老師排課票 07～12 實作、票 13 驗收；不在本計畫，票 06 已註明。
- 建立／追加場次的路徑以後做的一方為準：票 04 若晚於老師排課票 07（期班建立）、11（追加補課），要覆蓋那些路徑；反之由那些票沿用系列上的值。

Schema 與 migration 的先後規則：

- 兩條計畫都是 additive 欄位，彼此不依賴；但同一時間只做一張 schema 票，不同時產生 migration、不同時跑共用 DB fixtures。
- 每張 schema 票開工前先取最新 main，再產生 migration；若別的計畫剛合併 schema 變更，重新產生而不是手動合併 migration 檔。
- 建議順序：先做本計畫票 03 → 04（只加 2×2 個 nullable 欄位，範圍小），再做老師排課的 schema 票；實際順序仍由產品主人逐票放行。

## 不放進任何票的事項

- 公開詳情可讀 `confirmed`、登入學員詳情不可讀的差異：獨立待驗證／待決，需另外提出 scope 與產品決策。
- 整期報名、取消後重報、付款、公開老師介紹：不在本輪。


<!-- review note: member-flow × teacher-scheduling reconciliation, reviewed as one unit with member-flow-redesign/ticket-breakdown.md -->
<!-- codex-peer-reviewed: 2026-10-04T13:42:57Z rounds=2 verdict=approved -->
