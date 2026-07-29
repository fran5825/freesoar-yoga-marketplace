# Permissions Matrix

## 目的

本文件用矩陣方式整理 Free Soar Yoga V1 的 capability、resource、action 權限。

詳細實作時，所有權限都應在 server-side 檢查。Client UI 只負責隱藏或提示，不可作為安全依據。

## Role Model

V1 採用能力模型，而不是限制一個 `User` 只能有一種身分：

- `User` 是基本帳號。
- 所有登入者預設具備 Member 基本能力。
- Teacher 能力由 `TeacherProfile` 開啟。
- Organizer 能力由 `OrganizerProfile` 開啟。
- Admin 是平台管理權限。
- Teacher 或 Organizer 若要報名課程，是用同一個 `User` 的 Member 能力報名，不是用 Teacher / Organizer 權限報名。

矩陣中的 `Teacher` 與 `Organizer` 代表該 User 已具備對應 profile 能力；`Visitor` 代表未登入使用者。

## Legend

| 符號 | 意義 |
|---|---|
| Yes | 可執行 |
| Own | 僅限自己的資料或所屬資料 |
| Eligible | 僅限符合條件且已公開的資料 |
| Admin | 僅 Admin 可執行 |
| No | 不可執行 |

## Public Pages

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View marketing pages | Yes | Yes | Yes | Yes | Yes |
| View public teacher profile | Yes | Yes | Yes | Yes | Yes |
| View public class session | Yes | Yes | Yes | Yes | Yes |
| Submit public inquiry form | Yes | Yes | Yes | Yes | Yes |

公開資料仍需遵守 visibility policy；不是所有 teacher profile 或 class session 都一定公開。

公開 class session 僅限 `open_for_enrollment` 或 `confirmed`，且已標記可公開。

## User / Account

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create account | Yes | No | No | No | Admin |
| View own account | No | Own | Own | Own | Own |
| Edit own account | No | Own | Own | Own | Own |
| View all users | No | No | No | No | Admin |
| Grant admin permission | No | No | No | No | Admin |

## TeacherProfile

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View public approved profile | Yes | Yes | Yes | Yes | Yes |
| Create teacher profile | No | No | No | Own | Admin |
| Edit teacher profile | No | No | No | Own | Admin |
| Submit for review | No | No | No | Own | Admin |
| Approve profile | No | No | No | No | Admin |
| Reject profile | No | No | No | No | Admin |
| Suspend profile | No | No | No | No | Admin |
| Restore profile | No | No | No | No | Admin |

Teacher 不可 approve 自己。Suspended teacher 不可公開顯示，也不可回應新 demand request。

**V1 落地範圍（`teacher-profile-suspension` 已確認）**：`Suspend profile` 這一列過去長期沒有對應的落地範圍註記，容易被誤讀成早就是 V1 功能——實際上直到本輪之前，整個 repo 沒有任何程式碼會把 `TeacherProfile.status` 寫成 `suspended`。本輪把 `Suspend profile` 與新增的 `Restore profile` 一起接線：兩者都是 Admin-only，`Suspend` 必填 `suspensionReason`（trim 後 10–1000 字，獨立於 `rejectionReason` 的欄位），`Restore` 只能從 `suspended` 觸發並清空該欄位。連帶影響：`demand-response-and-matching-spec.md` 的 `Select response` 動作現在也會檢查該 response 所屬老師是否仍是 `approved`，暫停後既有的 `submitted` response 無法再被選定。

## TeacherAvailability

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View public availability summary | No | No | Eligible | Own | Admin |
| Create availability | No | No | No | Own | Admin |
| Edit availability | No | No | No | Own | Admin |
| Delete availability | No | No | No | Own | Admin |

Organizer 只能在已媒合或合適流程中看到必要的可約時間，不應看到老師完整私人排程。

## Organization / OrganizerProfile

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create organization | No | No | Own | No | Admin |
| View organization | No | No | Own | Eligible | Admin |
| Edit organization | No | No | Own | No | Admin |
| Create organizer profile | No | No | Own | No | Admin |
| Edit organizer profile | No | No | Own | No | Admin |

Teacher 只有在 published demand 或 matched class 需要時，才可看到必要的 organization 資訊。

