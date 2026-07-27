# Form Field Spec

## 目的

本文件整理 Free Soar Yoga V1 主要表單欄位。實作前可依此拆成 validation schema 與 UI form spec。

所有欄位命名在程式中使用英文；文件說明以繁體中文為主。

## 共通表單原則

- 表單要 mobile-first。
- 必填欄位要清楚。
- 錯誤訊息要溫和、具體、可修正。
- Client-side validation 可提升體驗，但 server-side validation 才是權限與資料正確性的依據。
- 不收集 V1 不需要的敏感資料。

## Teacher Application Form

| Field | 必填 | 說明 |
|---|---|---|
| `displayName` | 是 | 老師公開顯示名稱 |
| `bio` | 是 | 老師簡介 |
| `teachingStyle` | 是 | 教學風格 |
| `experienceYears` | 是 | 教學年資 |
| `certifications` | 建議 | 證照或訓練背景 |
| `specialties` | 是 | 擅長類型 |
| `serviceAreas` | 是 | 可服務區域 |
| `teachingFormats` | 是 | 到場、線上或其他形式；V1 以實體團課優先 |
| `priceRange` | 建議 | 參考收費區間 |
| `profilePhotoUrl` | 建議 | 老師照片 |

老師聯絡電話在 V1 使用 `User.phone`，不在 `TeacherProfile` 重複存 phone。未來若需要公開電話，再另設 `publicContactPhone`，不放入 V1。

### Teacher Application Form to Model Mapping

| Form Field | Model Field | Phase 1 validation |
|---|---|---|
| `displayName` | `TeacherProfile.displayName` | submit 時必填 |
| `bio` | `TeacherProfile.bio` | submit 時必填 |
| `teachingStyle` | `TeacherProfile.teachingStyle` | submit 時必填 |
| `experienceYears` | `TeacherProfile.experienceYears` | submit 時必填 |
| `certifications` | `TeacherProfile.certifications` | 建議，可留空 |
| `specialties` | `TeacherProfile.specialties` | submit 時至少一項 |
| `serviceAreas` | `TeacherProfile.serviceAreas` | submit 時至少一項 |
| `teachingFormats` | `TeacherProfile.teachingFormats` | submit 時至少一項 |
| `priceRange` | `TeacherProfile.priceRange` | 建議，可留空 |
| `profilePhotoUrl` | `TeacherProfile.profilePhotoUrl` | 建議，可留空 |

`TeacherProfile` 在 `draft` 狀態可保存未完成資料；送出審核時才要求上述必要欄位完整。這讓 schema 支援草稿，同時不降低 submitted application 的資料品質。

## Teacher Availability Form

| Field | 必填 | 說明 |
|---|---|---|
| `dayOfWeek` | 是 | 星期 |
| `startTime` | 是 | 可授課開始時間 |
| `endTime` | 是 | 可授課結束時間 |
| `locationArea` | 是 | 可授課地區 |
| `isRecurring` | 是 | 是否固定重複 |

Exception 欄位：

| Field | 必填 | 說明 |
|---|---|---|
| `date` | 是 | 例外日期 |
| `startTime` | 是 | 例外開始時間 |
| `endTime` | 是 | 例外結束時間 |
| `type` | 是 | `blocked` 或 `extra_available` |
| `reason` | 否 | 備註 |

## Organizer Demand Request Form

`organizer-demand-request-foundation` 已確認：此處欄位實際分兩個畫面收集（見 `docs/product/route-map.md`），不是單一表單：`organizationName`/`organizationType`/`contactName`/`contactEmail`/`contactPhone` 屬 organizer capability bootstrap，於 `/organizer/profile` 收集並保存到 `OrganizerProfile`/`Organization`；其餘 demand 專屬欄位於 `/organizer/demands/new`（或續編用的 `/organizer/demands/[id]/edit`）收集並保存到 `DemandRequest`。下表仍合併列出以呈現完整資料需求，但欄位分屬不同 model／畫面。

