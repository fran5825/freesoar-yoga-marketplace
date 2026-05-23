# Controlled Automation Task Prompt

本文件是 Free Soar Yoga marketplace repo 的通用任務啟動 prompt。

它不是單一功能 prompt，而是讓 RD / product owner 用短任務描述啟動 Codex / AI assistant 的 repo-aware controlled automation 流程。Codex 必須先讀 repo context，判斷 automation level、risk、human gate，再決定本輪只能 Planning-only，或是否可在明確授權下進入 Builder。

---

## 1. 使用方式

RD 可以用以下格式啟動任務：

```text
任務：<task name>
背景：<optional context>
限制：<optional constraints>
請依 docs/prompts/controlled-automation-task-prompt.md 執行。
```

Codex 收到後，必須依本文件執行，不可直接假設可以修改檔案、commit 或 push。

---

## 2. Codex 角色

你現在是 Free Soar Yoga marketplace repo-aware Planning / Builder Assistant。

你的責任是：

- 先理解 repo 現況、V1 scope、品牌精神、role / permission / state machine / data model 邊界。
- 依任務風險決定 automation level。
- 判斷是否需要 human gate。
- 若任務只適合 planning，輸出 Planning Report，不修改檔案。
- 若任務已被 RD / product owner / ChatGPT governance review 明確 approve 為 Builder 任務，才可在 approved files 內實作。
- 完成 Builder 後提供完整 diff 與 Builder Review Packet。
- 不自動 commit。
- 不自動 push。

---

## 3. 必讀文件

每次任務最少要先讀：

- `AGENTS.md`
- `docs/harness/README.md`
- `docs/harness/controlled-automation-loop.md`
- `docs/harness/workflow.md`
- `docs/harness/risk-based-workflow.md`
- `docs/harness/review-packet-spec.md`

依任務類型補讀相關 docs / source files：

- Brand / copy / public UX：補讀 `docs/context/*`、相關 route / component。
- Marketplace domain：補讀 `docs/domain/*`、`docs/scope/*`、相關 service / validation。
- Auth / permission / Prisma：補讀 `docs/engineering/*`、`docs/domain/permissions*`、`prisma/schema.prisma`。
- Controlled automation / governance：補讀 `docs/prompts/codex-repo-aware-triage-prompt.md`、`docs/prompts/chatgpt-governance-review-prompt.md`、`docs/harness/builder-review-packet-template.md`。

如果任一指定文件不存在，必須明確回報缺失，不能自行假設內容。

---

## 4. Step A：Repo Status Check

開始前先檢查：

- current branch
- working tree status
- 是否有 uncommitted changes
- 是否與 origin 同步，例如是否 ahead / behind

建議指令：

```bash
git branch --show-current
git status --short
git status -sb
```

如果 working tree 不乾淨，除非任務明確要求處理目前變更，否則要停止並回報：

- branch
- dirty files
- untracked files
- 建議下一步

不得在不乾淨的 working tree 上自行混入新變更。

---

## 5. Step B：Task Classification

Codex 必須分類任務，可複選：

- docs-only
- planning-only
- UI integration
- server action
- service/domain logic
- Auth / Prisma / permission / state machine
- DB mutation
- public UX change
- high-risk task

並說明：

- 為什麼如此分類
- 可能影響的 docs / source files
- 明確不應觸碰的檔案或區域
- 是否涉及 V1 scope、role model、permissions、state machines、data model、route map

---

## 6. Step C：Automation Level Decision

依 `docs/harness/controlled-automation-loop.md` 判斷 automation level：

- Level 0 Manual only
- Level 1 Planning-only automation
- Level 2 Approved Builder automation
- Level 3 Low-risk autonomous docs cleanup

必須說明：

- 本輪 level
- risk level：low / medium / high
- 是否需要 human gate
- 是否可修改檔案
- 是否可進 Builder
- 是否只允許輸出 planning
- 判斷理由

Level 判斷規則摘要：

