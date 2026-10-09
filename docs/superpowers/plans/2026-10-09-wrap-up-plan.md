# 收尾任務清單（2026-10-09）

產品主人 2026-10-09 決定：範圍為「收尾」，期班（老師排課票 07–13）、團主 15b、email 通知連結維持延後（見 `docs/backlog.md` 第 20 項）。每項測試通過後可自行 commit＋push；測試失敗、需動 schema／migration、刪資料或要改產品行為時停下來問。

## 清單

- [ ] 1. 學員流程票 06：短路徑驗收（`member-journey-acceptance.spec.ts`、`class-direct-sign-in.spec.ts`，desktop＋mobile，`PORT=3100`），通過後更新票 06 與 ticket-breakdown，commit＋push。
- [ ] 2. 學員易用性票 02 未達成項（手機第一屏）：先查票 08（公開 header 手機精簡，2026-09-27 done）是否已解決；用 390px 寬度實測課程詳情頁，已解決就更新票 02 狀態，未解決再評估最小修正。
- [x] 3. 畫面驗收包：整理待產品主人看畫面的票（admin-usability 01–10、admin-usability-redesign 01–04、老師排課 01–06），每張列出要看的頁面、怎麼進去、看什麼重點，附截圖，做成一份讓產品主人一次看完的清單。
- [x] 4. 狀態標籤整理：過時的 spec／plan 狀態（例如 `teacher-usability-redesign-spec.md` 仍寫 awaiting-shared-understanding）改成實際狀態；團主易用性票 11 標註 email 部分移到 backlog 第 20 項。2026-07／08 舊 plan 由另一個 session 處理，不重複修改。
- [x] 5. 最終回報：完成項、仍延後項、等產品主人看畫面的項目。

## 進度紀錄

（每完成一項補一行）

- 2：部分完成（2026-10-09 Codex review 更正）。票 08 讓手機第一屏露出標題、狀態、名額、報名鈕與「時間或地點」，但票 02 原要求還包括老師（以及時間與地點都要），這部分沒有驗證；票 02 改回「部分改善」，並放回 backlog 第 20 項待產品主人決定是否接受。
- 4：完成。teacher-usability-redesign spec／plan、teacher-class-scheduling spec、admin／organizer redesign plan、團主易用性票 11 補上「2026-10-09 實際狀態」。
- 3（部分）：admin-usability-redesign 01–04 的 README 早已記錄 2026-10-04 畫面驗收通過，只同步各票 Status；舊版 admin-usability 01–10 已由第二輪改版取代，且票 14 整條路徑 2026-10-06 已驗收，各票補註不再單獨驗收。真正待看畫面的只剩老師排課 01–06，製作截圖包中。

- 1：部分完成（2026-10-09 Codex review 更正）。9 個 spec desktop＋mobile 136/138，2 項 `series-member-info` 在整套執行時失敗，單獨 16/16、repeat×3 48/48 通過。其中 desktop :264 存入值變成新舊文字相接，可能是頁面還沒準備好就輸入造成的真實問題，根因未查明，所以票 06 不標「自動化驗收通過」，改為「136/138，2 項失敗待查」，查原因記在 backlog 第 20 項。測試與文件仍已 commit `84d374c`（只是保存測試程式，不代表驗收通過）。
- 3：完成。老師排課 01–06 desktop／mobile 共 22 張截圖與驗收重點發布為私人頁面：https://claude.ai/artifact/1kut58HPAenJLBCMJMaYDg 。截圖用臨時 spec 與專屬 email 網域的示範資料產生，跑完已刪資料（殘留 0）與臨時 spec。另一個 session 寫了逐步操作版 `docs/visual-acceptance-checklist.md`，兩者可搭配看。
- 5：完成。仍等產品主人：學員 06 人工項目（真實 Google 首次建帳號、200% 文字、全程鍵盤）、票 02 手機第一屏是否接受、Resend 開通。之後已完成：老師排課 01–06 畫面驗收、團主 15b、寄信程式與 email 連結；期班 07–12 由另一個長任務完成。仍待查：`series-member-info` 整套執行時的失敗。

- 驗收：產品主人 2026-10-09 回覆「排課 01–06 都通過」，六票與 README、spec 狀態改為 accepted。

> Codex peer review：上午因用量上限先跳過，15:3x 補審，3 輪後 APPROVED（更正第 1、2 項為部分完成）。

<!-- codex-peer-reviewed: 2026-10-09T07:42:31Z rounds=3 verdict=approved -->
