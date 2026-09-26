# 09: 總覽補「被選定、待建課」項目（決策 7 ②）

**What to build:** 先查證現有資料與流程能否判斷「老師的回應被團主選定，但還沒建立課程」。可以的話，加進總覽「待你處理」並排在待審報名之後；查不到就不做，並回報原因與替代方案。

**Blocked by:** 08

**Status:** done（2026-09-26）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 需先確認建課是由團主或老師執行（現行 `createClassSessionForOrganizer` 為團主建課），若建課者是團主，這項對老師其實是「等待」而非「待處理」，文案要據實；不改狀態機

**實作紀錄：** 查證結論：做得到。團主選定老師後需求狀態是 `matched`，建立課程後變 `converted_to_class`；建課的是團主（`createClassSessionForOrganizer`），所以對老師是「等待中」不是待辦。新增只讀自己回應的 `listOwnSelectedResponsesAwaitingClass`（`DemandResponse.status = selected` 且需求仍是 `matched`），在「待你處理」以黃色「等待團主建立課程」顯示，連到該需求頁（既有頁面已允許老師查看自己回應過的需求）。

**Source:** `docs/teacher-usability-plan.md`

- [x] 先寫出查證結論（能否判斷、由誰建課），再決定做或不做
- [x] 若做：文案符合實際責任方，連結正確，有情境測試
- [x] 若不做：在計畫文件與 backlog 記錄原因
