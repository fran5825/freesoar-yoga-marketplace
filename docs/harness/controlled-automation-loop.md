# Controlled Automation Loop

## 1. 目的

本文件定義 Free Soar Yoga marketplace 專案中的 Controlled Automation Loop，用來讓 Codex 在更自動化的流程中仍維持清楚邊界、可 review、可停止、可由人類做最後決策。

核心目的：

- 降低重複手動操作，但不放棄 governance。
- 讓 Codex 可以處理低風險、範圍明確的 repo-aware 任務。
- 保留 RD / product owner 對 scope、風險、commit、push、final approval 的最終控制權。
- 確保 ChatGPT governance review 可以作為 final review layer。
- 避免 AI 在高風險任務中直接 autonomous build。

Controlled Automation Loop 不是讓 Codex 自動接管專案，而是讓 Codex 在明確 level、明確 diff、明確 review packet、明確 human gate 下工作。

## 2. 適用範圍

本流程適用於 Free Soar Yoga marketplace repo 內的 AI 協作任務，包括：

- docs micro slice。
- planning / triage / task breakdown。
- 已 approve 的小型 Builder 任務。
- 低風險 docs cleanup。
- review packet 產出。
- ChatGPT governance review 前後的材料整理。

本流程不自動授權 Codex 執行下列事項：

- commit。
- push。
- production deploy。
- Prisma migration。
- Auth / permission / state machine 變更。
- payment / refund flow。
- public UX change 的直接 autonomous build。
- admin review / admin permission flow 的直接 autonomous build。

## 3. Automation Levels

### Level 0: Manual only

Level 0 是完全手動模式。Codex 可以讀取 repo、提供分析、整理 options，但不得修改檔案。

適用情況：

- 產品方向未定。
- 需求牽涉 high-risk task。
- 需要 RD / product owner 先做決策。
- ChatGPT governance review 要求停止或補材料。
- 任務可能影響 V1 scope、core user flow 或資料模型。

### Level 1: Planning-only automation

Level 1 允許 Codex 自動做 repo-aware triage、planning draft、風險分類、micro slice 建議與 Builder prompt draft，但不得進入 Builder 修改。

適用情況：

- 任務需要拆解。
- UI integration 前需要先 planning。
- 可能牽涉 Auth / Prisma / DB mutation / permissions / state machine，但尚未切清楚範圍。
- 需要 ChatGPT governance review 校正 prompt。

### Level 2: Approved Builder automation

Level 2 允許 Codex 在明確 approve 的 Builder prompt 內修改檔案、執行必要 checks、輸出 Builder Review Packet。

適用情況：

- 任務範圍明確。
- 已有 approved Builder prompt。
- 允許修改的檔案清楚列出。
- 不涉及 high-risk task，或 high-risk task 已通過 human gate 並明確限定執行內容。

Level 2 不等於可以自動 commit / push。Builder 完成後必須輸出 review packet，並交由 RD / product owner 或 ChatGPT final review layer 判斷下一步。

### Level 3: Low-risk autonomous docs cleanup

Level 3 只適用於非常低風險的 docs cleanup，例如：

- typo。
- formatting consistency。
- 補齊已存在 docs template 的小段落。
- 修正明顯 broken internal link。
- docs-only index 小幅整理。

Level 3 必須同時符合：

- 只改 docs。
- 不改 source code。
- 不改 product behavior。
- 不改 scope / permissions / state machine / data model。
- 不新增新功能承諾。
- 最後仍輸出 changed files、diff、checks 或 read-back。

## 4. 每個 Level 可以做什麼

| Level | 可以做 |
| --- | --- |
| Level 0 | 讀 repo、整理 context、提出 options、列風險、建議 next slice |
| Level 1 | 自動 triage、產出 planning draft、拆 micro slice、寫 Builder / Reviewer prompt draft |
| Level 2 | 依 approved prompt 修改允許檔案、執行 checks、產出 Builder Review Packet |
| Level 3 | 自動做低風險 docs cleanup、輸出 diff 與 self-review |

## 5. 每個 Level 不可以做什麼

| Level | 不可以做 |
| --- | --- |
| Level 0 | 修改檔案、執行 Builder、commit、push |
| Level 1 | 修改 source code、修改 docs 正式內容、執行 migration、commit、push |
| Level 2 | 超出 approved prompt、擴大 scope、自動 commit / push、跳過 review packet |
| Level 3 | 修改 source code、改 product behavior、改權限 / 狀態機 / data model、做 public UX change |

所有 level 都不可以自動 commit / push。

## 6. Human Gate 條件

以下情況必須停下來等 human gate：

- 任務被判斷為 high-risk。
- ChatGPT governance review verdict 是 `HUMAN_DECISION_REQUIRED`、`REQUEST_PLAN_CHANGES`、`STOP` 或等價判斷。
- Codex 需要超出 approved prompt。
- Diff 顯示未要求的檔案或 scope creep。
- Checks fail，但仍想繼續。
- 需要 commit。
- 需要 push。
- 需要改 Auth、Prisma schema、migration、DB mutation、permissions、state machine、payment、admin review、public UX change。
- 需要決定 V1 scope、non-goals 或 core user flow。
- 需要改 package、env、deploy、CI、secrets。

human gate 的結果應明確記錄為 approve、request changes、defer、reject 或 stop。

## 7. High-risk Task 條件

以下任務預設為 high-risk，不可直接 autonomous build：

