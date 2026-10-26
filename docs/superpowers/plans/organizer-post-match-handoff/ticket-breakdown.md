# 選定老師之後的交接：票券總覽

來源：[spec](../../../specs/organizer-post-match-handoff-spec.md)、[plan](plan.md)。建立日期：2026-10-26。狀態：**切票已由產品主人確認**（2026-10-26 原文：「同意這份切票，建立一票一檔。」），一票一檔已建立。確認的是切法與相依，不等於放行 Human Gate 票的實作。

**長任務放行（2026-10-26）**：產品主人要求「用長任務把 01~05 全部做完」，並在確認單選擇「03、04 都放行」「通過就 commit＋push」。依此 01→05 連續執行，每票測試通過就 commit＋push main（push 前重查 `origin/main..main`，只 add 本任務檔案）；遇到票檔沒寫到的設計、測試失敗原因不明、或需要動 schema／Auth／狀態機時停下來問。

需要產品主人放行才能動工的票（Human Gate＝yes）：

- **03**（STANDARD）：改通知文案。`docs/harness/risk-based-workflow.md` 第 6 節規定動 notification 就要 Human Gate。
- **04**（HEAVY）：改「誰看得到哪些聯絡欄位」，屬權限變更。不改 schema，在一般工作區做即可，但要安全檢查與獨立 review。團主端與老師端放在同一張票，因為團主畫面上的說明（「老師看得到你團體的聯絡窗口」）要等老師端做好才是真的；分開做，中途停下或只回退一半都會讓畫面說錯話。

## 票券與相依

| # | 票 | 交付什麼 | Mode | Human Gate | Blocked by | Status |
|---|----|---------|------|-----------|-----------|--------|
| 01 | [草稿判斷與課程頁說明](tickets/01-draft-kind-and-class-page.md) | 團主在課程頁看得出「學員還看不到」；開課時間已過的草稿不再出現按了會失敗的「開放報名」，改成說明與兩個新入口 | STANDARD | no | – | done |
| 02 | [總覽待辦、課程列表、需求下一步](tickets/02-dashboard-list-and-demand-next-step.md) | 建完課離開後，總覽「待你處理」會提醒還沒開放的課，點了直達；開放後自動消失；需求的下一步說法跟課程實際狀態一致 | STANDARD | no | 01 | done |
| 03 | [「課程已建立」通知依路線分文案](tickets/03-class-created-notice-by-origin.md) | 媒合建課後，團主與老師的通知寫明還沒開放報名；直接開團與老師自建課的通知不變 | STANDARD | yes | – | done |
| 04 | [選定後雙方看到聯絡方式](tickets/04-post-selection-contacts.md) | 團主選定後在同一頁看到老師聯絡方式與可配合時段；被選定的老師從通知直接到回應頁看到團體聯絡窗口；沒被選上的老師看不到；雙方都缺聯絡方式時知道誰要補 | HEAVY | yes | – | done |
| 05 | [驗收與文件同步](tickets/05-acceptance-and-docs.md) | 手機與桌機走完整段交接；走查報告與權限文件一致 | STANDARD | no | 01–04 | done |

```text
01 ──> 02 ──┐
03 ─────────┼──> 05
04 ─────────┘
```

- 01、02 不需要 Human Gate，可以先做。03、04 等產品主人各自放行。
- 03 與 04 都改 `src/domain/notification/copy.ts`（不同通知類型），不要同時開工。
- 回退順序：02 依賴 01 的判斷函式，要撤回 01 就先撤回 02；04 只能整張撤回。

<!-- codex-peer-reviewed: 2026-10-26T11:11:56Z rounds=2 verdict=approved -->
