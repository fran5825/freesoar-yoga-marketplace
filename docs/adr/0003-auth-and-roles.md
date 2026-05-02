# ADR 0003: Auth and Roles

## Status

Draft

## Decision

Use a capability-based access model:

- User is the base account.
- All authenticated users have basic Member capabilities.
- Teacher capabilities are enabled by TeacherProfile.
- Organizer capabilities are enabled by OrganizerProfile.
- Admin is a platform management permission.
- V1 does not limit one user to only one identity.

## Rationale

The marketplace requires clear boundaries between organizer data, teacher data, member enrollments, and admin management.

The capability model supports real users who may both organize, teach, or enroll in classes with the same account, while still keeping permission checks explicit.

## Open Questions

- Which auth provider will be used?
- What admin permission representation should be used in implementation?
- Should TeacherProfile and OrganizerProfile onboarding be available from the same account settings area?