- Auth / session / account / admin guard。
- Prisma schema。
- migration。
- database mutation 或 production data。
- permissions / capability model。
- marketplace state machine。
- payment / refund / financial flow。
- admin review 或 admin decision workflow。
- public UX change，尤其是 landing、teacher onboarding、member enrollment、organizer demand flow。
- package upgrade / dependency replacement。
- env / secret / deploy / CI config。
- cross-domain refactor。
- 任何會改變 V1 scope、non-goals 或核心 marketplace flow 的任務。

High-risk task 必須先停在 Planning-only 或 Manual only，經 human gate 後才可進入 Builder。

## 8. Codex 可以自動執行的事項

在符合對應 automation level 的前提下，Codex 可以自動執行：

- 讀取 AGENTS.md 與相關 docs。
- 使用 repo-aware triage 判斷 task type、risk、slice size。
- 產出 planning draft、options、tradeoffs。
- 建議 Builder prompt 與 Reviewer prompt。
- 在 approved prompt 內修改指定 docs 或 source files。
- 執行 lint / typecheck / test / build 等必要 checks，或說明未執行原因。
- 產出 full git diff。
- 產出 Builder Review Packet。
- 做 lightweight self-review。
- 建議是否需要 ChatGPT governance review 或 final review。

## 9. Codex 不可以自動執行的事項

Codex 不可以自動執行：

- commit。
- push。
- merge。
- production deploy。
- database migration。
- destructive database operation。
- 修改 Auth / permissions / state machine 後直接宣稱 approved。
- 在沒有 diff 的情況下要求 final approval。
- 在 high-risk task 中跳過 human gate。
- 自動擴大到 Wellness / Academy / Retreat module。
- 自動加入 advanced AI matching。
- 自動加入 payment / refund automation。
- 自動加入 native mobile app。
- 自動修改 package files，除非任務已明確 approve。
- 自動改 public UX flow，除非已經完成 planning 與 approval。

## 10. Review Packet 要求

Builder 完成後必須輸出 Builder Review Packet。至少包含：

1. Task request
2. Approved prompt 或本輪明確授權摘要
3. Changed files
4. Full git diff
5. Implementation summary
6. Scope compliance
7. Checks run
8. Docs impact
9. Risk notes
10. Known limitations
11. Builder self-review

Final review 必須看過 diff。沒有 diff 就沒有 final approval。

如果缺少 changed files、diff、checks result 或 high-risk human decision record，ChatGPT governance review 只能給 provisional review 或 request more materials，不應建議 commit / push。

## 11. Commit / Push Governance

Codex 不可以自動 commit / push。

commit / push 必須符合：

- Builder 已輸出 review packet。
- Full git diff 已提供。
- 必要 checks 已通過，或未執行原因已明確說明。
- 沒有未要求的 high-risk change。
- RD / product owner 已 final approval。
- 如需 ChatGPT final review，ChatGPT 已看過 diff 並給出 verdict。

RD / product owner 保留 final approval。ChatGPT governance review 可以作為 final review layer，但不取代 RD / product owner 對 commit / push 的最後決策。

## 12. 建議使用流程

建議流程：

```text
Task request
↓
Codex repo-aware triage
↓
Select automation level
↓
Planning-only if needed
↓
ChatGPT governance review if risk or scope requires it
↓
Human gate if high-risk or unclear
↓
Approved Builder automation
↓
Checks + full git diff
↓
Builder Review Packet
↓
ChatGPT final review if needed
↓
RD / product owner final approval
↓
Human-controlled commit / push
```

UI integration 前應先 planning。若 UI change 只是不影響 user flow 的 micro copy，可走較低 level；若會改 teacher onboarding、organizer demand、member enrollment、admin review 或 public route behavior，必須先 Level 1 planning。

## 13. 何時應該降級回 Planning-only

以下情況應降級回 Level 1 Planning-only：

- Codex 發現需要修改不在 approved prompt 內的檔案。
- 任務實際範圍比原本大。
- 需要碰 Auth / Prisma / DB mutation / permissions / state machine / payment / admin review / public UX change。
- 需要新增 package 或調整 config。
- 需求與 V1 scope、non-goals 或 brand direction 有衝突。
- Existing implementation 與文件不一致，需要先決策。
- Checks fail 且修復需要擴大 scope。
- Diff 顯示 unintended behavior change。
- Builder 無法在 micro slice 內完成。

降級後，Codex 應輸出新的 planning packet、風險說明、options 與建議下一個 micro slice，不應繼續 build。

## 14. Free Soar Yoga Marketplace 專案特別規則

Free Soar Yoga marketplace 的 automation 必須遵守以下專案規則：

- MVP first。
- 一次只做一個 micro slice。
- 維持 low-pressure UX。
- 維持 teacher-respecting tone。
- 保留 Free Soar master brand spirit：Freedom、Awakening、Growth、Wellness、Leadership、Community。
- 不把產品做成 generic yoga website、cold booking tool 或 discount course marketplace。
- V1 只服務 organizer、teacher、member、admin 的 group-class marketplace。
- 不自動擴張到 Wellness / Academy / Retreat full modules。
- 不自動加入 advanced AI recommendation / matching。
- 不自動加入 full payment / refund automation。
- 不自動加入 native mobile app。
- 不自動加入 LINE deep integration 或 Google Calendar two-way sync。
- 不自動建立 complex gamification 或 full SaaS tools for teachers。
- 牽涉 Auth / Prisma / role / permission / marketplace state machine / core user flow 的決策，必須經 product owner confirmation。
- Public UX change 應先 planning，再 build。
- Builder 完成後必須輸出 review packet。
- 沒有 diff 就沒有 final approval。
- Codex 不可以自動 commit / push。

Controlled Automation Loop 的目標不是提高速度本身，而是讓速度仍然服務清楚、溫和、可信任、專業且 human-centered 的 Free Soar Yoga marketplace。
