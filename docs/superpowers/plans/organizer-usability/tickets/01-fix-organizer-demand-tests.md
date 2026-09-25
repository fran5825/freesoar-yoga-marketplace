# 01: 釐清並修復團主需求 smoke 測試失敗

**What to build:** 團主需求的 Playwright smoke 測試（`organizer-demand.spec`）能穩定通過，並留下正確的跑法紀錄，讓後面每張票有可信的測試基準。

**Blocked by:** None (can start immediately)

**Status:** done（2026-09-25，不需改程式碼）

**Workflow mode:** LIGHT

**Human Gate:** no

**Risk flags:** 無

**Source:** `docs/organizer-usability-plan.md`

**結論（推翻原假設）：**
原以為是測試 fixture 的「期望地點」格式過期，實際查證後 fixture 沒錯（資料庫欄位仍是字串陣列）。失敗原因是 Playwright 預設連到使用者開著的開發伺服器（`localhost:3000`，dev 模式有熱更新錯誤、送審按鈕點了沒反應），不是編譯後的正式版。改用獨立埠跑（`PORT=3100 npx playwright test ...`，會自動啟動編譯後的伺服器）後，`organizer-demand.spec` 桌機與手機 14 支全過。

- [x] 找出 `organizer-demand.spec` 失敗的真正原因
- [x] `PORT=3100` 重跑，14 支全部通過
- [x] 不修改產品程式碼與 fixture
- [x] 在 `docs/backlog.md` 「小提醒」記下跑測試前的注意事項，並更正 1b／1c 的說明
