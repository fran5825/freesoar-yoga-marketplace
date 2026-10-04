# 11: 找老師流程的明確下一步

**What to build:** 團主可由真實老師回應知道何時要選老師，送審、選老師與成立課程後都能直達該筆下一步。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no（僅限本票列明的低風險範圍。）

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK

- [ ] published 需求依真實有效 response count 推導待選老師；列表／總覽／詳情文案一致，不新增 teacher_responded persist transition。
- [ ] 零回應、已有回應、已選老師、已成立課程分別顯示下一個 actor／主動作；不把等待顯示成待我處理。
- [ ] 需求成立課程後連到確切 ClassSession，課程可回到來源需求；不能一律連列表或留在鎖住的新表單。
- [ ] 需求轉課預填可確定的已存欄位；頻率／偏好時段不能猜成正式開始時間或整期安排。
- [ ] 移除公開設定已失效的『未來功能』說明，依既有 isPublic 行為提供準確提示，不變更公開／報名權限。
- [ ] 測試既有需求各狀態及有效回應、單筆關聯連結與預填，手機閱讀／鍵盤操作清楚；確認未改 schema、Auth 或 state／permission guards。
- [ ] 若需改高風險邊界才能完成，停止回報並升級切片；不順帶修全站其他角色。

