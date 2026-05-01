# ADR 0003: Auth and Roles

## Status

Draft

## Decision

Use role-based access control for:

- MEMBER
- ORGANIZER
- TEACHER
- ADMIN

## Rationale

The marketplace requires clear boundaries between organizer data, teacher data, member enrollments, and admin management.

## Open Questions

- Which auth provider will be used?
- Should organizer and teacher roles be allowed on same user?
- Should teacher approval be separate from user role?
