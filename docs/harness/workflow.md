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

## 4. Build

Implement incrementally.

Rules:

- One vertical slice at a time.
- Avoid large uncontrolled rewrites.
- Keep business logic out of page components.
- Keep components reusable.
- Keep mobile-first layout.

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

## 7. Ship

Before shipping:

- Build passes
- Preview deploy checked
- Release checklist completed
- Admin/user flows manually checked
