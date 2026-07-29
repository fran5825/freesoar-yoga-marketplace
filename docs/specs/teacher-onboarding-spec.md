# Teacher Onboarding Spec

## 目的

Teacher onboarding 讓瑜伽老師可以加入 Free Soar Yoga，建立可信任的 teacher profile，並經由 Admin approval 後進入 marketplace。

V1 的重點是品質、信任與清楚流程，不是讓老師建立完整 SaaS 型個人商店。

## 落地現況（2026-07-29 更新）

本 spec 的「State Transitions」／「TeacherProfile Status Definitions」／「Admin Action Matrix」三節描述的是完整設計，直到 `docs/superpowers/plans/2026-07-29-teacher-profile-suspension-plan.md` 之前，`approved → suspended`（暫停）與 `suspended → approved`（恢復）都**沒有真正落地**——整個 repo 沒有任何程式碼會把 `TeacherProfile.status` 寫成 `suspended`（已逐字 `grep` 確認），即使下方第 111 行的既有敘述聽起來像是只差 restore 沒做。這件事本輪已經澄清並補上：

- **已出貨**：`approved → suspended` 與 `suspended → approved` 一起接線（Admin-only）。暫停必填 `suspensionReason`（新增獨立欄位，不與 `rejectionReason` 共用，trim 後 10–1000 字），恢復時清空。兩者都在 `/admin/teachers` 頁面落地（新增「Approved teachers」／「Suspended teachers」兩個區塊）；Teacher dashboard 的既有 `suspended` 文案（早就寫好，只是從未觸發過）現在會正確顯示，並新增顯示 `suspensionReason` 的區塊。
- **連帶影響**：暫停**不**回溯處理該老師已經 `selected` 的 response 或已經建立的 `ClassSession`；但 `selectDemandResponseForOrganizer`（`demand-response-and-matching-spec.md` 範圍）新增了 teacher 資格檢查，暫停後 Organizer 無法再選定這位老師既有、還沒被選定的 `submitted` response。
- **通知**：新增 `teacher_profile_suspended`／`teacher_profile_restored` 兩個 `NotificationType`（原始事件表沒有規劃過，真的跑了 migration），只通知 Teacher 自己。
- 不動下方第 88–121 行的既有敘述本身——那些描述的是這一輪之前的既有設計狀態，仍然正確，只是在本輪之前從未真正落地。

## User Role

主要角色：

- Visitor
- Teacher
- Admin

## Problem

Free Soar Yoga 需要確保進入 demand pool 的老師具備基本可信任資訊，並符合品牌精神與團課服務期待。

若沒有審核流程，團主與會員的信任感會下降；若流程太複雜，老師加入意願會下降。

## User Flow

1. Visitor 進入 `/teachers/join`。
2. Visitor 了解 Free Soar Yoga 對老師的定位與合作方式。
3. Visitor 註冊或登入。
4. Teacher 填寫 teacher application form。
5. Teacher 儲存 draft 或 submit application。
6. 系統建立或更新 `TeacherProfile`。
7. Admin 在 `/admin/teachers` review submitted profile。
8. Admin approve 或 reject。
9. Approved Teacher 可進入 teacher dashboard、設定 availability、查看 eligible demand requests。

## UI Requirements

- `Teacher Join` 頁面語氣要尊重老師，不把老師商品化。
- 表單需 mobile-first，欄位分段清楚。
- Teacher dashboard 需顯示 profile status 與下一步。
- Submitted 後需清楚告知「正在審核」。
- Rejected 需顯示溫和且具體的補件或修正方向。

## Data Requirements

主要資料：

- `User`
- `TeacherProfile`
- `TeacherAvailability`
- `AvailabilityException`
- `AdminNote`
- `Notification`

`TeacherProfile` 必要欄位：

- `userId`
- `displayName`
- `bio`
- `teachingStyle`
- `experienceYears`
- `specialties`
- `serviceAreas`
- `teachingFormats`
- `status`

Phase 1 建議欄位：

- `certifications`
- `priceRange`
- `profilePhotoUrl`

Schema / validation 邊界：

- `TeacherProfile` 可以先以 `draft` 狀態保存部分資料，避免老師必須一次填完長表單。
- `submit application` 時必須由 server-side validation 檢查必要欄位完整。
- `specialties`、`serviceAreas`、`teachingFormats` 使用 string list 保存 Phase 1 選項，不在本 slice 建立 taxonomy model。
- 老師聯絡電話使用 `User.phone`，不在 `TeacherProfile` 重複保存。
- `TeacherProfile` 存在只代表具備 teacher area 的基礎 capability；回應 demand request 仍需要 `status = approved`。

## Permission Requirements

- Visitor 可看 teacher join page。
- Teacher 只能建立與編輯自己的 profile。
- Teacher 不可 approve 自己。
- Teacher 未 approved 前不可回應 demand request。
- Admin 可 review、approve、reject、suspend teacher profile。

## State Transitions

`TeacherProfile`：

```text
draft → submitted → approved
                   → rejected
approved → suspended
rejected → submitted
```

`rejected → submitted` 代表老師可在允許情況下修改後重新送審。詳見下方「Rejection Reason（V1）」對 reason 保存、可見性與 lifecycle 的定義。

## TeacherProfile Status Definitions

V1 只讓 Member / Organizer 看見 `approved` teacher。`draft`、`submitted`、`rejected`、`suspended` 都不公開顯示，也不可進入 demand response flow。

