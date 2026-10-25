# 05: 整合驗證、文件與畫面驗收

來源：[spec](../../../../specs/wrong-route-fixes-spec.md)。

**What to build:** 01–04 合在一起後跑完整驗證，更新文件與 backlog，整理畫面驗收清單並記錄產品主人驗收結果。

**Blocked by:** 01、02、03、04

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no（畫面驗收本身是 feature-loop 的產品主人關卡）

**Risk flags:** 無

- [x] tsc、lint、build 通過；受影響的 smoke 與完整 smoke 跑過，失敗逐一分類（新問題或 backlog 第 27 項的既有問題）
- [x] backlog 第 25 項三個重複提示、第 26 項打勾
- [x] 畫面驗收清單（畫面、預期結果、需要的帳號身分與測試資料）
- [ ] 產品主人畫面驗收紀錄

## 畫面驗收清單

前提：分支合併進 main，開發資料庫 `freesoar_yoga_marketplace_dev` 跑過 migration `20261025120000_notification_role_targets`（只新增 enum 值），開發伺服器 3000 由產品主人啟動。帳號見 `docs/harness/visual-acceptance-runbook.md`：pattern178（老師＋團主）、tks83u（學員＋團主）、fran.zheng（管理員）。測試資料名稱都帶「驗收測試」。

| # | 畫面 | 怎麼觸發 | 預期結果 | 帳號與資料 |
| --- | --- | --- | --- | --- |
| 1 | tks83u 的「我的通知」：課程異動 | tks83u 報名 pattern178 的一堂單堂課；pattern178 改這堂的時間 | 通知連到 `/classes/<id>`（學員課程頁），不是團主的課程頁；點進去看得到新時間 | pattern178 一堂開放中的單堂（驗收測試）；tks83u |
| 2 | tks83u 的「我的通知」：課程取消 | pattern178 取消第 1 項那堂 | 連到「我的報名」 | 同上 |
| 3 | pattern178 的「我的通知」：自己取消單堂 | 同第 2 項 | 連到老師端那堂課 `/teacher/classes/<id>`，不是團主頁 | 同上 |
| 4 | 報名待審核（雙方） | pattern178 開一堂「需要審核」的單堂，tks83u 報名 | tks83u：連學員課程頁、看得到「待確認」；pattern178：連老師端那堂課 | pattern178 一堂需審核的單堂 |
| 5 | 團主送審確認區（04c） | tks83u 新增一筆需求，按上方「送出審核」，再按「先回來調整」，改按下方的 | 確認區只出現一塊，在按下的那組按鈕旁 | tks83u 一筆完整的需求草稿 |
| 6 | 管理員通知（需求送審） | 第 5 項真的送出 | fran.zheng 的通知連到 `/admin/demands/<id>`；tks83u 的那則連到自己的需求詳情 | 同上 |
| 7 | 老師申請頁導覽列（F12） | tks83u 打開 `/teachers/join` | 上方是「老師專區」，導覽列只有總覽、老師資料、通知 | tks83u（沒有老師資料） |
| 8 | 單堂開放報名訊息（04a） | pattern178 建一堂單堂（建立後直接開放） | 綠色訊息只寫「已開放報名。」，「把報名連結傳給學員」只在下方提示出現一次 | pattern178 |
| 9 | 系列頁收款提醒（04b） | pattern178 打開一個還有草稿場次的系列 | 收款提醒只有一塊，在「還有 N 場草稿沒開放報名」區塊裡 | pattern178 一個有草稿場次的系列；收款資訊要先清空才會出現提醒（記下原值、驗完填回） |

未列入畫面驗收（已由自動測試涵蓋或無法在畫面看）：email 連結（開發環境不寄信）、需求被選定或取消時給老師的通知（要走完整媒合流程）、老師申請送出給管理員（需要一個新的申請帳號）。

## 進度紀錄

- 2026-10-25 整合驗證（`wrong-route-fixes`，測試庫 `freesoar_wrf_a`，埠 3310）：tsc、lint、build 通過。完整 smoke：1591 過、33 skip（含 backlog 第 27 項的 `test.fixme`）、2 失敗；失敗是 `admin-class-session-management.spec.ts` 同一支測試的兩種螢幕尺寸，斷言收件人「不帶 target」已過時，改成檢查三種 target 後 26/26 過。不是新 bug。
- 2026-10-25 審查：內建 code-review 6 項、spec-review（規則、spec）各一份。已修：通知規格文件、signed-in-navigation 決策 2、route-map、spec 補 email 規則與「舊通知點進去可能 not-found」；smoke 補團主「需求取消」、老師「選定老師」、點進去看得到頁面。沒修（記給產品主人）：email 系列連結查詢可以合併成一次（效能，量小）、沒有機制防止之後新增通知忘了帶 target、需求送審／老師申請送出／補課沒有 smoke。

<!-- codex-peer-reviewed: 2026-10-25T01:42:34Z rounds=2 verdict=approved -->
