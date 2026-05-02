# Permissions

## Permission Principles

- Users can only access their own private data unless role permits otherwise.
- Admin can access all management data.
- Teachers only see eligible demand requests.
- Organizers only manage their own demands/classes.
- Members only manage their own enrollments.
- User is the base account, and every authenticated user has basic Member capabilities.
- Teacher capabilities are enabled by TeacherProfile.
- Organizer capabilities are enabled by OrganizerProfile.
- Admin is a platform management permission.
- V1 does not restrict one user to only one identity.

## Visitor

Can:

- View public marketing pages
- View public teacher profile if enabled
- View public class session if enabled
- Submit public forms if allowed

Cannot:

- Access dashboards
- Enroll without required identity flow
- View private demand requests

## Member

Can:

- View own profile
- Enroll in class sessions
- View own enrollments
- Cancel own enrollment if policy allows

Cannot:

- Manage demand requests
- Respond as teacher
- View other members' private data

## Organizer

Can:

- Create demand requests
- View own demand requests
- Edit own draft/submitted demand requests if allowed
- View teacher responses to own demand requests
- Manage own class roster basics
- Enroll in class sessions only through the same User's Member capability

Cannot:

- See other organizers' private demand requests
- Approve teachers
- Modify teacher profiles
- Manage platform-wide data

## Teacher

Can:

- Edit own teacher profile
- Set own availability
- View published/eligible demand requests
- Respond to eligible demand requests
- View own class sessions
- View own calendar
- Enroll in class sessions only through the same User's Member capability

Cannot:

- View private organizer data unless tied to a matched demand/class
- Manage enrollments outside own class sessions
- Approve self
- Access admin dashboard

## Admin

Can:

- Approve/reject/suspend teachers
- Review/publish/reject demand requests
- Manage class sessions
- Manage enrollments
- View basic KPIs
- Add admin notes

## Security Review Required

Security review required when changing:

- Auth
- Roles
- Permissions
- Demand visibility
- Admin actions
- Teacher approval
- Enrollment capacity
- Payment-related code
