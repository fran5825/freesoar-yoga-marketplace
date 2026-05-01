# App-ready Architecture

V1 does not build a native app, but should preserve future app readiness.

## Principles

- Do not put business logic only in page components.
- Keep marketplace domain logic in services/modules.
- Keep permission logic reusable.
- Keep state machines documented.
- Keep notification model independent of UI.
- Keep API/service boundaries clear.
- Use shared validation schemas where possible.

## Future App Options

- PWA after web MVP stabilizes
- React Native / Expo after strong product-market signal
- Shared API/domain layer for web and app

## App-readiness Gate

When building new features, ask:

- Could this logic be reused by a mobile app?
- Is the auth/session assumption web-only?
- Is the notification model future-ready?
- Are API boundaries clear enough?
