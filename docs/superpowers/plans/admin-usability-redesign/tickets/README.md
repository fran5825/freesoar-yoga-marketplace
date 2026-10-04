# 管理後台第二輪票券

產品主人已確認四票粒度與依賴，並授權在現有 task 執行第一批。完整規格與第一批 Builder prompt 仍是實作範圍依據；這份票單不增加新能力。

來源：[完整規格](../../../../specs/admin-usability-redesign-spec.md)／[四批計畫](../../2026-10-03-admin-usability-redesign-plan.md)。第二批是 2026-10-04 另行確認的 05–08；切票確認不等於第二批 Builder 放行。

## 第一批：共用列表、查找與返回

| 票 | 完整流程 | Blocked by | Mode | Human Gate | Status |
| --- | --- | --- | --- | --- | --- |
| [01](01-teacher-search-and-return.md) | 老師查找、詳情與操作後返回 | None | STANDARD | yes，範圍已核准 | 已實作，2026-10-04 畫面驗收通過 |
| [02](02-demand-search-and-status.md) | 需求查找、完整分類與返回 | 01 | STANDARD | yes，範圍已核准 | 已實作，2026-10-04 畫面驗收通過 |
| [03](03-class-search-and-return.md) | 課程查找、排序與取消後返回 | 01 | STANDARD | yes，範圍已核准 | 已實作，2026-10-04 畫面驗收通過 |
| [04](04-organization-search.md) | 團體查找與聯絡資料 | 01 | STANDARD | yes，範圍已核准 | 已實作，2026-10-04 畫面驗收通過 |

02–04 彼此沒有技術阻擋，實際仍依序施工，避免同時修改共用元件。四票完成測試與 desktop／mobile 檢查後停在第一批畫面驗收；產品主人看過後才能進第二批。

工程勾選代表程式與測試符合條件，不代表產品主人已驗收。四列表 desktop／390px mobile、返回安全、狀態與取消回歸已驗證；第一輪 smoke 86/88，更新兩項舊返回網址斷言後相關六項重跑全數通過。typecheck、lint、build、diff check 均通過。

## 第二批：審核閱讀、表單與操作回饋

2026-10-04 產品主人回覆「1」，確認下列四票粒度與依賴，授權在現有 task 建立 draft tickets 與更新計畫；本輪未授權實作。同日產品主人回覆「第一批通過，開始做 05」放行第二批 Builder；四票依 05 → 06 → 07 → 08 完成，2026-10-05 產品主人回覆「第二批畫面看過了，通過」。所有票均為 STANDARD，無 HEAVY 票；共同 risk flags 為 BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

| 票 | 完整流程 | Blocked by | Mode | Human Gate | Status |
| --- | --- | --- | --- | --- | --- |
| [05](05-teacher-review-and-feedback.md) | 老師先閱讀再通過／退回，失敗保留原因與可重試回饋 | None | STANDARD | yes，已放行 | 已實作，2026-10-05 畫面驗收通過 |
| [06](06-demand-review-and-feedback.md) | 需求先閱讀再公開／退回，正確另建需求文案與失敗回饋 | 05 | STANDARD | yes，已放行 | 已實作，2026-10-05 畫面驗收通過 |
| [07](07-teacher-suspension-and-restoration.md) | 暫停原因與對象確認、一鍵恢復及結果追查 | 05 | STANDARD | yes，已放行 | 已實作，2026-10-05 畫面驗收通過 |
| [08](08-class-and-enrollment-cancellation-feedback.md) | 課程／學員對象確認、取消後果及處理中／失敗回饋 | None | STANDARD | yes，已放行 | 已實作，2026-10-05 畫面驗收通過 |

### 依賴與執行順序

05 的完整老師審核流程同時驗證共用表單／回饋模式，06 與 07 才能沿用；06、07 彼此不阻擋。08 使用第一批返回機制與既有確認元件，可獨立完成；不能為施工順序額外加上 07 → 08 的技術依賴。為避免共享元件衝突，實際依 05 → 06 → 07 → 08 逐票施工；共用元件後續修改須回歸已完成的呼叫者。

### 共同開工與完成邊界

- 第一批畫面驗收／第二批 Builder 放行仍須有產品主人紀錄（已完成：2026-10-04 產品主人回覆「第一批通過，開始做 05」）。切票確認本身不回填未發生的驗收或授權。
- Builder 開始前須核對當前 checkout、完整規格、四批計畫與 gate。工作樹有其他 task 的修改；分辨自己的變更，不覆蓋、reset 或清除其他 task 的工作。
- 每票均包含 UI、既有 action 的回饋整合與必要測試，不把測試／手機檢查延後到第四批。沿用現有 typecheck、lint、build、diff check，build 後在 3100 執行受影響 admin smoke，檢查 desktop 1280px／mobile 390px。
- 只改既有 admin 閱讀、表單、pending／錯誤與確認回饋；既有 service、server-side guard、原因驗證、取消資格與狀態轉換不變。原因不進 URL，不新增持久化草稿。
- 不改 Auth、schema、permissions、state machine、package/env/deploy 或通知能力；不做 backlog 17 的管理員指派／權限配置。若需越過邊界，另提影響與產品主人確認。
- 第二批完成後交產品主人看畫面，不自動啟動第三批，不 commit／push／部署。draft 與工程勾選均不是畫面驗收。
