# AGENTS.md

## Project

Free Soar Yoga is the first-phase marketplace product under the Free Soar master brand.

It is not a generic yoga website, a cold booking tool, or a discount course marketplace.
It is a brand-driven yoga group-class marketplace that helps organizers, yoga teachers, and members co-create high-quality body-mind practice experiences.

## Brand Constitution

The product must follow the Free Soar master brand spirit:

- Freedom 自由
- Awakening 覺醒
- Growth 成長
- Wellness 身心整合
- Leadership 自主人生
- Community 共創社群

The product should feel:

- Gentle
- Clear
- Spacious
- Trustworthy
- Professional
- Feminine
- Modern spiritual
- Technology-enabled but human-centered

## V1 Product Definition

Free Soar Yoga V1 is a yoga group-class marketplace for:

- Organizers / group leaders
- Yoga teachers
- Members / students
- Platform admins

V1 enables:

- Organizers to create group-class demand requests
- Teachers to create profiles and manage availability
- Teachers to view and respond to demand requests
- Organizers to select teachers and form class sessions
- Members to enroll in class sessions
- Admins to manage teachers, demands, classes, enrollments, and basic reporting

## V1 Scope

Must include:

- Brand landing pages
- Teacher onboarding
- Teacher profile
- Teacher availability calendar
- Organizer demand request
- Demand pool
- Teacher response
- Class session
- Enrollment
- Admin dashboard
- Email notification
- RWD / mobile-first support

Must not include in V1 unless explicitly approved:

- Native mobile app
- Advanced AI recommendation
- Full payment/refund automation
- Google Calendar two-way sync
- LINE deep integration
- Advanced enterprise permissions
- Wellness / Academy / Retreat full modules
- Complex gamification
- Full SaaS tools for teachers

## Tech Stack

Default preferred stack:

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma or Drizzle
- Auth.js / Supabase Auth / Clerk
- Resend
- Vercel
- Playwright
- Vitest

Architecture principles:

- Keep marketplace business logic out of page components.
- Use service/domain layers for state transitions and permission checks.
- Keep UI components reusable and mobile-first.
- Document data model, permissions, and state machines before major implementation.
- Preserve App-ready architecture by keeping APIs and domain logic clear.

## Development Workflow

Every non-trivial feature must follow:

1. spec
2. plan
3. build
4. test
5. review
6. ship

Use relevant agent-skills workflows when available:

- spec-driven-development
- planning-and-task-breakdown
- incremental-implementation
- frontend-ui-engineering
- api-and-interface-design
- test-driven-development
- debugging-and-error-recovery
- code-review-and-quality
- security-and-hardening
- documentation-and-adrs
- ci-cd-and-automation
- shipping-and-launch

## Documentation Rules

For the docs system under `docs/`:

- File names and folder names must use English kebab-case for tool compatibility, URLs, Git diffs, and developer collaboration.
- Route names, component names, function names, model names, schema names, and code identifiers must use English.
- Document content should be written in Traditional Chinese by default, because the product owner reviews and decides in Chinese.
- Technical terms can remain in English when clearer, including marketplace, dashboard, route, permission, state machine, API, service layer, MVP, RWD, and mobile-first.
- Document titles can be English or bilingual, but explanatory content should be primarily Traditional Chinese.
- If a document must include English content for code, identifiers, third-party service names, or external references, add Chinese explanation around it.
- Do not rename existing docs only to translate file names into Chinese.
- Do not translate programmatic names into Chinese because docs content is Chinese; code and system naming remain English.
- When architecture, product behavior, permissions, state machines, or scope changes, update the related Chinese docs in the same change.

## Quality Gates

Before merge:

- TypeScript passes
- ESLint passes
- Build passes
- Unit tests pass for changed logic
- E2E smoke tests pass for key user flows
- Role permissions reviewed
- Marketplace state transitions reviewed
- Brand consistency reviewed
- RWD/mobile review completed
- App-readiness boundary not violated

## Required Self Review

After any docs or code modification, Codex must run a lightweight self review before reporting completion.

Codex must report:

- Which files were changed.
- Whether the change stays within V1 scope.
- Whether it avoids adding Wellness / Academy / Retreat modules, AI matching, complex payment/refund automation, or a native mobile app.
- Whether it remains consistent with the role model, permissions, state machines, data model, and route map.
- Whether there are security, RWD, or brand consistency concerns.
- Whether any product owner decision is required.
- Whether any unrelated files were modified.
- Whether Codex did not auto commit or push.

Codex self review is the first guardrail, not the final product decision.

Any decision that affects Auth, Prisma schema, role / permission model, marketplace state machines, V1 scope, or core user flows requires product owner confirmation.

Codex must not commit or push unless the product owner explicitly asks for it.

## AI Rules

- Do not overbuild beyond V1.
- Do not change the data model without explaining impact.
- Do not change marketplace state machines without updating docs.
- Do not change permissions without security review.
- Do not implement payment unless explicitly requested.
- Do not auto-publish generated content.
- Do not remove brand context.
- Always update docs when architecture or product behavior changes.
- For uncertain product decisions, create options and tradeoffs instead of silently choosing.