**Organizer capability bootstrap 例外**（`organizer-demand-request-foundation` D1 已確認）：`Create organizer profile` 這一列的「Organizer=Own」在建立當下有一個先天的循環——建立前這位 user 還不具備 Organizer 能力。比照 `TeacherProfile` 既有的 onboarding 模式，V1 明確允許：**任何 signed-in user（Member 基本能力）皆可自助建立自己的 `OrganizerProfile` + `Organization`**（不需要 Admin 指派或審核），建立後即具備 Organizer 能力，且僅能管理自己的 own 資料。此例外只適用於「建立」動作本身；建立後的 `View` / `Edit organization` / `Edit organizer profile` 仍嚴格限定 Own。對應的 route 層例外見 `docs/product/route-map.md` 的 `/organizer/profile` 標注。

## DemandRequest

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create demand request | No | No | Own | No | Admin |
| View draft demand request | No | No | Own | No | Admin |
| View submitted demand | No | No | Own | No | Admin |
| View published demand | No | No | Own | Eligible | Admin |
| Edit draft demand | No | No | Own | No | Admin |
| Submit demand | No | No | Own | No | Admin |
| Publish demand | No | No | No | No | Admin |
| Reject demand | No | No | No | No | Admin |
| Cancel demand | No | No | Own | No | Admin |

Organizer 不可查看其他 organizer 的私人 demand request。

**V1 落地範圍**（`organizer-demand-request-foundation`、`demand-request-cancellation` 已確認）：`under_review` 狀態本輪不接線（見 `state-transition-details.md`），故上表已將原「View submitted / under review demand」併為「View submitted demand」。**`Cancel demand` 僅 Organizer own-scoped 可執行**（`demand-request-cancellation` D1，Admin 不介入——修正原本標記為不接線的敘述，這條動作已在 `demand-request-cancellation` 落地；可從 `draft`/`submitted`/`published`/`matched` 觸發，明確排除 `converted_to_class`，並連帶取消該 demand 底下所有 `submitted`／`selected` 的 `DemandResponse`，見 `state-transition-details.md`）。

## DemandResponse

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create response | No | No | No | Eligible | Admin |
| View own response | No | No | No | Own | Admin |
| View responses to own demand | No | No | Own | No | Admin |
| Edit response before selected | No | No | No | Own | Admin |
| Withdraw response before selected | No | No | No | Own | Admin |
| Shortlist response | No | No | Own | No | Admin |
| Select response | No | No | Own | No | Admin |
| Decline response | No | No | Own | No | Admin |

V1 一個 demand request 只能有一個 selected response。

**V1 落地範圍**（`demand-response-selection-and-matching`、`teacher-profile-suspension` 已確認）：`Select response` 僅 Organizer own-scoped 可執行，**Admin 不介入**（D2，上表 Admin 欄位為完整未來設計，V1 未開放）；`Decline response` 在 V1 不是獨立的 Organizer 手動動作，而是 select 成功時同一 transaction 內自動處理（D3），沒有對應的手動操作入口；`Shortlist response` 本輪不實作（D1），保留於表中作為未來 slice 參考（對齊上方 `Cancel demand` 的既有註記慣例）。`Select response` 額外要求該 response 所屬的 `TeacherProfile.status = 'approved'`（`teacher-profile-suspension` 已確認）——暫停中的老師既有的 `submitted` response 無法再被選定。

## ClassSession

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View public class session | Yes | Yes | Yes | Yes | Yes |
| View private class session | No | Own | Own | Own | Admin |
| Create class session from matched demand | No | No | Own | No | Admin |
| Edit draft class session | No | No | Own | No | Admin |
| Open for enrollment | No | No | Own | No | Admin |
| Cancel class session | No | No | Own | No | Admin |
| Complete class session | No | No | Own | No | Admin |

Teacher 可查看自己的 class session；下方「V1 落地範圍」對 Complete/Cancel 兩列有修正說明。

