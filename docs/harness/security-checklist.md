# Security Checklist

## Auth

- Are protected pages behind auth?
- Are admin pages admin-only?
- Are teacher pages teacher-only where needed?
- Are organizer dashboards scoped to the organizer?

## Data Access

- Can users only access their own private data?
- Can teachers only see eligible demands?
- Can organizers only see their own demand responses?
- Can members only see their own enrollments?

## Forms

- Server-side validation present?
- Client-side validation helpful but not trusted?
- Inputs sanitized where needed?
- File uploads restricted if implemented?

## Admin

- Admin actions logged if possible?
- Destructive actions confirm?
- Status changes validated?

## Secrets

- No secrets in repo
- `.env` ignored
- API keys not exposed to client
