# Harness Workflow

Every non-trivial feature must follow the same workflow.

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

## 2. Plan

Break the spec into small tasks.

Plan should include:

- Files to create/change
- Components
- Routes
- Data model changes
- Services
- Tests
- Risks

## 3. Build

Implement incrementally.

Rules:

- One vertical slice at a time.
- Avoid large uncontrolled rewrites.
- Keep business logic out of page components.
- Keep components reusable.
- Keep mobile-first layout.

## 4. Test

Run appropriate tests:

- Typecheck
- Lint
- Unit tests
- Integration tests if domain logic changed
- Playwright smoke test for key flows

## 5. Review

Run reviews:

- Code review
- Security review
- Marketplace logic review
- Brand review
- RWD review
- App-readiness review if API/domain logic changed

## 6. Ship

Before shipping:

- Build passes
- Preview deploy checked
- Release checklist completed
- Admin/user flows manually checked
