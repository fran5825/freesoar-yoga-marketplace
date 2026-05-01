# ADR 0001: Initial Tech Stack

## Status

Draft

## Decision

Use a modern web stack suitable for a brand-driven marketplace:

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

## Rationale

This stack supports:

- SEO-friendly marketing pages
- Marketplace workflows
- Dashboard UI
- Strong typing
- AI-assisted development
- Future API/app readiness
- RWD/mobile-first web experience

## Consequences

- Must manage data model and permissions carefully.
- Must keep business logic out of page components.
- Must document state machines and permissions.
- Must use CI/CD and test gates to avoid AI-generated regressions.
