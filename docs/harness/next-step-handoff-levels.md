# Next Step Handoff Levels

## 1. Purpose

本文件定義 Codex 每輪回覆結尾的 `Recommended Next Step` 應如何保持輕量、可執行、且符合 Harness template。

目標不是讓每個小問題都進入完整 Harness，而是讓 Codex 先判斷下一步需要哪一種控管深度：

1. `L1 Quick Answer / Quick Fix`
2. `L2 Harness Preflight`
3. `L3 Template Prompt Handoff`

Codex 應優先快速解決能安全完成的小問題；只有在任務需要 repo-aware triage、human gate、Builder、Reviewer 或跨 task handoff 時，才升級到 L2 或 L3。

## 2. Level Definitions

| Level | Use when | Codex behavior | Prompt requirement |
| --- | --- | --- | --- |
| L1 Quick Answer / Quick Fix | 問題可直接回答，或是低風險、單點、可立即完成的小修改 | 直接回答或直接完成；保留簡短 self review | 可提供一行 next prompt；不需要完整 template |
| L2 Harness Preflight | 任務需要先讀 repo / docs、判斷 scope、風險、allowed files、checks 或 human gate，但尚未需要正式 Builder | 做 repo-aware preflight；預設 read-only，除非使用者已明確授權低風險修改 | 使用精簡 preflight prompt，對齊 `docs/prompts/controlled-automation-task-prompt.md` |
| L3 Template Prompt Handoff | 下一步適合 Planning / Builder / Reviewer / Product Owner Decision，或需要開新 task 接棒 | 產出可直接貼給下一個 Codex task 的完整 prompt | 必須符合對應 template：planning、builder、reviewer 或 decision prompt |

## 3. Classification Rules

### L1 Quick Answer / Quick Fix

使用 L1 當：

- 使用者只是問概念、解釋、狀態、指令、檔案位置或局部程式碼問題。
- 修改是 docs-only、小段 copy、註解、格式或明確低風險修正。
- 不影響 Auth、Prisma、permissions、marketplace state machine、core user flow、package、env、deployment 或 payment。
- Codex 可以在本 task 內直接完成，且不需要產品主人先做決策。

L1 final report 可以很短，但仍必須有 `Recommended Next Step`。如果有合理下一步，給一個小 prompt；如果沒有，寫 `None`。

### L2 Harness Preflight

使用 L2 當：

- 問題看似可執行，但需要先確認 repo 現況、相關 docs、風險與最小切片。
- 可能影響 UI flow、role behavior、admin behavior、notification、email、test strategy 或 docs architecture。
- 使用者提出的是方向、制度、流程、規劃、review 或拆解，而不是明確 approved Builder prompt。
- Codex 需要先判斷是否能在現有 task 直接做，或是否應轉成 L3 prompt。

L2 預設不要求完整 run folder，也不要求產生所有 packets。輸出應包含：

- task classification
- relevant docs / files
- risk flags
- next smallest actionable slice
- whether L3 is needed
- suggested next prompt

### L3 Template Prompt Handoff

使用 L3 當：

- 下一步會進入 `Planning / Orchestrator`、`Builder`、`Reviewer` 或 `Product Owner Decision`。
- 任務需要開新 task 接棒，或使用者希望把下一步交給另一個 task 執行。
- 需要嚴格限制 allowed files、forbidden files、checks、stop conditions 與 output report。
- 涉及 high-risk boundary，必須先停在 planning-only 或 product owner decision。
- Builder 已完成，下一步應由 Reviewer 檢查 diff。

L3 prompt 必須對齊下列 source of truth：

- Planning / Preflight：`docs/prompts/controlled-automation-task-prompt.md`
- Repo-aware triage：`docs/prompts/codex-repo-aware-triage-prompt.md`
- Builder：`docs/harness/ai-runs-current-templates/03-approved-builder-prompt.md`
- Builder + Reviewer in same task：`docs/prompts/codex-builder-reviewer-workflow.md`
- Reviewer：`docs/prompts/codex-reviewer-prompt.md`
- Governance review：`docs/prompts/chatgpt-governance-review-prompt.md`
- Builder review packet：`docs/harness/builder-review-packet-template.md`

## 4. Recommended Next Step Schemas

`Recommended Next Step` 有兩種 schema：

- Lightweight Final Report Schema：一般 final report 使用，目標是保留 L1 快速處理小問題的彈性。
- Full Handoff Packet Schema：Builder Review Packet、Reviewer output、Final Review output 或其他正式 handoff packet 使用，目標是讓 auto-continue、stop / notify 與 approval boundary 可被 review。

### 4.1 Lightweight Final Report Schema

Every final report should include at least:

```text
Recommended Next Step
- Level: L1 / L2 / L3
- Recommended next work mode:
- Next smallest actionable slice:
- Why this should be next:
- Can Codex execute directly:
- Suggested execution location: current task / new task / either
- Requires product owner decision:
- Suggested next prompt:
```

一般 final report 可以停在這個輕量 schema；若本輪本身就是 Builder Review Packet、Reviewer output、Final Review output，或使用者明確要求完整 handoff packet，則必須使用 Full Handoff Packet Schema。