| Field | 必填 | 說明 |
|---|---|---|
| `organizationName` | 是 | 組織或團體名稱 |
| `organizationType` | 是 | company、company_club、community、family_group、other |
| `contactName` | 是 | 聯絡人 |
| `contactEmail` | 是 | 聯絡 email |
| `contactPhone` | 是 | 聯絡電話 |
| `title` | 是 | 需求標題（5–100 字） |
| `serviceType` | 是 | 希望課程類型，須落在 V1 定案的受控清單（見 `docs/domain/data-model.md` ServiceType 節） |
| `description` | 是 | 團體需求描述（20–2000 字） |
| `targetLevel` | 是 | 初學、一般、進階或混合 |
| `expectedParticipants` | 是 | 預估人數（1–500） |
| `preferredAreas` | 是 | 偏好地區，自由輸入，至少一項，最多 10 項、單項 ≤50 字 |
| `preferredTimeSlots` | 是 | 偏好時段，至少一項，須落在受控清單內 |
| `preferredStartDate` | 建議 | 希望開始日期，若填寫須為今日以後 |
| `classLengthMinutes` | 是 | 每堂課長（30–240 分鐘） |
| `frequency` | 是 | 單堂（`single`）、每週（`weekly`）、雙週（`biweekly`）、每月（`monthly`），V1 不含 `other` |
| `budgetRange` | 建議 | 預算區間；brand 提醒勿過度強調價格 |

`contactName`/`contactEmail`/`contactPhone` 在 Prisma schema 層級為 nullable（`String?`，migration additive-safe 考量），必填規則由 application-layer 在 `DemandRequest` submit 時驗證所連 `Organization` 是否已補齊，而非表單當下的資料庫約束。

### Organizer Form to Model Mapping

| Form Field | Model Field |
|---|---|
| `organizationName` | `Organization.name` |
| `organizationType` | `Organization.type` |
| `contactName` | `Organization.contactName` |
| `contactEmail` | `Organization.contactEmail` |
| `contactPhone` | `Organization.contactPhone` |
| `title` | `DemandRequest.title` |
| `serviceType` | `DemandRequest.serviceType` |
| `description` | `DemandRequest.description` |
| `targetLevel` | `DemandRequest.targetLevel` |
| `expectedParticipants` | `DemandRequest.expectedParticipants` |
| `preferredAreas` | `DemandRequest.preferredAreas` |
| `preferredTimeSlots` | `DemandRequest.preferredTimeSlots` |
| `preferredStartDate` | `DemandRequest.preferredStartDate` |
| `classLengthMinutes` | `DemandRequest.classLengthMinutes` |
| `frequency` | `DemandRequest.frequency` |
| `budgetRange` | `DemandRequest.budgetRange` |

## Demand Response Form

| Field | 必填 | 說明 |
|---|---|---|
| `message` | 是 | 老師給團主的回覆 |
| `proposedPrice` | 建議 | 老師建議價格 |
| `proposedTimeSlots` | 是 | 老師可配合時段 |

## Class Session Form

| Field | 必填 | 說明 |
|---|---|---|
| `title` | 是 | 課程名稱 |
| `description` | 建議 | 課程說明 |
| `serviceType` | 是 | 課程類型 |
| `startAt` | 是 | 開始時間 |
| `endAt` | 是 | 結束時間 |
| `location` | 是 | 地點 |
| `capacity` | 是 | 名額上限 |
| `isPublic` | 否 | 是否允許公開 class detail / share link；預設 false |

## Enrollment Form

| Field | 必填 | 說明 |
|---|---|---|
| `classSessionId` | 是 | 報名課程 |
| `notes` | 否 | 會員備註，例如身體狀況提醒；不可要求醫療診斷 |
| `basicConsent` | 是 | 我了解此課程非醫療行為，會依自身身體狀況參與。 |

V1 不收集醫療資料，不做健康問卷。

## Admin Review Form

| Field | 必填 | 說明 |
|---|---|---|
| `decision` | 是 | approve、reject、publish、suspend、cancel 等 |
| `reason` | 視情況 | 拒絕、暫停或取消時建議填寫 |
| `adminNote` | 否 | 內部備註 |

## V1 不收集

- 身分證字號
- 信用卡資料
- 醫療診斷資料
- 不必要的公司內部敏感資料
- 與瑜伽團課媒合無關的私人資訊
