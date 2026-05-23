# Harness Workflow

Every non-trivial feature must follow the same workflow.

Docs convention:

- Use English kebab-case for file and folder names under `docs/`.
- Use English names for routes, components, functions, models, schemas, services, APIs, and code identifiers.
- Write docs content in Traditional Chinese by default.
- Keep English technical terms when they are clearer, including marketplace, dashboard, route, permission, state machine, API, service layer, MVP, RWD, and mobile-first.
- Document titles may be English or bilingual, but explanatory content should be primarily Traditional Chinese.
- See `docs/harness/documentation-conventions.md`.

## 1. Spec

Create a spec before implementation.

Spec must include:

- Problem
- User role
- User flow
- UI requirements
- Data requirements
- Permission requirements
- State transitions
- RWD requirements
- Acceptance criteria
- Non-goals

## 2. Triage

Before planning or building, classify task risk using `docs/harness/risk-based-workflow.md`.

Triage should include:

- Workflow mode: LIGHT / STANDARD / HEAVY / PLANNING_ONLY
- Risk level
- Slice type
- Risk flags
- Human gate requirement
- Required review packets

For Codex App handoff, use `docs/prompts/codex-repo-aware-triage-prompt.md` when the task needs repo-aware classification before implementation.

Codex triage should not modify files. It should produce:

- Task type
- Risk level
- Recommended workflow mode
- Required reading
- Possible files to modify
- Files / areas not to touch
- Risk flags
- Human gate requirement
- Suggested next step
- Builder prompt candidate when appropriate

## 3. Plan

Break the spec into small tasks.

Plan should include:

- Files to create/change
- Components
- Routes
- Data model changes
- Services
- Tests
- Risks

For governance-sensitive work, send Codex triage / planning draft to ChatGPT using `docs/prompts/chatgpt-governance-review-prompt.md` before Builder implementation.

ChatGPT governance review should check:

- Brand spirit
- Founder intent
- Low-pressure UX
- MVP slicing
- Scope creep
- Risk classification
- Human gate requirement
- Prompt quality

## 4. Build

Implement incrementally.

Rules:

- One vertical slice at a time.
- Avoid large uncontrolled rewrites.
- Keep business logic out of page components.
- Keep components reusable.
- Keep mobile-first layout.

Before implementation, Builder should follow the approved Builder prompt. If `.ai-runs/current/` is used, store the approved prompt in:

```txt
.ai-runs/current/03-approved-builder-prompt.md
```

Reusable run folder templates can be copied from `docs/harness/ai-runs-current-templates/`; the filled `.ai-runs/current/` folder remains local-only and should not be committed.

## 5. Test

Run appropriate tests:

- Typecheck
- Lint
- Unit tests
- Integration tests if domain logic changed
- Playwright smoke test for key flows

## 6. Review

Run reviews. For ChatGPT / Codex handoff, use `docs/harness/review-packet-spec.md`.

Review scope:

- Code review
- Security review
- Marketplace logic review
- Brand review
- Low-pressure UX review
- RWD review
- App-readiness review if API/domain logic changed
- Packet completeness review: changed files, diff, checks, human decision record when needed

Builder completion must include a Builder Review Packet using `docs/harness/builder-review-packet-template.md`.

Minimum packet requirements:

- Task request
- Approved prompt
- Changed files
- Git diff
- Checks result
- Implementation summary
- Risk notes
- Unfinished items

No diff, no final approval.

When `.ai-runs/current/` is used, store the packet and final review in:

```txt
.ai-runs/current/04-builder-review-packet.md
.ai-runs/current/05-chatgpt-final-review.md
```

## 7. Ship

Before shipping:

- Build passes
- Preview deploy checked
- Release checklist completed
- Admin/user flows manually checked
If the task used `.ai-runs/current/`, record the final human decision before commit / push:

```txt
.ai-runs/current/06-human-decision-record.md
```
