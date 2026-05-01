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
| `contactPhone` | 是 | 聯絡電話，僅限管理與媒合必要使用 |

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

| Field | 必填 | 說明 |
|---|---|---|
| `organizationName` | 是 | 組織或團體名稱 |
| `organizationType` | 是 | company、company_club、community、family_group、other |
| `contactName` | 是 | 聯絡人 |
| `contactEmail` | 是 | 聯絡 email |
| `contactPhone` | 是 | 聯絡電話 |
| `title` | 是 | 需求標題 |
| `serviceTypeId` | 是 | 希望課程類型 |
| `description` | 是 | 團體需求描述 |
| `targetLevel` | 是 | 初學、一般、進階或混合 |
| `expectedParticipants` | 是 | 預估人數 |
| `preferredAreas` | 是 | 偏好地區 |
| `preferredTimeSlots` | 是 | 偏好時段 |
| `preferredStartDate` | 建議 | 希望開始日期 |
| `classLengthMinutes` | 是 | 每堂課長 |
| `frequency` | 是 | 單堂、每週、雙週等 |
| `budgetRange` | 建議 | 預算區間 |

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
| `serviceTypeId` | 是 | 課程類型 |
| `startAt` | 是 | 開始時間 |
| `endAt` | 是 | 結束時間 |
| `location` | 是 | 地點 |
| `capacity` | 是 | 名額上限 |

## Enrollment Form

| Field | 必填 | 說明 |
|---|---|---|
| `classSessionId` | 是 | 報名課程 |
| `notes` | 否 | 會員備註，例如身體狀況提醒；不可要求醫療診斷 |

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