| Status | 狀態語意 | Teacher editability | Admin action | Member / Organizer visibility | Demand response permission | Notification / reason expectation |
|---|---|---|---|---|---|---|
| `draft` | 老師正在建立未完成 profile，尚未送審。 | Teacher 可建立與編輯自己的未完成 profile。 | 無需 review；Admin 可在後台需要時查看 draft 紀錄，但 V1 不要求主動處理。 | 不公開。 | 不可回應 demand。 | 不需通知 Admin review。 |
| `submitted` | 老師已送出申請，profile 進入 Admin review list。 | V1 先定義核心申請欄位不可由 Teacher 直接編輯，避免 Admin review 資料漂移；若未來需要 edit-after-submit，需另開 product decision。 | `approve`、`reject`。 | 不公開。 | 不可回應 demand。 | 需告知 Teacher「正在審核」，並通知 Admin review。 |
| `approved` | 老師已通過審核，可進入 marketplace 核心流程。 | Teacher 可維護 profile 與 availability；會影響公開呈現或媒合判斷的重大欄位變更，未來可再定義是否需重新 review。 | `suspend`。 | 可公開顯示在 V1 允許的老師展示場景。 | 可查看 eligible demand requests 並提交 response。 | 需通知 Teacher 已通過，可開始使用 teacher dashboard 與需求回應能力。 |
| `rejected` | Admin 判斷申請資料不足或不符合平台要求。 | Teacher 可依 reason 修改後重新送審。V1 不限制重新送審次數，不新增 counter / lockout。 | view reason / history；Teacher 可重新 submit，不需要 Admin 主動重開。 | 不公開。 | 不可回應 demand。 | 需顯示溫和且具體的修正方向，避免羞辱或壓迫語氣。 |
| `suspended` | Admin 因品質、安全或營運原因暫停已 approved teacher。 | Teacher 不可用自行編輯繞過 suspension；是否允許補充資料或申訴屬 future slice / admin-manual decision。 | `restore to approved` 是 allowed policy，但正式 restore UI / API 是否納入 V1 需 product owner 另行批准。 | 不公開。 | 不可回應新 demand。 | 需保留 reason / admin note；對 Teacher 的通知需清楚、溫和並避免公開揭露內部原因。 |

### Admin Action Matrix

| Current status | V1 Admin actions |
|---|---|
| `submitted` | `approve`, `reject` |
| `approved` | `suspend` |
| `rejected` | view reason / history；Teacher 可重新 submit，不需要 Admin 主動重開 |
| `suspended` | `restore to approved` 可在 policy 上允許；正式 UI / API 是否實作由 product owner 另行批准 |

## Rejection Reason（V1）

本節定義 Teacher application reject 時 rejection reason 的行為（產品主人已確認的 D1–D7）。

- **存哪（D1）**：保存於 `TeacherProfile.rejectionReason`（nullable `String?`）專用欄位，不使用 `AdminNote`。
- **誰可見（D2）**：reason 是**面向老師**的退回說明，原文顯示給該老師（dashboard 與 join 頁）；與內部 `AdminNote`（不對外）分離。本輪不建立內部 admin note。Admin 輸入時 UI 需明示「此說明會顯示給老師」。
- **必填與長度（D3）**：reject 時 reason **必填**。以 `normalizedReason = input.trim()` 為單一基準，server-side **驗證且持久化** trim 後值，長度 **10–1000 字**（以 trim 後計算）；前端 `required` + `minLength=10` + `maxLength=1000`，後端為權威驗證。
- **lifecycle（D4）**：`rejected` 期間**保留**（供老師邊看邊改）；於 `rejected → submitted` 與 `approve` 時**清空**；再次 reject **覆蓋**。單欄位、只留最新一次、不保留歷史。
- **告知方式（D7）**：V1 以站內顯示 reason 作為對老師的告知，**不寄 email**；email/notification 為後續切片 `teacher-application-rejection-notification`。
- **audit（D5）**：V1 不記錄審核人 / 時間（`reviewedBy` / `reviewedAt`），以 `TeacherProfile.updatedAt` 作粗略時間。

## RWD Requirements

- 360px 與 390px 手機寬度可完成表單。
- 長表單需分段，避免一次顯示過多資訊。
- 上傳或照片欄位如 V1 實作，手機上需有清楚 fallback。
- Admin review 至少在 tablet / desktop 可用。

## Acceptance Criteria

- Teacher 可以建立 draft profile。
- Teacher 可以 submit application。
- Submitted profile 會出現在 Admin review list。
- Admin 可以 approve teacher。
- Admin 可以 reject teacher 並留下**必填** reason（trim 後 10–1000 字），reason 保存於 `TeacherProfile.rejectionReason`。
- Rejected teacher 可在 dashboard 與 join 頁看見具體 rejection reason；`rejected → submitted` 或 approve 後 reason 被清空。
- Approved teacher 可以進入 demand pool。
- 未 approved teacher 不可回應 demand request。
- Suspended teacher 不可公開顯示或回應新需求。

## Non-goals

- 老師個人網站產生器
- 老師課程銷售頁
- 複雜收益報表
- 完整 teacher SaaS tools
- AI 自動審核老師
- 付費方案與抽成邏輯

## Risks

- 表單過長會降低老師完成率。
- 審核標準不清會造成 Admin 判斷不一致。
- 未 approved teacher 若可回應需求，會破壞 marketplace 信任。
- 老師 profile 若太像低價商品頁，會偏離 Free Soar 品牌。
