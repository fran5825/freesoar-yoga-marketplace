# Codex Self Review Checklist

## 目的

本 checklist 是 Codex 每次修改 docs 或 code 後的第一層自我審查。

它不是最終產品決策；任何影響 Auth、Prisma schema、role / permission model、state machine、V1 scope、核心 user flow 的決策，都需要產品主人確認。

## Docs Consistency Review Checklist

- 修改是否符合「檔名英文、內容繁中」規則？
- 是否與 `PRD.md`、`route-map.md`、flow specs 一致？
- 是否與 `data-model.md`、`permissions-matrix.md`、`state-machines.md` 一致？
- 是否有重複、矛盾、命名不一致或欄位不一致？
- 是否有更新相關文件，而不是只改單一文件造成斷裂？

## Code Implementation Review Checklist

- 是否只修改本次任務需要的檔案？
- business logic 是否避免放在 page component？
- permission logic 是否放在可重用的 domain / service layer？
- state transition 是否集中處理？
- data access 是否有清楚邊界？
- 是否沒有加入未要求的功能？

## V1 Scope Review Checklist

- 是否仍是瑜伽團課 marketplace V1？
- 是否沒有加入 Wellness / Academy / Retreat 完整模組？
- 是否沒有加入 advanced AI matching？
- 是否沒有加入複雜金流或 refund automation？
- 是否沒有加入 Native app？
- 是否沒有擴張成 Teacher SaaS、CRM、enterprise platform？

## Security Review Checklist

- Auth、session、admin permission 是否受影響？
- role / permission model 是否仍符合文件？
- 是否避免暴露 private organizer、teacher、member data？
- Admin route 是否仍需 admin-only？
- 表單是否需要 server-side validation？
- 是否沒有提交 secret 或 `.env`？

## Marketplace Logic Review Checklist

- Teacher approval 是否仍是回應 demand 的前置條件？
- Demand visibility 是否仍需 Admin review / publish？
- DemandResponse 是否仍限制 V1 一個 selected response？
- ClassSession 是否仍只由 matched DemandRequest 轉成？
- Enrollment 是否只由 Member capability 建立？
- capacity、duplicate enrollment、cancelled class 是否有被考慮？

## Brand Review Checklist

- 語氣是否溫柔、清楚、可信任？
- 是否避免低價搶課、競標感、焦慮式行銷？
- 是否避免恐懼式 urgency、強迫稀缺感、hard-sell CTA 或過度轉化導向？
- 是否維持 low-pressure UX：清楚、安定、低摩擦、不壓迫？
- 是否尊重老師，不把老師商品化？
- 是否符合 Free Soar 的自由、覺醒、成長、身心整合、共創社群？

## RWD Review Checklist

- 是否維持 mobile-first？
- 表單與 CTA 在手機上是否可用？
- dashboard 是否至少保留 tablet / desktop 可用性？
- 是否避免表格或資訊密度在小螢幕失控？

## Git / Commit Safety Checklist

- 是否確認修改檔案清單？
- 是否沒有改到不相關檔案？
- 是否沒有覆蓋或刪除既有 docs？
- 是否沒有自動 commit？
- 是否沒有自動 push？
- 若有生成檔，是否清楚回報？

## Product Owner Judgment Checklist

Codex 發現問題時，必須分類：

- Must fix now：不修會造成 V1 實作錯誤、資料模型錯誤、權限錯誤或 scope drift。
- Can defer：未來會遇到，但 V1 可以先簡化。
- AI overthinking / not needed for V1：合理提醒，但現在不應擴大 scope。
- Product owner decision required：牽涉產品方向、權限模型、核心流程、Auth、Prisma schema、state machine 或 V1 scope。

Codex 應提出建議，但不能替產品主人做最終產品決策。