**V1 落地範圍**（`class-session-creation`、`enrollment`、`class-session-cancellation`、`class-session-completion` 已確認）：`Create class session from matched demand` 僅 Organizer own-scoped 可執行，**Admin 不介入**（D1，上表 Admin 欄位為完整未來設計，V1 未開放）；`Edit draft class session` 本輪不實作（D2，一次到位建立、建立後不可編輯）；**`Open for enrollment` 僅 Organizer own-scoped 可執行**（`enrollment` D2，Admin 不介入，且 `startAt` 已過不可開放，D14）；**`Cancel class session` 僅 Organizer own-scoped 可執行**（`class-session-cancellation` D1，Admin 不介入，且 `startAt` 已過不可取消，D2——修正原本標記為不接線的敘述，這條動作已在 `class-session-cancellation` 落地；取消可從 `draft` 或 `open_for_enrollment` 觸發，並連帶取消該課程底下所有 `confirmed` 的 Enrollment，見 `state-transition-details.md`）；**`Complete class session` 僅 Organizer own-scoped 可執行**（`class-session-completion` D1，Admin 不介入——修正原本標記為不接線、且誤寫成 Admin-only 的敘述，這條動作已落地；只能從 `open_for_enrollment` 觸發，且 `endAt` 必須已經過去，時間方向與 Cancel／Open for enrollment 相反；不連帶處理 Enrollment，也不觸發新的 Notification）。`View private class session` 的 Teacher 欄位在 V1 不受 approved 狀態限制（`class-session-creation` D15，比照 View own response 的既有唯讀先例）。

## Enrollment

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| Create enrollment | No | Own | Member capability only | Member capability only | Admin |
| View own enrollment | No | Own | Member capability only | Member capability only | Admin |
| View class roster basics | No | No | Own | Own | Admin |
| Cancel own enrollment | No | Own | Member capability only | Member capability only | Admin |
| Confirm enrollment | No | No | No | No | Admin |
| Mark attended / no_show | No | No | No | No | Admin |

同一 user 不可重複報名同一 class session。Confirmed enrollments 不可超過 capacity。

V1 不做完整 Teacher attendance workflow；`attended` / `no_show` 可保留為 future 或 admin-only 後續能力。

**V1 落地範圍**（`enrollment` 已確認）：`Create enrollment`／`View own enrollment`／`Cancel own enrollment` 皆 Member own-scoped（任何登入使用者皆有 Member 能力，不需要額外的 profile model，D2 精神延續自既有 route-map 慣例）；`View class roster basics` Organizer／Teacher own-scoped，只回傳 `confirmed` enrollment 的最小必要識別資訊（`User.name` 為 null 時 fallback 至 `email`）與 `notes`，不含 `phone`/`image`；`Confirm enrollment`（跳過 `pending`，D1）與 `Mark attended / no_show`（D11）本輪皆不接線；**Admin 不介入**（D10，上表 Admin 欄位為完整未來設計，V1 未開放）。

## Notification

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View own notifications | No | Own | Own | Own | Own |
| Create system notification | No | No | No | No | Admin |
| Send notification | No | No | No | No | Admin |

通知建立可由 domain/service layer 觸發；一般使用者不可任意建立 system notification。

**V1 落地範圍**（`notification`、`class-session-cancellation`、`demand-request-cancellation` 已確認）：`View own notifications` 透過 `/notifications` 頁面實現，own-scoped，任何登入使用者（含 Admin 自己）皆可查看自己收到的通知；`Create system notification`／`Send notification` 由各 domain/service layer 的 13 個既有 trigger 點（見 `state-transition-details.md` 的「Notification Side Effects」）內部呼叫 `notifyUsers`，不對外開放任何可手動建立或發送通知的 API 或 UI 入口，也沒有 Admin 專用的 notification 管理介面。收件人解析邏輯（誰會收到通知）持續受本文件 Security Review Required 清單規範。

## AdminNote

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View admin note | No | No | No | No | Admin |
| Create admin note | No | No | No | No | Admin |
| Edit admin note | No | No | No | No | Admin |

AdminNote 只供內部管理使用，不應顯示給一般角色。

## Security Review Required

以下變更必須做 security review：

- auth provider 或 session 邏輯
- admin permission assignment
- teacher approval
- demand visibility
- response selection
- enrollment capacity
- admin routes
- notification recipient logic
- payment-related placeholder 轉為實作
