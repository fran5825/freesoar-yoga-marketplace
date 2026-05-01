# Route Map

## 目的

本文件定義 Free Soar Yoga V1 的 route 規劃。Route 名稱使用英文，頁面說明以繁體中文描述。

V1 route 必須服務瑜伽團課 marketplace 的核心流程，不納入 Wellness、Academy、Retreat、advanced AI matching 或複雜金流。

## Public Routes

| Route | 目的 | 主要角色 |
|---|---|---|
| `/` | 品牌首頁，說明 Free Soar Yoga 的定位與主要入口 | Visitor |
| `/about` | Free Soar Yoga 品牌與 marketplace 說明 | Visitor |
| `/teachers/join` | 老師加入與申請入口 | Visitor, Teacher |
| `/organizers/request` | 團主提出需求入口 | Visitor, Organizer |
| `/classes` | 公開 class session 列表，如 V1 開放瀏覽 | Visitor, Member |
| `/classes/[classSessionId]` | class session 詳情與 enrollment 入口 | Visitor, Member |
| `/faq` | 常見問題與信任說明 | Visitor |

## Auth Routes

| Route | 目的 | 主要角色 |
|---|---|---|
| `/sign-in` | 登入 | All |
| `/sign-up` | 註冊 | Visitor |
| `/account` | 個人帳號基本資料 | Member, Organizer, Teacher, Admin |

## Teacher Routes

| Route | 目的 |
|---|---|
| `/teacher/dashboard` | 老師 dashboard，顯示 profile status、近期需求與課程摘要 |
| `/teacher/profile` | 編輯 teacher profile |
| `/teacher/availability` | 管理固定 availability 與 exception |
| `/teacher/demands` | 查看 eligible demand requests |
| `/teacher/demands/[demandRequestId]` | 查看需求詳情並提交 response |
| `/teacher/classes` | 查看自己的 class sessions |

## Organizer Routes

| Route | 目的 |
|---|---|
| `/organizer/dashboard` | 團主 dashboard，顯示需求、回覆與課程摘要 |
| `/organizer/profile` | 管理 organizer profile 與 organization 基本資料 |
| `/organizer/demands` | 查看自己的 demand requests |
| `/organizer/demands/new` | 建立 demand request |
| `/organizer/demands/[demandRequestId]` | 查看需求詳情、老師回覆與 matching 狀態 |
| `/organizer/classes` | 查看自己需求形成的 class sessions |

## Member Routes

| Route | 目的 |
|---|---|
| `/member/dashboard` | 會員 dashboard，顯示已報名課程摘要 |
| `/member/enrollments` | 查看自己的 enrollments |

## Admin Routes

| Route | 目的 |
|---|---|
| `/admin/dashboard` | Admin dashboard 與 basic KPIs |
| `/admin/teachers` | 審核、查看、暫停 teacher profiles |
| `/admin/demands` | review、publish、reject demand requests |
| `/admin/classes` | 管理 class sessions |
| `/admin/enrollments` | 管理 enrollments |
| `/admin/organizations` | 查看與管理 organizations |

## Route Guard 原則

- `/admin/*` 必須只允許 Admin。
- `/teacher/*` 必須只允許 Teacher 或 Admin；未 approved 的 Teacher 只能進入 onboarding / profile 相關頁。
- `/organizer/*` 必須只允許 Organizer 或 Admin。
- `/member/*` 必須只允許登入會員或 Admin。
- 公開 class session 是否可被 Visitor 看見，需依 class status 與 visibility policy 決定。

## RWD 原則

- Public、Teacher、Organizer、Member 的核心流程必須 mobile-first。
- Admin pages 至少要在 tablet 與 desktop 可用；若手機版限制較多，需要在 spec 中明確說明。
