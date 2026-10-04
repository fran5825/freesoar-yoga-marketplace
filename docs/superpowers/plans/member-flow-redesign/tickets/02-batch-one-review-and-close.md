# 02: 第一批找課／詳情／報名／總覽 review 與結案

**What to build:** 已實作的第一批（找課篩選、詳情先摘要與報名區、需老師確認預告、等待老師確認文案、總覽分區、整堂取消卡片出口）經過 diff review 與一次完整回歸，學員實際走過找課到報名都符合 `docs/member-flow-redesign-plan.md`「收斂後的共同理解」，並留下可追溯的驗收紀錄。

**Blocked by:** 01（角色返回案例修好後，相關 smoke 才可能一次全過）

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無新增；review 時須確認未動到 Auth、Prisma、write service、detail 可見條件。

**Source:** `docs/member-flow-redesign-plan.md` 第一批 Builder Prompt 與 Builder Review Packet。

## Implementation baseline／Evidence

- 實作已在主工作樹（未 commit），22 個檔案，清單見 `.ai-runs/member-flow-batch-one/changed-files.json`，完整 patch 見 `diff.patch`。
- 前一輪：tsc／lint／build 通過；92 案例分批重跑對帳為 90 passed／2 failed（失敗即票 01）。不是一次完整 92/92。
- 主工作樹同時有管理員後台等其他任務的未提交修改，不屬於本票。

## Acceptance criteria

- [x] diff review：只含第一批 22 檔；allowed／forbidden 範圍、own-scope、detail WHERE、consent／capacity／duplicate／cancel 斷言都保留
- [x] 在包含第一批＋票 01 修復的 build 上，一次執行 public-classes-discovery、class-discovery-filters、enrollment、enrollment-approval、member-dashboard、signed-in-navigation，desktop／mobile 全過（不靠分批對帳）
- [x] tsc、lint、build、`git diff --check` 通過
- [x] review 發現的問題在本票內修；超出第一批範圍的記到 `docs/backlog.md`
- [x] Builder Review Packet 補上本票結果；不重做已有 UI，不把其他任務的修改列入

## 驗收結果（2026-10-04）

**Status 補充：** 驗收完成，第一批可結案；第一批 22 檔仍未 commit，待產品主人決定。

驗證環境：獨立 worktree，main `85bba16`（含老師流程 12 個新 commit 與票 01）＋第一批 `diff.patch`。patch 乾淨套用，套用後 22 檔與主工作樹逐檔一致（忽略換行字元；比對於驗證開始時，之後 `docs/member-flow-redesign-plan.md` 另追加結案紀錄）。PORT=3200、production build。

- Diff review（未改任何檔案）：
  - `safeClassReturnPath` 只接受 `/classes`，並用解析後的篩選條件重新組出網址，不沿用輸入字串；票 05 那類正規化繞過對它無效。
  - `actions.ts` 只多傳返回路徑；報名／取消 service 呼叫不變。
  - 列表查詢新增條件都以 AND 疊在原公開條件上，只會縮小結果；詳情 WHERE 未改。
  - `canAcceptNewEnrollments` 用到老師狀態，但 DTO 回傳前移除，老師 status 不外流。
  - 同意勾選框預設未勾且 `required`；詳情頁 `returnTo` 先經 `safeClassReturnPath`。
- tsc、全專案 eslint、`next build` 通過。
- Smoke（上述 6 組＋role-switch＋teacher-initiated-open-classes，desktop／mobile）：
  - 第一次一次執行：118 passed／2 failed。`enrollment-approval.spec.ts:157` desktop 為 `page.goto` 30 秒逾時；`public-classes-discovery.spec.ts:426` mobile 為測試建資料時 `create_failed`。期間 PORT 3100 有其他工作階段在跑測試、共用同一 DB；推論共用 DB 忙碌是原因，但未證實。兩支各單獨重跑 3 次，12/12 通過。
  - 第二次一次執行：**120/120 全過**（4.6 分鐘，結束時 3100 已無其他測試）。
- 範圍外發現：建課核心 `create_failed` 吞掉原始錯誤，記入 `docs/backlog.md` 第 19 項。
- 證據：`.ai-runs/member-flow-redesign-02/`（指令與測試清單見 `commands.md`）。


<!-- codex-peer-reviewed: 2026-10-04T00:05:00Z rounds=1 verdict=approved -->
