# 11: 找老師流程的明確下一步

**What to build:** 團主可由真實老師回應知道何時要選老師，送審、選老師與成立課程後都能直達該筆下一步。

**Blocked by:** None (can start immediately)

**Status:** done（2026-10-05）

**Workflow mode:** STANDARD

**Human Gate:** no（僅限本票列明的低風險範圍。）

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK

- [x] published 需求依真實有效 response count 推導待選老師；列表／總覽／詳情文案一致，不新增 teacher_responded persist transition。
- [x] 零回應、已有回應、已選老師、已成立課程分別顯示下一個 actor／主動作；不把等待顯示成待我處理。
- [x] 需求成立課程後連到確切 ClassSession，課程可回到來源需求；不能一律連列表或留在鎖住的新表單。
- [x] 需求轉課預填可確定的已存欄位；頻率／偏好時段不能猜成正式開始時間或整期安排。
- [x] 移除公開設定已失效的『未來功能』說明，依既有 isPublic 行為提供準確提示，不變更公開／報名權限。
- [x] 測試既有需求各狀態及有效回應、單筆關聯連結與預填，手機閱讀／鍵盤操作清楚；確認未改 schema、Auth 或 state／permission guards。
- [x] 若需改高風險邊界才能完成，停止回報並升級切片；不順帶修全站其他角色。

## 進度紀錄

- 2026-10-05 範圍：只動團主端需求列表／總覽／詳情、建立課程表單與團主課程詳情；不改 schema、Auth、狀態機或權限。
- 有效回應數＝`DemandResponse.status = submitted` 且老師 `approved`（與選師 guard 一致，暫停老師的回應不算），由 `getOwnDemandRequestList`／`getOwnDemandRequestDetail` 以 Prisma `_count` 衍生，回傳 `OwnDemandRequestSummary`（另含 `classSessionId`）。published 有可選回應才是「下一步」，否則維持「目前進度」；列表、總覽、詳情都傳同一個數字給 `getDemandNextStep`。
- 詳情「下一步」動作：有回應跳 `#responses`、已媒合跳 `#create-class`、已成課／已完成連 `/organizer/classes/[classSessionId]`；團主課程詳情對 organizer_matched 顯示「查看來源需求」。
- 預填由 `src/domain/demand-request/class-prefill.ts` 決定：地點只有一項時帶入、預計人數在 1–500 才帶入名額、說明直接帶入；開始／結束時間不帶入，偏好日期／時段／頻率／堂長只顯示成參考文字。
- isPublic 文案改為「同時公開在課程列表」＋準確說明（開放報名時才出現在公開列表），送出行為不變。
- 驗證：tsc、eslint、build 通過；新增 `tests/smoke/organizer-demand-next-steps.spec.ts`，與相關 smoke 共 150 個測試（桌機＋手機）通過。

<!-- codex-peer-reviewed: 2026-10-05T08:08:08Z rounds=2 verdict=approved -->