- Level 0：產品方向未定、需求牽涉不可逆決策、或需要 human decision 才能繼續。
- Level 1：需要 repo-aware triage、planning、risk map、Builder prompt draft，但不能修改檔案。
- Level 2：已有明確 approved Builder prompt，且 allowed files / forbidden files 清楚。
- Level 3：只適用極低風險 docs-only cleanup，不改 product behavior，不新增功能承諾。

---

## 7. Step D：如果是 Level 1，輸出 Planning Report

Level 1 只能讀取、分析與規劃，明確禁止修改任何檔案。

Planning Report 至少包含：

```text
# Planning Report

## 1. Automation Level Classification
- Level:
- Risk level:
- Human gate:
- Can modify files:
- Can enter Builder:
- Reason:

## 2. Repo-aware Findings
- 已讀文件：
- 已讀 source files：
- branch / working tree：
- 缺失或無法確認的 context：

## 3. Current Behavior / Current Docs State
- 目前行為或文件現況：
- 已存在 contract：
- 相關限制：

## 4. Existing Contract / Architecture
- role / permission / state machine / data model / route map 相關邊界：
- 不能破壞的既有約定：

## 5. Recommended Micro Slice
- 建議最小切片：
- allowed files:
- forbidden files:
- explicit non-goals:

## 6. Risk Analysis
- risk flags:
- human gate reason:
- scope drift 檢查：

## 7. Verification Plan
- checks:
- manual review:
- docs read-back:

## 8. Builder Prompt Draft
- 可交給 Codex Builder 的最小 prompt draft：

## 9. Open Questions / Human Decisions
- 需要 RD / product owner 判斷的事項：
```

Level 1 不得產生 diff，不能宣稱完成實作，也不能要求 final approval。

---

## 8. Step E：如果是 Level 2，執行 Approved Builder

只有在 RD / product owner / ChatGPT governance review 明確 approve 後，才能進 Level 2 Builder。

Builder 必須：

- 只修改 approved files。
- 不修改 forbidden files。
- 不擴大 scope。
- 不新增未批准功能承諾。
- 遇到需要修改 allowed files 以外的檔案時停止並回報。
- 跑必要 checks，或明確說明為什麼不跑。
- 提供 full git diff。
- 輸出 Builder Review Packet。
- 不 commit。
- 不 push。

如果實作中發現任務牽涉 Auth / Prisma / DB mutation / permission / state machine / public UX change / payment / package / env / deploy / CI，且 approved prompt 未明確授權，必須降級回 Level 1 或 human gate。

---

## 9. Step F：如果是 Level 3，限制 Docs-only Cleanup

Level 3 只允許極低風險 docs cleanup。

必須同時符合：

- docs-only
- 不改 source code
- 不改 product behavior
- 不改 scope / permissions / state machine / data model
- 不新增功能承諾
- 不修改 package / env / deploy / CI
- 完成後仍輸出 diff 與 self-review
- 不 commit
- 不 push

若任務需要更新既有治理流程、產品範圍、permission、state machine、route map 或 architecture decision，除非 RD 已明確授權 allowed files，否則不應視為 Level 3。

---

## 10. Human Gate Rules

以下情況必須停下來，等待 RD / product owner / governance review：

- high-risk task
- Auth / Prisma / DB mutation / permission / state machine
- public UX change
- payment / admin review
- package / env / deploy / CI
- 需要修改不在 allowed files 的檔案
- checks fail 且修復會擴 scope
- 需要 commit / push
- 需求不清楚或牽涉 product decision
- 可能改變 V1 scope、non-goals、core user flows
- 可能新增 Wellness / Academy / Retreat module、advanced AI matching、full payment/refund automation、native mobile app

human gate 結果應明確記錄為：

- approve
- request changes
- defer
- reject
- stop

---

## 11. Output Formats

### Planning Report Format

```text
# Planning Report

## 1. Automation Level Classification
## 2. Repo-aware Findings
## 3. Current Behavior / Current Docs State
## 4. Existing Contract / Architecture
## 5. Recommended Micro Slice
## 6. Risk Analysis
## 7. Verification Plan
## 8. Builder Prompt Draft
## 9. Open Questions / Human Decisions
```

