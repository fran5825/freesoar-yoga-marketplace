# Free Soar Yoga PRD

## 1. Product Overview

Free Soar Yoga 是 Free Soar 飛索主品牌下的第一階段 marketplace 產品。

V1 的核心是「品牌驅動的瑜伽團課 marketplace」：讓團主提出團體瑜伽課需求，讓已審核的瑜伽老師回應合適機會，讓團員可以報名形成的 class session，並讓 Admin 維持平台品質、資料安全與基本營運秩序。

Free Soar Yoga 不是一般瑜伽網站、不是折扣課程平台、不是冷冰冰的 booking tool，也不是完整 Free Soar Life Platform。V1 只聚焦在瑜伽團課 marketplace 的必要流程。

## 2. Goals

- 建立 Free Soar Yoga 的品牌型 marketplace 入口。
- 支援團主建立 demand request，清楚描述團課需求。
- 支援老師建立 profile、設定 availability，並回應已發布的需求。
- 支援團主從回覆中選擇老師，形成 class session。
- 支援會員報名 class session。
- 支援 Admin 審核老師、需求、課程與報名，維持品質與安全。
- 支援 basic email notification，讓重要狀態變更可被追蹤。
- 建立 mobile-first 的使用體驗，讓團主、老師與會員在手機上也能完成核心流程。

## 3. Non-goals

V1 不做以下內容，除非另行明確核准：

- Native mobile app
- Advanced AI matching / recommendation
- Full payment / refund automation
- Google Calendar two-way sync
- LINE deep integration
- Advanced enterprise permissions
- Wellness / Academy / Retreat 完整模組
- Teacher SaaS business tools
- Complex gamification
- Advanced analytics dashboard
- Microservices、Kubernetes、event sourcing

## 4. Personas

### Visitor

尚未登入的訪客，主要需求是理解 Free Soar Yoga 是什麼、是否可信任、是否適合自己加入或提出需求。

### Member

想參加瑜伽團課的學員。需要清楚看見課程資訊、報名狀態與基本通知。

### Organizer

公司社團、福委會、社區、家庭或小型團體的組織者。需要用簡單、安心、不官僚的方式提出團課需求，並從老師回覆中做選擇。

### Teacher

瑜伽老師。需要建立可信任的 profile，設定可授課時間，找到合適的團課機會，並回應需求。

### Admin

平台管理者。需要審核老師與需求，管理 class session、enrollment 與基本 KPI，確保 marketplace 品質與資料邊界。

## 5. Core User Flows

### Teacher Onboarding

老師進入 teacher join page，提交申請資料與 profile 草稿。Admin 審核後，老師狀態變為 approved，才可看見 eligible demand requests 並回應。

### Organizer Demand Request

團主建立 organization / organizer profile，填寫團課需求。需求送出後由 Admin review，通過後發布到 demand pool。

### Demand Response and Matching

已審核老師看見 published demand request，提交 response。團主查看自己需求收到的 responses，shortlist 或 select 老師。V1 一個 demand 只選一位老師。

### Class Session and Enrollment

被選中的 response 可轉成 class session。課程資料完整後開放 enrollment。會員報名時必須遵守 capacity 與不可重複報名規則。

### Admin Review Workflow

Admin 審核老師、需求、課程與報名，處理 publish、reject、suspend、cancel 等狀態變更，必要時留下 admin note。

## 6. Feature List

### Public / Marketing

- Home page
- Brand introduction
- Yoga marketplace entry
- Teacher join page
- Organizer demand request entry
- FAQ / trust pages

### Teacher

- Teacher application
- Teacher profile
- Teacher dashboard
- Teacher availability calendar
- Demand pool view
- Demand response
- Assigned / accepted class session view

### Organizer

- Organizer profile
- Organization basic profile
- Demand request creation
- Own demand request list
- Teacher response review
- Teacher selection
- Own class session basics

### Member

