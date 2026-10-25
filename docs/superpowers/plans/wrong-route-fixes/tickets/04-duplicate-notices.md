# 04: 三個重複提示各留一個（backlog 第 25 項）

來源：[spec](../../../../specs/wrong-route-fixes-spec.md)「重複提示」。

**What to build:** 單堂課開放報名後「把報名連結傳給學員」只出現一次；系列管理頁收款提醒只有一塊；團主按「送出審核」後確認區只出現在按下的那組按鈕旁。

**Blocked by:** None (can start immediately)

**Status:** done

**Workflow mode:** LIGHT

**Human Gate:** no

**Risk flags:** 無

- [x] 單堂課開放報名成功訊息改成「已開放報名。」，下一步提示照舊
- [x] 系列管理頁只留「還有 N 場草稿沒開放報名」區塊裡的收款提醒
- [x] 團主需求表單：按上方送出 → 確認區在上方；按下方 → 在下方；只出現一塊
- [x] 既有測試裡寫死舊文案的地方一併更新
- [x] smoke 各斷言只出現一次

## 進度紀錄

- 2026-10-25：成功訊息改「已開放報名。」（`OPENED_FOR_ENROLLMENT_MESSAGE`，4 個 smoke 檔的舊文案一併更新）；系列頁拿掉場次清單上方的收款提醒（兩塊條件同為 `openableDrafts.length > 0`）；團主表單記住按的是上方或下方「送出審核」，確認區只出現在那一組旁，按「先回來調整」焦點回到原按鈕。smoke 斷言各只出現一次。tsc、lint、build、相關 smoke 通過。

<!-- codex-peer-reviewed: 2026-10-25T01:42:34Z rounds=2 verdict=approved -->
