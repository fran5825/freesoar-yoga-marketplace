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

本文件是 Controlled Auto Loop 的 source of truth。其他 harness 文件可以導覽、引用或補充使用方式，但不應另行定義一套相互競爭的 auto-continue / stop / notify 規則。

## 1A. Controlled Auto Loop Definition

Controlled Auto Loop 是受控接棒流程，不是 fully autonomous loop。

它不代表：

- Codex 可以 auto approve。
- Codex 可以 auto commit。
- Codex 可以 auto push。
- Codex 可以 auto merge。
- Codex 可以跳過 Product Owner Decision、Human Gate、Commit Gate、Push Gate 或 Stop Condition。

它只允許 Codex 在低風險、已批准、allowed scope 明確、checks 與 review packet 要求清楚的範圍內自動接棒。只要遇到 Product Owner Decision、Human Gate、Commit Gate、Push Gate 或 Stop Condition，Codex 必須停止自動接棒，回報原因，並等待 human / product owner 明確指示。

## 1B. Auto-continue Matrix

| Situation | Auto-continue allowed | Reason | Must stop? | Notify human? |
| --- | --- | --- | --- | --- |
| read-only triage | yes | 只讀取 repo context、分類風險與建議 next slice，不改檔。 | no | no |
| planning-only audit | yes | 只產出 options、tradeoffs、risk map、Builder Prompt Draft，不進入 Builder。 | no | 視是否有 human decision 而定 |
| approved docs-only Builder | yes | 已有明確 allowed files、forbidden files、scope、checks，且只改 docs。 | no | no，除非觸發 stop condition |
| approved low-risk Builder | yes | 已有 approved Builder prompt，且不碰 high-risk boundary。 | no | no，除非 checks fail 或 scope drift |
| Reviewer read-only review | yes | Reviewer 預設不改檔，只檢查 diff、scope、風險與 tests。 | no | no，除非 verdict 需要 human decision |
| checks / read-back | yes | 在 approved scope 內執行驗證或 docs read-back。 | no | no，除非 checks fail |
| missing allowed files | no | 無法確認 Builder 可修改範圍。 | yes | yes |
| scope ambiguity | no | 無法確認是否超出 V1 scope 或 approved prompt。 | yes | yes |
| failed checks | no | 需要判斷是否修復、降級或 request changes。 | yes | yes |
| requested file outside allowed files | no | 代表需要擴大授權或重新切 slice。 | yes | yes |
| Prisma / Auth / permissions / state machine changes | no | 觸及 high-risk boundary 與 product owner decision。 | yes | yes |
| Product Owner Decision needed | no | 需要產品主人做不可由 Codex 代替的決策。 | yes | yes |
| Commit Gate | no | commit 必須由 product owner 明確要求。 | yes | yes |
| Push Gate | no | push 必須獨立於 commit approval 另行明確要求。 | yes | yes |

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

### Auto Builder Decision Rule

Planning / Orchestrator 產出 Planning Report 時，必須明確包含：

```text
Auto Builder Decision:
- Can auto-enter Builder: yes/no
- Risk level:
- Required human gate: yes/no
- Reason:
- If yes: produce a complete executable Builder Prompt with Output Report Requirement.
- If no: produce Builder Prompt Draft only, and stop at Human Gate for RD approval.
```

Auto Builder Decision 是進入 Builder 前的 gate。`Can auto-enter Builder: yes` 只代表 Planning / Orchestrator 可以直接產出可執行 Builder Prompt，並進入 Builder execution；不代表可以自動 merge、commit 或 push。RD / product owner 仍保留最後 review、commit 與 push 決策權。

若 low-risk source-code slice 被允許 auto-enter Builder，它仍屬於 Level 2 Builder execution，必須遵守 approved prompt、allowed files、checks 與 review packet 要求。Level 3 只限 low-risk docs cleanup，不是 source-code slice 的執行層級。

只有 low risk slice 可以 `Can auto-enter Builder: yes`。Auto-enter Builder 必須同時符合以下條件：

