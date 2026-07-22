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

Teacher 不可 approve 自己。Suspended teacher 不可公開顯示，也不可回應新 demand request。

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

**V1 落地範圍**（`organizer-demand-request-foundation` 已確認）：`under_review` 狀態本輪不接線（見 `state-transition-details.md`），故上表已將原「View submitted / under review demand」併為「View submitted demand」。`Cancel demand` 這一列描述的是完整狀態機的最終能力，**本輪 foundation 不實作** cancel 的 UI/API（non-goal），保留於表中作為未來 slice 的權限參考。

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

## ClassSession

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View public class session | Yes | Yes | Yes | Yes | Yes |
| View private class session | No | Own | Own | Own | Admin |
| Create class session from matched demand | No | No | Own | No | Admin |
| Edit draft class session | No | No | Own | No | Admin |
| Open for enrollment | No | No | Own | No | Admin |
| Cancel class session | No | No | Own | No | Admin |
| Complete class session | No | No | No | No | Admin |

Teacher 可查看自己的 class session；V1 由 Admin 保有 class session 完成與取消的最終管理權。

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

## Notification

| Action | Visitor | Member | Organizer | Teacher | Admin |
|---|---|---|---|---|---|
| View own notifications | No | Own | Own | Own | Own |
| Create system notification | No | No | No | No | Admin |
| Send notification | No | No | No | No | Admin |

通知建立可由 domain/service layer 觸發；一般使用者不可任意建立 system notification。

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