- Public class session view
- Enrollment creation
- Own enrollment status view
- Enrollment cancellation if policy allows

### Admin

- Teacher approval
- Demand review and publishing
- Class session management
- Enrollment management
- Basic KPIs
- Admin notes

### Notification

- Demand submitted
- Demand published / rejected
- Teacher response submitted
- Teacher selected
- Class session created
- Enrollment confirmed
- Basic class reminder

## 7. Page List

Public pages:

- `/`
- `/about`
- `/teachers/join`
- `/organizers/request`
- `/classes`
- `/classes/[classSessionId]`
- `/faq`

Auth pages:

- `/sign-in`
- `/sign-up`
- `/account`

Teacher pages:

- `/teacher/dashboard`
- `/teacher/profile`
- `/teacher/availability`
- `/teacher/demands`
- `/teacher/classes`

Organizer pages:

- `/organizer/dashboard`
- `/organizer/profile`
- `/organizer/demands`
- `/organizer/demands/new`
- `/organizer/demands/[demandRequestId]`
- `/organizer/classes`

Member pages:

- `/member/dashboard`
- `/member/enrollments`

Admin pages:

- `/admin/dashboard`
- `/admin/teachers`
- `/admin/demands`
- `/admin/classes`
- `/admin/enrollments`
- `/admin/organizations`

實際 route 可在實作前依 Next.js App Router 慣例微調，但命名必須維持英文。

## 8. Data Model Summary

V1 核心資料模型包含：

- `User`
- `TeacherProfile`
- `OrganizerProfile`
- `Organization`
- `ServiceType`
- `TeacherAvailability`
- `AvailabilityException`
- `DemandRequest`
- `DemandResponse`
- `ClassSession`
- `Enrollment`
- `Notification`
- `AdminNote`

`PaymentIntent` 與 `Review` 可保留為未來擴充概念，但 V1 不實作完整金流與複雜評價系統，除非另行核准。

## 9. Permissions Summary

- Visitor 只能看公開資料與送出允許的公開表單。
- Member 只能管理自己的 enrollment。
- Organizer 只能管理自己的 organization、demand request、class session roster basics。
- Teacher 只能管理自己的 teacher profile、availability、responses 與 class sessions。
- Admin 可管理平台核心資料，但 admin actions 必須受保護並可被審查。

詳細權限以 `docs/domain/permissions.md` 與 `docs/domain/permissions-matrix.md` 為準。

## 10. Acceptance Criteria

- 使用者可以理解 Free Soar Yoga 的品牌定位與 marketplace 入口。
- Teacher 可以完成申請，Admin 可以審核。
- Approved Teacher 可以看 published demand requests 並提交 response。
- Organizer 可以建立 demand request，並查看自己需求收到的 responses。
- Organizer 或 Admin 可以選擇一位 teacher response。
- Matched demand 可以形成 class session。
- Member 可以報名可開放報名的 class session。
- Enrollment 不可超過 capacity，且同一會員不可重複報名同一課程。
- Admin 可以管理 teacher、demand、class session、enrollment。
- 重要流程有 basic email notification。
- Mobile 360px、390px、tablet、desktop 版面可用。

## 11. Risks

- 權限邊界不清會造成 organizer、teacher、member 私人資料外洩。
- DemandRequest 與 ClassSession 狀態流轉若不明確，可能造成課程資料不一致。
- Teacher approval 若被繞過，會破壞平台品質與信任。
- V1 若加入太多 future modules，會拖慢核心 marketplace 驗證。
- 品牌語氣若偏低價或過度商業，會偏離 Free Soar 主品牌。

## 12. Launch Criteria

- TypeScript、ESLint、build、unit tests 通過。
- 主要 user flows 有 E2E smoke test。
- Teacher approval、demand publishing、enrollment capacity、admin routes 完成 security review。
- Public pages 完成 brand review。
- Mobile-first RWD review 完成。
- Preview deploy 檢查完成。
- Release checklist 完成。