1. Risk level = low
2. No Prisma schema / migration
3. No Auth / session / permission boundary
4. No payment / email / notification
5. No production data access
6. No public UX policy decision
7. Allowed files are narrow and explicit
8. Forbidden files are listed
9. Required checks are listed
10. Builder must not commit / push
11. Builder must output Review Packet

只要涉及以下任一項，`Can auto-enter Builder` 必須是 `no`，並停在 Human Gate 等 RD approval：

- Auth
- session
- permission boundary
- Prisma schema
- migration
- DB write behavior
- role / capability
- Admin
- payment
- email
- notification
- public onboarding policy
- teacher application status flow
- rejected / approved / suspended policy
- production data
- package.json / package-lock.json
- ambiguous scope
- missing verification plan

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

- Risk level 是 medium、medium-high 或 high。
- 任務被判斷為 high-risk。
- ChatGPT governance review verdict 是 `HUMAN_DECISION_REQUIRED`、`REQUEST_PLAN_CHANGES`、`STOP` 或等價判斷。
- Codex 需要超出 approved prompt。
- Diff 顯示未要求的檔案或 scope creep。
- Checks fail，但仍想繼續。
- 需要 commit。
- 需要 push。
- 需要改高風險邊界：Auth、session、permission boundary、role / capability、Admin、Prisma schema、migration、DB mutation / DB write behavior、state machine、payment、email、notification、production data、package / env / deploy / CI / secrets、`package.json` 或 `package-lock.json`。
- 需要改產品政策或公開流程：public UX change、public onboarding policy、teacher application status flow、rejected / approved / suspended policy。
- 需要決定 V1 scope、non-goals 或 core user flow。
- Scope ambiguous 或 missing verification plan。

human gate 的結果應明確記錄為 approve、request changes、defer、reject 或 stop。

## 6A. Stop and Notify Conditions

以下情況必須停止自動接棒，並通知 human / product owner。通知可以是人工回報、ChatGPT reminder、GitHub PR comment、Slack 或未來手機通知；本文件只定義 trigger candidates，不宣稱目前已完成任何手機推播整合。

- V1 scope、non-goals 或 core user flow 需要變更。
- Auth、session、Prisma schema、migration、permissions、role 或 marketplace state machine 需要變更。
- payment、email、notification、production data、package、env、deploy 或 CI 需要變更。
- public UX policy change，特別是 teacher onboarding、organizer demand、member enrollment 或 admin review 流程。
- scope ambiguous，無法確認是否仍在 approved prompt 內。
- missing verification plan，無法確認應執行哪些 checks 或 read-back。
- requested file outside allowed files。
- checks failed，且修復會擴大 scope 或觸及未批准檔案。
- scope drift detected。
- unintended behavior change。
- Reviewer verdict 是 `REQUEST CHANGES`、`BLOCKED`、`STOP`，或等價判斷。
- Commit Gate。
- Push Gate。

## 6B. Mobile Notification Trigger Candidates

以下是未來可接手機通知、Slack、GitHub PR comment、ChatGPT reminder 或其他 human notification channel 的 trigger candidates。本文件不宣稱目前已完成手機推播整合，也不要求 Codex 自行發送外部通知。

- Product Owner Decision required。
- Human Gate reached。
- Stop Condition triggered。
- Checks failed。
- Scope drift detected。
- Builder completed and review materials ready。
- Final Review ready for Commit Gate。
- Commit Gate pending approval。
- Push Gate pending approval。
- Missing materials blocks review。
- Dirty working tree blocks auto-continue。
- Codex downgraded from Builder to Planning-only。

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

## 10A. Builder Prompt Draft 固定結尾要求

所有 Planning / Orchestrator 產出的 Builder Prompt Draft，最後都必須固定包含以下段落，且不得刪改為較弱版本：

```text
Output Report Requirement:
完成後請不要 commit / push，並回報：
1. Changed files
2. Full git diff
3. Checks result
4. Manual smoke result
5. Self review
6. Scope drift check：是否有任何超出本任務範圍的修改或判斷
```

若 Builder Prompt Draft 缺少此段，ChatGPT governance review 或 RD review 應要求補齊後才可進 Builder。

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
