# Free Soar Yoga Marketplace

This repository is for building **Free Soar Yoga**, the first-phase marketplace product under the Free Soar master brand.

## Product

Free Soar Yoga is a brand-driven yoga group-class marketplace for:

- Organizers / group leaders
- Yoga teachers
- Members / students
- Platform admins

It supports:

- Teacher onboarding
- Teacher profiles
- Organizer demand requests
- Teacher responses
- Class sessions
- Enrollments
- Teacher availability calendar
- Admin management
- Email notifications
- RWD/mobile-first experience

## Contributing

If you're a human developer setting up this repo locally (cloning, `.env`, running the dev server, git workflow), see `CONTRIBUTING.md`.

## How to use this repo with AI agents

Before asking any AI coding agent to implement features, ask it to read:

- `AGENTS.md`
- `docs/context/*`
- `docs/scope/*`
- `docs/domain/*`
- `docs/harness/*`

Recommended first prompt:

> Please read AGENTS.md and all files under docs/context, docs/scope, docs/domain, and docs/harness. Do not write code yet. First summarize your understanding of the product positioning, V1 scope, non-goals, domain model, state machines, permissions, and recommended next steps.

## Suggested next steps

1. Initialize a Next.js + TypeScript + Tailwind project.
2. Preserve this docs structure.
3. Create the first ADR: `docs/adr/0001-tech-stack.md`.
4. Create PRD v1 under `docs/product/PRD.md`.
5. Start implementation slice by slice:
   - Brand shell
   - Teacher onboarding
   - Organizer demand request
   - Demand pool
   - Class session
   - Enrollment
   - Teacher calendar
   - Admin dashboard
