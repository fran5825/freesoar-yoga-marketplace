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

### 已核准・未實作：多團體與需求表單（organizer-usability-redesign 票 03–04）

- **首次建立**（`/organizer/profile`）：同一頁分「你是誰」「第一個團體」「聯絡方式」三區，姓名與 email 預填；顯示名稱與聯絡窗口預設同步，手動改聯絡人後停止同步。第一個團體的 `contactName`／`contactEmail`／`contactPhone` 必填，與團主資料在同一個 transaction 建立。
- **我的團體**（`/organizer/organizations`）：欄位同上方 `organization*` 與 `contact*`。之後新增的團體可以先存未完整的資料，但用它送出需求或合作邀請前必須補齊。
- **需求表單**新增 `organizationId`（必填，只能選自己擁有的團體，只有一個時預選）。草稿可以換團體；已送出的需求不能換。其餘需求欄位與驗證規則不變。
- 驗證失敗或存檔失敗都保留輸入；「存草稿」與「送出審核」是兩個按鈕；第一次存檔後網址轉到含 ID 的 edit 頁。

## Organizer Class Proposal Form（已核准・未實作）

organizer-usability-redesign 票 05–08。「我已有合作老師」路徑使用，單頁分「團體與老師」「課程安排」「招募設定」三區。草稿可以部分空白；送出邀請或本人確認授課時，以下標「送出時必填」的欄位必須完整。長度與範圍沿用 Class Session Form。

| Field | 必填 | 說明 |
|---|---|---|
| `organizationId` | 送出時必填 | 自己擁有的團體；聯絡資料必須完整；送出後不能改 |
| `teacherProfileId` | 送出時必填 | 從 approved 老師名片選擇（只顯示公開名稱、擅長類型、服務地區、照片）；本人是 approved 老師時可選自己 |
| `title` | 送出時必填 | 課程名稱（≤200 字） |
| `serviceTypes` | 送出時必填 | 課程風格，最多 3 項，受控清單 |
| `yogaStyles` | 否 | 瑜伽類型；團主課程不強制 |
| `startAt`／`endAt` | 送出時必填 | 以 Asia/Taipei 輸入與顯示；必須在未來，結束晚於開始 |
| `location` | 送出時必填 | 地點（≤200 字） |
| `capacity` | 送出時必填 | 名額（1–500） |
| `description` | 否 | 課程說明（≤2000 字） |
| `isPublic` | 否 | 預設 false＝僅透過連結招募；勾選才出現在公開課程列表。說明連結可以轉傳，不代表限定公司或社團成員 |

- 送出前的確認畫面顯示團體、老師、時間，以及送出後會發生什麼（通知老師、等老師確認，還沒開放報名）。
- 老師婉拒時填 `declineReason`（必填，1–500 字）；團主撤回時可填 `withdrawReason`（選填，≤500 字）。

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

**已核准・未實作（organizer-usability-redesign 票 11）**：團主從已媒合需求成立課程時，表單可以預先帶入需求裡能確定的已存欄位（標題、地點、人數、說明、課程風格），由團主確認後送出；偏好時段與頻率只是偏好，不會被帶成正式的開始時間或整期安排。

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
