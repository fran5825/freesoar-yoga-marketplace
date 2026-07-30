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
| `/classes` | 公開 class session 列表，optional / later，不作為 V1 必做 | Visitor, Member |
| `/classes/[classSessionId]` | class session 詳情、share link 與 enrollment 入口（`enrollment` 已確認：V1 僅開放已登入 Member 存取，不對 Visitor 開放，也不檢查 `isPublic`——`isPublic` 目前只保留給未來公開列表使用，見 `class-session-creation` D11、`enrollment` D4） | Member |
| `/faq` | 常見問題與信任說明 | Visitor |

## Auth Routes

| Route | 目的 | 主要角色 |
|---|---|---|
| `/sign-in` | 登入 | All |
| `/sign-up` | 註冊 | Visitor |
| `/account` | 個人帳號基本資料 | Member, Organizer, Teacher, Admin |
| `/notifications` | 查看自己收到的站內通知（own-scoped，唯讀）；`/account` 提供入口連結（`notification` 已確認） | Member, Organizer, Teacher, Admin |

## Teacher Routes

| Route | 目的 |
|---|---|
| `/teacher/dashboard` | 老師 onboarding / status dashboard；已登入使用者可查看自己的 TeacherProfile status，尚未建立 TeacherProfile 時可前往建立申請。 |
| `/teacher/profile` | **已落地**（`teacher-profile-edit` 已確認）：approved 老師編輯自己的個人資料，suspended 唯讀查看，其餘狀態導向 `/teachers/join` |
| `/teacher/availability` | **已落地**（`teacher-availability` 已確認）：管理固定 availability 與 exception |
| `/teacher/demands` | 查看 eligible demand requests |
| `/teacher/demands/[demandRequestId]` | 查看需求詳情並提交 response |
| `/teacher/classes` | 查看自己的 class sessions |

## Organizer Routes

| Route | 目的 |
|---|---|
| `/organizer/dashboard` | 團主 dashboard，顯示需求、回覆與課程摘要 |
| `/organizer/profile` | Organizer capability bootstrap / 管理 organizer profile 與 organization 基本資料；已登入使用者可在此自助建立自己的 `OrganizerProfile` + `Organization`，尚未建立時導向建立流程（見下方 Route Guard 例外） |
| `/organizer/demands` | 查看自己的 demand requests |
| `/organizer/demands/new` | 建立 demand request draft 或直接 submit |
| `/organizer/demands/[demandRequestId]/edit` | 重新開啟自己既有的 draft demand 續填、save 或 submit；僅允許 `status="draft"`，非 draft 導回 detail（`organizer-demand-request-foundation` 已確認，避免 draft 建立後無法完成的孤兒草稿） |
| `/organizer/demands/[demandRequestId]` | 查看需求詳情、老師回覆與 matching 狀態；`draft` demand 提供前往 edit 續編的入口；`matched` demand 提供建立 class session 的入口（`class-session-creation` 已確認） |
| `/organizer/classes` | 查看自己需求形成的 class sessions |
| `/organizer/classes/[classSessionId]` | 查看單一 class session 詳情（`class-session-creation` 已確認） |

## Member Routes

| Route | 目的 |
|---|---|
| `/member/dashboard` | 會員 dashboard，顯示已報名課程摘要 |
| `/member/enrollments` | 查看自己的 enrollments，並可取消（`enrollment` 已確認） |

## Admin Routes

| Route | 目的 |
|---|---|
| `/admin/dashboard` | **已落地**（`admin-dashboard` 已確認）：Admin dashboard 與 basic KPIs |
| `/admin/teachers` | 審核、查看、暫停 teacher profiles |
| `/admin/demands` | review、publish、reject demand requests |
| `/admin/demands/[demandRequestId]` | admin demand detail（可選）；若 Admin review UI 採「detail route」而非「展開卡片」呈現完整 demand + organization + organizer 內容，才會落地此路由（`organizer-demand-request-foundation` Slice 7 決定採用哪一種呈現方式時據此對齊） |
| `/admin/classes` | **已落地**（`admin-class-enrollment-management` 已確認）：查看全平台所有 class session（依狀態分組），連到 detail 頁 |
| `/admin/classes/[classSessionId]` | **已落地**（`admin-class-enrollment-management` 已確認）：單一 class session 完整詳情、完整 roster（含所有狀態）、取消課程／取消單筆報名 |
| `/admin/organizations` | 查看與管理 organizations |

**修正（`admin-class-enrollment-management` 已確認）：原本規劃的 `/admin/enrollments` 獨立路由不建**——Enrollment 沒有任何狀態需要 Admin 核准才能推進，一個扁平、無篩選的全站報名列表沒有天然的用途；roster 與取消單筆報名的能力改為併入 `/admin/classes/[classSessionId]`（比照 Organizer／Teacher 既有頁面把 roster 顯示在 class session 詳情頁的既有資訊架構），理由與範圍見該輪 plan 的 D2。

## Route Guard 原則

- `/admin/*` 必須只允許 Admin。
- `/teacher/dashboard` 是登入後 teacher onboarding / status route，允許 signed-in user 進入並建立 teacher application；頁面只能顯示自己的 TeacherProfile status 與申請下一步，不可開放 demand、availability、response 或 class session 功能。
- 其他 `/teacher/*` workspace routes 必須只允許 Teacher 或 Admin；未 approved 的 Teacher 只能進入 onboarding / profile 相關頁。Demand response、eligible demand pool、availability 與 class session 能力必須另外檢查 TeacherProfile status 與 service-layer permission。**`/teacher/classes` 是例外**：查看**已經指派給自己的既有 class session**不受此限，任何曾建立 `TeacherProfile` 的使用者皆可查看（比照既有唯讀查看自己 demand response 的權限模式），因為這是查看既有承諾而非申請新機會（`class-session-creation` D15 已確認）。
- `/organizer/*` 必須只允許 Organizer 或 Admin；**`/organizer/profile` 是例外**：比照 `/teacher/dashboard` 的 onboarding 模式，允許任何 signed-in user 進入並自助建立自己的 `OrganizerProfile` + `Organization`（`organizer-demand-request-foundation` D1 已確認）。建立之後，該頁與其餘 `/organizer/*` workspace routes 一律限定 own 資料存取；此例外只開放「建立自己的 organizer 能力」這一動作，不代表 `/organizer/*` 對非 organizer 開放其他資料存取。
- `/member/*` 必須只允許登入會員或 Admin。
- 所有登入者預設具備 Member 基本能力；Teacher 或 Organizer 若要報名課程，使用同一個 User 的 Member 能力。
- 公開 class detail / share link 只允許 `open_for_enrollment` 或 `confirmed` 且標記可公開的 class session。**（`enrollment` 已確認：這是完整未來設計，V1 的 `/classes/[classSessionId]` 只服務已登入 Member，不對 Visitor 開放，也不檢查 `isPublic`；`draft` 狀態的 class session 一律回傳 not-found，不揭露任何欄位——D4。）**
- `/classes` 公開列表為 optional / later，不作為 V1 必做。

## RWD 原則

- Public、Teacher、Organizer、Member 的核心流程必須 mobile-first。
- Admin pages 至少要在 tablet 與 desktop 可用；若手機版限制較多，需要在 spec 中明確說明。
