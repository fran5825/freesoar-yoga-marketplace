# Approved Builder Prompt — Public Trust Pages

> Date: 2026-08-02
> Authority: Product owner approved P1-A through P5-A in `2026-08-01-public-trust-pages-plan.md`.
> This is an implementation authorization only. It does not authorize commit, push, deploy, legal-policy invention, payment work, or contact-address publication.

## Approved Task

Implement the V1 Public Trust Pages slice exactly as defined by `docs/superpowers/plans/2026-08-01-public-trust-pages-plan.md` and its 2026-08-02 Human Decision Record.

Deliver a mobile-first public shell and accurate Traditional Chinese public pages:

- Add `/about` and `/faq`.
- Refresh `/` into an honest Free Soar Yoga marketplace landing page.
- Use the same public header/footer on `/`, `/about`, `/faq`, `/teachers/join`, and `/organizers/request`.
- Correct root document language to `zh-Hant` and replace default metadata with accurate Free Soar Yoga metadata.
- Add targeted public-page smoke coverage and update the two named product docs to reflect what is actually implemented.

## Automation Level

- Level: L3 Builder
- Risk level: medium
- Human gate status: P1-A through P5-A approved; final public copy/visual review is still required before any deploy.

## Accepted Decisions

- Public copy follows the plan information architecture and may be drafted in Traditional Chinese, but must remain reviewable before deployment.
- Do not show a support email, placeholder contact address, company address, social account, Privacy Policy, Terms, or Cookie consent.
- FAQ may state only that the platform does not provide complete online payment/refund automation. Do not state payment methods, refund eligibility, timelines, fees, or cancellation policy.
- Do not add a generic cancellation FAQ.
- Explain organizer, teacher, and member roles, but show primary CTAs only for `/organizers/request` and `/teachers/join`.
- Do not claim or create a public class discovery/listing experience. A member may only be described as joining through an already-formed class sharing link.

## Allowed Files

```txt
src/app/page.tsx
src/app/layout.tsx
src/app/about/page.tsx                         (new)
src/app/faq/page.tsx                           (new)
src/app/_components/public-header.tsx          (new)
src/app/_components/public-footer.tsx          (new)
src/app/teachers/join/page.tsx
src/app/organizers/request/page.tsx
tests/smoke/public-trust-pages.spec.ts         (new)
docs/product/route-map.md
docs/product/current-functional-architecture.md
```

## Forbidden Files and Areas

```txt
prisma/**
src/domain/**
src/lib/auth/**
src/app/admin/**
src/app/member/**
src/app/teacher/** except src/app/teachers/join/page.tsx
src/app/organizer/** except src/app/organizers/request/page.tsx
package.json, package-lock.json, next.config.ts, playwright.config.ts
payment, refund, notification-delivery, Privacy/Terms/Cookie, CMS, analytics, AI matching, native mobile app, Wellness, Academy, Retreat
.env and all credentials
```

Do not modify existing smoke specs other than creating `tests/smoke/public-trust-pages.spec.ts`. Preserve unrelated dirty-worktree changes.

## Implementation Requirements

1. `PublicHeader` and `PublicFooter` must be synchronous, pure-presentational components: no hooks, effects, async behavior, server-only imports, or data queries. They must be safe to include in the existing client `/teachers/join` page.
2. Use semantic `header`, `nav`, `main`, and `footer`; retain a single logical `h1` per page and visible keyboard focus.
3. Prefer a wrapping link layout over a stateful hamburger menu. If a client-side mobile menu seems necessary, stop and report instead of expanding scope.
4. Make all public navigation links intentional: Home, About, FAQ, Teacher join, Organizer request, Sign in/My account. Do not add links to nonexistent public course discovery.
5. Keep existing teacher join form hydration, Server Actions, success/error states, and organizer entry actions unchanged.
6. FAQ must use only implemented or approved V1 capabilities. Native `<details>/<summary>` is acceptable and preferred if an accordion is needed.
7. Follow the brand rules: gentle, clear, spacious, trustworthy, professional; no medical/wellness efficacy claim, hard sell, discount-marketplace framing, or false trust claim.
8. Do not use external image assets in this slice.
9. Update product docs only to describe the actual implemented routes/public shell; do not mark deployment or legal policy as completed.

## Completion Criteria

- Anonymous users can visit `/`, `/about`, `/faq`, `/teachers/join`, and `/organizers/request`.
- All five pages show the same public navigation/footer contract.
- Home exposes only teacher and organizer primary CTAs.
- Metadata and root language are accurate.
- 360px, 390px, tablet, and desktop have no horizontal overflow.
- Existing teacher and organizer entry behavior remains intact.
- Docs match runtime routes and implementation status.

## Checks

```txt
npx playwright test tests/smoke/public-trust-pages.spec.ts
npx playwright test tests/smoke/teacher-join.spec.ts tests/smoke/organizer-demand.spec.ts
npx tsc --noEmit
npm run lint
npm run build
npm run test:smoke
```

Manual checks: desktop Chrome; 360×800 and 390×844; keyboard-only navigation; 200% zoom; long Traditional Chinese line wrapping; visual brand/copy pass. Do not deploy after the manual checks—report the preview/deploy review as pending.

## Stop Conditions

- Required change is outside Allowed Files.
- A CTA needs a missing core user flow or public class listing.
- Copy requires payment, refund, cancellation, legal, contact, medical, or wellness claims beyond Accepted Decisions.
- Implementation needs Auth, Prisma, role/permission, state-machine, payment, package, or config changes.
- Shared shell conflicts with the existing teacher client-page boundary.
- Concurrent dirty changes overlap an allowed file and cannot be preserved safely.
- Fixing a failed check requires scope expansion.

## Output Requirements

Output Report Requirement:
完成後請不要 commit / push，並回報：

1. Changed files
2. Full git diff
3. Checks result
4. Manual smoke result
5. Self review
6. Scope drift check：是否有任何超出本任務範圍的修改或判斷
7. Builder Review Packet，依 `docs/harness/builder-review-packet-template.md` 填寫完整 Common Handoff Schema

## No Commit / No Push Reminder

- Do not commit.
- Do not push.
- Do not deploy.
- Do not modify forbidden files.
- Do not expand scope beyond this approved prompt.

