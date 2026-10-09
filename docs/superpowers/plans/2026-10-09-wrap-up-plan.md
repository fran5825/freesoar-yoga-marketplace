# 收尾任務清單（2026-10-09）

產品主人 2026-10-09 決定：範圍為「收尾」，期班（老師排課票 07–13）、團主 15b、email 通知連結維持延後（見 `docs/backlog.md` 第 20 項）。每項測試通過後可自行 commit＋push；測試失敗、需動 schema／migration、刪資料或要改產品行為時停下來問。

## 清單

- [ ] 1. 學員流程票 06：短路徑驗收（`member-journey-acceptance.spec.ts`、`class-direct-sign-in.spec.ts`，desktop＋mobile，`PORT=3100`），通過後更新票 06 與 ticket-breakdown，commit＋push。
- [ ] 2. 學員易用性票 02 未達成項（手機第一屏）：先查票 08（公開 header 手機精簡，2026-09-27 done）是否已解決；用 390px 寬度實測課程詳情頁，已解決就更新票 02 狀態，未解決再評估最小修正。
- [ ] 3. 畫面驗收包：整理待產品主人看畫面的票（admin-usability 01–10、admin-usability-redesign 01–04、老師排課 01–06），每張列出要看的頁面、怎麼進去、看什麼重點，附截圖，做成一份讓產品主人一次看完的清單。
- [ ] 4. 狀態標籤整理：過時的 spec／plan 狀態（例如 `teacher-usability-redesign-spec.md` 仍寫 awaiting-shared-understanding）改成實際狀態；團主易用性票 11 標註 email 部分移到 backlog 第 20 項。2026-07／08 舊 plan 由另一個 session 處理，不重複修改。
- [ ] 5. 最終回報：完成項、仍延後項、等產品主人看畫面的項目。

## 進度紀錄

（每完成一項補一行）

- 2：完成。票 08 已於 2026-09-27 解決票 02 的手機第一屏項目，只是票 02 狀態沒更新；已更新票 02，並從 backlog 第 20 項移除誤列的這一條。
- 4：完成。teacher-usability-redesign spec／plan、teacher-class-scheduling spec、admin／organizer redesign plan、團主易用性票 11 補上「2026-10-09 實際狀態」。
- 3（部分）：admin-usability-redesign 01–04 的 README 早已記錄 2026-10-04 畫面驗收通過，只同步各票 Status；舊版 admin-usability 01–10 已由第二輪改版取代，且票 14 整條路徑 2026-10-06 已驗收，各票補註不再單獨驗收。真正待看畫面的只剩老師排課 01–06，製作截圖包中。

> Codex peer review：2026-10-09 10:1x 因 Codex 用量上限（13:46 恢復）未執行；產品主人指示恢復前先跳過，恢復後補審。