For L1, the `Suggested next prompt` may be one sentence.

For L2, the prompt should request a preflight and explicitly say whether file edits are allowed.

For L3, the prompt must be a complete copy-paste prompt aligned with the correct template.

### 4.2 Full Handoff Packet Schema

Full handoff packets must use the Common Handoff Schema in `docs/harness/review-packet-spec.md`:

```text
Recommended Next Step:
- Level:
- Recommended next work mode:
- Next smallest actionable slice:
- Why this should be next:
- Can Codex execute directly:
- Suggested execution location:
- Requires product owner decision:
- Suggested next prompt:
- Auto-continue allowed:
- Auto-continue reason:
- Stop condition triggered:
- Notify human:
- Notification reason:
- Approval noise reduction applied:
- Approval boundary note:
```

Full handoff packets include Builder Review Packet, Reviewer output, Final Review output, and any handoff packet intended for another Codex task or human gate.

## 5. Execution Location Rule

Codex should suggest where the next step should run:

- `current task`：適合小修、延續同一段脈絡、或 Codex 可以直接完成。
- `new task`：適合大型 Builder、獨立 Reviewer、長時間 verification、或需要隔離 context / diff review。
- `either`：兩者都可，Codex 應說明推薦選項。

If `Suggested next prompt` is not `None`, Codex must end the final report by asking whether the product owner wants to run that prompt in the current task or in a new task. The question must use a numbered 1 / 2 choice format so the product owner can reply with a single number. Codex must not create a new task unless the product owner explicitly asks.

Recommended closing question:

```text
要我怎麼處理上面的 Suggested next prompt？
1. 在目前 task 直接執行
2. 開新 task 執行
```

## 6. Prompt Templates

### L1 Prompt

```text
請在現有 task 直接處理這個小問題：

任務：[貼上任務]
限制：保持最小變更；不 commit、不 push；如果發現會碰到 Auth / Prisma / permissions / state machine / core user flow，請先停下回報。
完成後請用繁體中文簡短回報 changed files、checks 或未執行原因、Recommended Next Step。
```

### L2 Preflight Prompt

```text
請依 docs/prompts/controlled-automation-task-prompt.md 做 Harness Preflight。

任務：[貼上任務]
限制：本輪預設 read-only；除非你判斷是 L1 低風險 docs-only 小修，否則不要修改檔案；不要 commit / push。

請輸出：
1. L1 / L2 / L3 level 判斷
2. task type、risk flags、human gate
3. relevant docs / files
4. next smallest actionable slice
5. 是否建議在 current task 或 new task 執行
6. 若需要 L3，請產出符合 template 的 Planning / Builder / Reviewer prompt
```

### L3 Planning Prompt

```text
請依 docs/prompts/codex-repo-aware-triage-prompt.md 執行 Planning / Orchestrator。

任務：[貼上任務]
限制：planning-only、read-only；不修改檔案、不 commit、不 push。

請產出 repo-aware triage、風險判斷、human gate、next smallest actionable slice，並在最後提供符合 template 的 Suggested Builder prompt 或 Product Owner Decision prompt。
```

### L3 Builder Prompt

```text
請依 docs/harness/ai-runs-current-templates/03-approved-builder-prompt.md 執行 Builder。

Approved task：[貼上已核准任務]

Allowed files:
- [列出允許修改檔案]

Forbidden files / areas:
- [列出禁止修改檔案或區域]

Checks to run:
- [列出必要 checks]

Stop conditions:
- 超出 allowed files
- 需要修改 Auth / Prisma / permissions / state machine / core user flow，但本 prompt 未明確授權
- checks repair 會擴大 scope

Output Report Requirement:
完成後請不要 commit / push，並回報：
1. Changed files
2. Full git diff
3. Checks result
4. Manual smoke result
5. Self review
6. Scope drift check：是否有任何超出本任務範圍的修改或判斷
7. Recommended Next Step，包含下一步是否建議 current task 或 new task
```

### L3 Reviewer Prompt

```text
請依 docs/prompts/codex-reviewer-prompt.md 以 reviewer 身分審查本 repo 變更。

限制：
- 你不是 builder
- 預設不要修改檔案
- 不 commit、不 push

請檢查：
1. changed files 與 git diff
2. 是否符合 approved prompt
3. tests / checks 是否足夠
4. V1 scope、Auth、Prisma、permissions、state machine、core user flow、security、RWD、brand consistency
5. 是否有 blocking findings

請輸出 reviewer verdict、findings、open questions、risk notes、Recommended Next Step，並提供可直接執行的下一步 prompt。
```

## 7. Recommended Practice

建議採用「L1 default, L2 when unsure, L3 when handing off」：

- 能快速安全解決，就直接解決。
- 需要判斷風險，就先做 L2 preflight。
- 需要交棒、隔離、正式 Builder / Reviewer 或產品主人決策，就輸出 L3 template prompt。

這比每輪都套完整 Harness 更合理，因為它保留了 control loop，但把儀式成本集中在真正需要控管的任務上。