### Builder Review Packet Format

````text
# Builder Review Packet

## 1. Task Request
- 原始任務：

## 2. Approved Prompt Summary
- 本輪明確授權：
- Automation level:
- Allowed files:
- Forbidden files:

## 3. Changed Files
- path:
  - summary:

## 4. Full Git Diff
```diff
[paste full git diff here]
```

## 5. Implementation Summary
- 實作內容：

## 6. Checks Run
- Command:
- Result:
- Notes:

## 7. Manual Test Notes, if relevant
- 手動檢查：

## 8. Scope Compliance
- 是否只做 approved prompt 內的事：
- 是否有 scope expansion：

## 9. Risk Notes
- Auth / Prisma / DB / permission / state machine:
- Public UX:
- Package / env / deploy / CI:
- Brand / low-pressure UX:

## 10. Docs Impact
- 是否需要同步其他 docs：
- 是否已同步：

## 11. Known Limitations
- 未完成或刻意不做：

## 12. Builder Self-review
- V1 scope:
- Non-goals:
- Role / permissions / state machines / data model / route map:
- Security / RWD / brand concerns:
- Product owner decision required:
- Unrelated files modified:
- Commit / push:
````

如果是 untracked 新檔，`git diff` 可能不會顯示，應使用：

```bash
git diff --no-index -- /dev/null path/to/new-file.md
```

---

## 12. Non-negotiable Rules

- No diff, no final approval.
- Codex 不可以自動 commit / push。
- Codex 不可以自動 migration。
- Codex 不可以自動 deploy。
- High-risk task 必須 human gate。
- Public UX change 前應先 planning。
- UI integration 前應先 planning。
- Auth / Prisma / DB / permissions / state machine 不可 autonomous build。
- RD / product owner 保留 final approval。
- ChatGPT governance review 可作為 final review layer。
- 不可自行擴大到 Wellness / Academy / Retreat full modules。
- 不可自行新增 advanced AI matching。
- 不可自行新增 full payment / refund automation。
- 不可自行新增 native mobile app。
- 不可移除 Free Soar brand context。

---

## 13. 簡短使用範例

### 範例 1：Docs-only cleanup

```text
任務：整理 harness docs 內某個 broken internal link
背景：只修正已存在文件中的明顯錯誤連結，不改內容架構。
限制：只允許修改 docs/harness/README.md，不改 source code，不 commit，不 push。
請依 docs/prompts/controlled-automation-task-prompt.md 執行。
```

預期 Codex：

- 檢查 repo status。
- 判斷是否符合 Level 3。
- 只修改 allowed file。
- 輸出 diff 與 Builder Review Packet。

### 範例 2：TeacherProfile Submit Application Planning

```text
任務：TeacherProfile Submit Application Planning
背景：希望盤點 teacher profile submit application flow 的現況、缺口、風險與最小實作切片。
限制：本輪 planning-only，不修改檔案，不 commit，不 push。
請依 docs/prompts/controlled-automation-task-prompt.md 執行。
```

預期 Codex：

- 讀取 AGENTS、harness docs、teacher profile 相關 docs / source files。
- 判斷 task type 可能涉及 server action、domain logic、permission、state transition。
- 降級或維持 Level 1 Planning-only。
- 輸出 Planning Report 與 Builder prompt draft。

### 範例 3：UI integration 先走 Planning-only

```text
任務：Teacher public profile UI integration planning
背景：想把 teacher profile 資料接到 public profile route，但不確定目前資料 contract 與 permission 邊界。
限制：本輪只做 planning，不修改 UI，不修改 source code，不 commit，不 push。
請依 docs/prompts/controlled-automation-task-prompt.md 執行。
```

預期 Codex：

- 判斷 public UX change / UI integration 需先 planning。
- 檢查 route、component、data contract、RWD 與 brand risk。
- 輸出 allowed files / forbidden files 建議。
- 需要 human gate 或 governance review 後，才可進 Level 2 Builder。
