# Data Model

This is the initial marketplace domain model.

## User

Represents all authenticated users.

Suggested fields:

- id
- name
- email
- phone
- isAdmin
- createdAt
- updatedAt

Role model:

- User is the base account.
- All authenticated users have basic Member capabilities.
- Teacher capabilities are enabled by TeacherProfile.
- Organizer capabilities are enabled by OrganizerProfile.
- Admin is a platform management permission, represented by isAdmin or an equivalent admin permission model.
- V1 does not limit one user to only one identity.

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

Phase 1 schema notes:

- `TeacherProfile` 是 Teacher capability 的基礎資料，不代表老師已可回應需求。
- 能否回應 demand request 仍必須檢查 `status = approved`。
- Prisma schema 允許 draft profile 先保存部分欄位；submit application 時由 server-side validation 要求必要欄位完整。
- `displayName`、`bio`、`teachingStyle`、`experienceYears`、`specialties`、`serviceAreas`、`teachingFormats` 是 submit application 的必要欄位。
- `certifications`、`priceRange`、`profilePhotoUrl` 是 Phase 1 建議欄位，可留空。
- `specialties`、`serviceAreas`、`teachingFormats`、`certifications` 在 schema 中以 string list 表示，讓 Phase 1 不需要額外建立分類表或複雜 taxonomy。
- 老師聯絡電話在 V1 使用 `User.phone`，不在 `TeacherProfile` 重複存放。

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
- expired

## ClassSession

Represents a class session created from a matched demand request in V1.

Teacher-created classes are future scope / non-V1.

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
- isPublic
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
