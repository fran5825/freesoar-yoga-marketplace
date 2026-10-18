---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

### Free Soar Yoga 專案覆寫（優先於下方預設）

- 適用時機：票數多（大約 4 張以上）而且有幾張可以同時做。小功能請用 `/implement` 一票一票做，比較省、也比較好追。
- 沒有 issue tracker、也不開 PR（目前直接進 main）。spec 在 `docs/specs/`，票在 `docs/superpowers/plans/<feature-slug>/tickets/`。「關票」= 把票檔 Status 改成 done、在 plan 檔打勾。
- 開始前先列出 frontier（現在就能做的票）和每張票的 Workflow mode／Human Gate，給產品主人一次放行。HEAVY 或 Human Gate = yes 的票沒放行就不派給 subagent。
- 碰 Prisma schema／migration 的票：在自己的 worktree 做，並用獨立的測試資料庫，不碰本機開發用的資料庫。
- 每個 implementer subagent 跑 Playwright 時要用不同的埠（3100、3200、3300…），避免互相把伺服器關掉。
- 第 7 步先跑 Claude Code 內建的 `/code-review`（抓 bug），再用 Skill tool 呼叫 `spec-review`（對照專案規則和 spec），兩邊的發現交給同一個 implementer subagent 修。
- 第 8 步不開 PR：回報 integration branch 名稱，請產品主人決定要不要合併進 main。沒有明確要求就不 commit 到 main、不 push。

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create the integration branch. If the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge in step 5 (a branch with no commits ahead of main can't open one), marked as closing the spec and tickets.

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `tdd` to build the ticket;
   - merges the integration branch tip into its own branch before reporting done

5. Once an **implementer subagent** completes, merge its work to the integration branch with a **merger subagent**.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `code-review` on the integration branch. Fix all issues raised by the code review in a single **implementer subagent**.

8. If a draft PR exists, mark it ready for review. Otherwise, resolve each ticket the way the issue tracker closes work, and report the integration branch.

9. Clean up all **implementer subagent** worktrees.
