# Data Model

This is the initial marketplace domain model.

## User

Represents all authenticated users.

Suggested fields:

- id
- name
- email
- phone
- role
- createdAt
- updatedAt

Possible roles:

- MEMBER
- ORGANIZER
- TEACHER
- ADMIN

## TeacherProfile

Represents a yoga teacher.

Fields:

- id
- userId
- displayName
- bio
- teachingStyle
- experienceYears
- certifications
- specialties
- serviceAreas
- teachingFormats
- priceRange
- profilePhotoUrl
- status
- createdAt
- updatedAt

Status:

- draft
- submitted
- approved
- rejected
- suspended

## OrganizerProfile

Represents a group leader / organizer.

Fields:

- id
- userId
- organizationId
- title
- phone
- createdAt
- updatedAt

## Organization

Represents a company, club, community, or group.

Fields:

- id
- name
- type
- area
- address
- contactName
- contactEmail
- contactPhone
- createdAt
- updatedAt

Type:

- company
- company_club
- community
- family_group
- other

## ServiceType

Represents yoga/class type.

Fields:

- id
- name
- description
- category
- isActive

Examples:

- Hatha Yoga
- Yin Yoga
- Stretch Yoga
- Breathwork
- Corporate Relaxation Yoga
- Beginner Yoga
- Parent-child Yoga

## TeacherAvailability

Represents regular availability.

Fields:

- id
- teacherProfileId
- dayOfWeek
- startTime
- endTime
- locationArea
- isRecurring
- createdAt
- updatedAt

## AvailabilityException

Represents blocked or special availability.

Fields:

- id
- teacherProfileId
- date
- startTime
- endTime
- type
- reason

Type:

- blocked
- extra_available

## DemandRequest

Represents an organizer's group-class demand request.

Fields:

- id
- organizerProfileId
- organizationId
- title
- serviceTypeId
- description
- targetLevel
- expectedParticipants
- preferredAreas
- preferredTimeSlots
- preferredStartDate
- classLengthMinutes
- frequency
- budgetRange
- status
- createdAt
- updatedAt

## DemandResponse

Represents a teacher's response to a demand request.

Fields:

- id
- demandRequestId
- teacherProfileId
- message
- proposedPrice
- proposedTimeSlots
- status
- createdAt
- updatedAt

Status:

- submitted
- shortlisted
- selected
- declined
- withdrawn

## ClassSession

Represents a class session created from a demand request or teacher-created class.

Fields:

- id
- demandRequestId
- teacherProfileId
- organizerProfileId
- organizationId
- title
- description
- serviceTypeId
- startAt
- endAt
- location
- capacity
- status
- createdAt
- updatedAt

## Enrollment

Represents member enrollment in a class session.

Fields:

- id
- classSessionId
- userId
- status
- notes
- createdAt
- updatedAt

## PaymentIntent

Placeholder for future payment support.

Fields:

- id
- enrollmentId
- amount
- currency
- status
- provider
- providerRef
- createdAt
- updatedAt

## Review

Represents review after class.

Fields:

- id
- classSessionId
- reviewerUserId
- teacherProfileId
- rating
- comment
- visibility
- createdAt

## Notification

Represents notification record.

Fields:

- id
- userId
- type
- channel
- title
- body
- status
- createdAt
- sentAt

## AdminNote

Internal admin note.

Fields:

- id
- entityType
- entityId
- adminUserId
- note
- createdAt
