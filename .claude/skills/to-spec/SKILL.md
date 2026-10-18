---
name: to-spec
description: "Turn the current conversation into a spec and publish it to the project issue tracker: no interview, just synthesis of what you've already discussed."
disable-model-invocation: true
---

This skill takes the current conversation context and codebase understanding and produces a spec. Do NOT interview the user; just synthesize what you already know.

### Free Soar Yoga 專案覆寫（優先於下方預設）

- 不使用 issue tracker、不貼 triage label，也不要叫使用者跑 `/setup-matt-pocock-skills`。spec 寫成一個檔案：`docs/specs/<feature-slug>-spec.md`（英文 kebab-case 檔名）。
- 內容用繁體中文；開頭一行寫「建立日期／來源（例如 `/grill-with-docs` 的日期）／相關 ADR」，格式參考 `docs/specs/teacher-my-calendar-spec.md`。
- 用語以 `docs/context/glossary.md` 為準，並遵守 `docs/adr/` 裡相關的決策；超出 `AGENTS.md` 的 V1 Scope 就寫進 Out of Scope，不要偷偷放進來。
- 碰到 Auth、Prisma schema、權限、state machine、V1 scope 或核心流程的決定，在 Implementation Decisions 標註「需產品主人確認」。
- Testing Decisions 的 seam：目前專案只有 Playwright smoke test（`npm run test:smoke`，`tests/smoke/`）。要新增 Vitest 等測試工具屬於 package 變更（HEAVY），只能列成選項給產品主人決定。
- 第 3 步不發佈：寫好檔案後請使用者審閱，下一步通常是 `/to-tickets docs/specs/<feature-slug>-spec.md`。
- 不要 commit。

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

Check with the user that these seams match their expectations.

3. Write the spec using the template below, then publish it to the project issue tracker. Apply the `ready-for-agent` triage label - no need for additional triage.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
