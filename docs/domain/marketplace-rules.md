# Marketplace Rules

## Teacher Approval

- Teachers must be approved before responding to demand requests.
- Teacher public profile visibility depends on status.
- Admin can suspend teacher if needed.

## Demand Visibility

V1 default:

- Submitted demand requests are not immediately public.
- Admin reviews before publishing.
- Approved teachers can view published demand requests.
- Organizer sees own demand requests at all statuses.

## Demand Matching

- Teachers can respond to published demand requests.
- Organizer can select one teacher response in V1 (Admin does not participate in matching decisions; see `permissions-matrix.md` V1 落地範圍 note).
- Selected response can be converted into ClassSession.

## Class Formation

- A ClassSession requires teacher, organizer, service type, time, location, capacity.
- V1 ClassSession is created only from a matched DemandRequest.
- Teacher-created classes are future scope / non-V1.
- ClassSession can open for enrollment after required fields are complete.
- Public class detail/share link is allowed only when ClassSession is open_for_enrollment or confirmed and marked public.
- Enrollment must not exceed capacity.

## Calendar

- TeacherAvailability defines regular availability.
- AvailabilityException blocks or adds special availability.
- ClassSession must check teacher scheduling conflicts.
- V1 does not require Google Calendar two-way sync.

## Payment

- V1 may use inquiry/enrollment without full payment automation.
- PaymentIntent is a placeholder for future payment flow.
- Full refund automation is not V1 unless explicitly approved.
