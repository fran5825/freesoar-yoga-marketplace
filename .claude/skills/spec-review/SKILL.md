---
name: spec-review
description: "Free Soar 版的雙軸審查（改編自 Matt Pocock 的 code-review）：Standards（是否符合 docs/harness 的 checklist 與 AGENTS.md 規則）與 Spec（是否照 docs/specs 的 spec 和票券實作，有沒有漏做或做超過）。不專門抓 bug，抓 bug 用內建 /code-review；/implement 會在內建 /code-review 之後接著跑它。Use when the user asks to review changes against the spec or project standards, or says spec-review."
---

### Free Soar Yoga 專案覆寫（優先於下方預設）

- 本 skill 跟 Claude Code 內建的 `/code-review` 分工：內建版抓 bug，本 skill 只看「照規則」與「照 spec」兩個面向。不要重複回報內建版已經抓到的 bug。
- 沒有 issue tracker，也不要叫使用者跑 `/setup-matt-pocock-skills`。
- **固定點（第 1 步）**：飛索常在 main 上、還沒 commit 就審查，而且工作區裡常有其他工作階段沒提交的檔案。所以：
  - 由 `/implement` 呼叫時：只審查這次任務改到的檔案。用 `git diff HEAD -- <這些檔案>`，新檔案（untracked）直接讀全文。
  - 使用者有給 commit／branch 時，照下方原文用 `git diff <fixed-point>...HEAD`。
  - 兩種都不是時，問使用者要審查哪些修改。
- **spec 來源（第 2 步）**，依序找：
  1. 使用者給的路徑。
  2. 這次實作的票：`docs/superpowers/plans/<feature-slug>/tickets/*.md`，加上同一個資料夾或對應的 plan 檔。
  3. `docs/specs/<feature-slug>-spec.md`。
  4. 範圍或規則有疑問時，再對照 `docs/scope/v1-scope.md`、`docs/domain/state-machines.md` 與相關的 `docs/adr/`。
  都找不到就問使用者，不要自己腦補 spec。
- **規則來源（第 3 步）**：本專案沒有 `CODING_STANDARDS.md`。改讀這些：
  - `AGENTS.md`（Brand Constitution、UI 要避免的樣式、Architecture principles、AI Rules）
  - `docs/harness/review-checklist.md`
  - `docs/harness/codex-self-review-checklist.md`
  - `docs/harness/brand-review-checklist.md`（有改畫面時）
  - `docs/harness/rwd-checklist.md`（有改畫面時）
  - `docs/harness/security-checklist.md`（有改權限、Auth、API、資料存取時）
  - `docs/context/glossary.md`（命名要跟詞彙表一致）

  下方的 code smell 基準照用，但專案規則優先。
- **Spec sub-agent** 另外要特別檢查：有沒有超出 V1 scope；有沒有沒寫在 spec 裡的 state machine 變更、權限變更、Prisma schema 變更。命中的話標「需產品主人確認」。
- 報告用繁體中文、白話寫；每一項都引用違反的規則（檔名＋條目）或 spec 那一行。
- 只回報、不修改。修不修由 `/implement` 或產品主人決定。不要 commit。

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating issue / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point (a commit SHA, branch name, tag, `main`, `HEAD~5`, etc.). If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here, not inside two parallel sub-agents.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, GitLab `!67`, etc.), fetched via the workflow in the tracker doc.
2. A path the user passed as an argument.
3. A spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Identify the standards sources

Search the repo for every file that documents how code should be written. When `CODING_STANDARDS.md` or `CONTRIBUTING.md` exists, it must be on the list.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below: a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation. Like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Spawn both sub-agents in parallel

Issue both sub-agent calls together, in the foreground, and aggregate the reports they return.

**Standards sub-agent prompt** should include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the smell baseline from step 3** pasted in full (the sub-agent has no other access to it).
- The brief: "Report, per file/hunk where relevant, (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** should include:

- The diff command and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings, because the two axes are deliberately separate (see _Why two axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes: that's the reranking the separation exists to prevent.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.
