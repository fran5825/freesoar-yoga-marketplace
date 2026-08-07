# Route Map

## 目的

本文件定義 Free Soar Yoga V1 的 route 規劃。Route 名稱使用英文，頁面說明以繁體中文描述。

V1 route 必須服務瑜伽團課 marketplace 的核心流程，不納入 Wellness、Academy、Retreat、advanced AI matching 或複雜金流。

## Public Routes

| Route | 目的 | 主要角色 |
|---|---|---|
| `/` | **已落地**：品牌首頁，說明 Free Soar Yoga 的定位、三種角色與主辦人／老師主要入口；不提供 public class discovery | Visitor |
| `/about` | **已落地**：Free Soar Yoga 品牌與 marketplace 說明 | Visitor |
| `/teachers/join` | 老師加入與申請入口 | Visitor, Teacher |
| `/organizers/request` | 團主提出需求入口 | Visitor, Organizer |
| `/classes` | **已落地**（`teacher-initiated-open-classes` Slice D 已確認）：公開 class session 列表，任何人（含未登入 Visitor）都能瀏覽，可依課程類型／星期幾篩選；只顯示 `isPublic=true`、狀態符合、且授課老師 `approved` 的課程 | Visitor, Member |
| `/classes/[classSessionId]` | class session 詳情、share link 與 enrollment 入口。**已落地並擴充（`teacher-initiated-open-classes` Slice D 已確認）**：依登入狀態分支——已登入沿用既有 `getClassSessionForMember()`（不檢查 `isPublic`，維持既有 share-link 查看模式不變）；未登入改走新的 `getPublicClassSessionDetail()`，只顯示公開條件符合的課程，顯示唯讀詳情＋「登入後報名」連結（不渲染報名表單），不符合公開條件一律回傳 not-found，不揭露存在性 | Visitor, Member |
| `/faq` | **已落地**：常見問題與信任說明；不建立付款、退款或取消政策 | Visitor |

## Auth Routes

| Route | 目的 | 主要角色 |
|---|---|---|
| `/sign-in` | 登入。**已擴充**（`teacher-initiated-open-classes` Slice D 已確認）：支援 `?callbackUrl=` 查詢參數，登入完成後導回原頁面（例如未登入 Visitor 從 `/classes/[id]` 點「登入後報名」）；只接受站內相對路徑，拒絕外部網址，避免 open redirect；未帶或不合法時維持既有預設行為（導向 `/account`） | All |
| `/sign-up` | 註冊 | Visitor |
| `/account` | 個人帳號基本資料與最小 authenticated entry；提供 `/member/dashboard`、`/organizer/dashboard` 入口，但不在此載入 profile relations 或執行完整角色 launcher（`account-dashboard-navigation` 已確認） | Member, Organizer, Teacher, Admin |
| `/notifications` | 查看自己收到的站內通知（own-scoped，唯讀）；`/account` 提供入口連結（`notification` 已確認） | Member, Organizer, Teacher, Admin |

## Teacher Routes

| Route | 目的 |
|---|---|
| `/teacher/dashboard` | 老師 onboarding / status dashboard；已登入使用者可查看自己的 TeacherProfile status，尚未建立 TeacherProfile 時可前往建立申請。 |
| `/teacher/profile` | **已落地**（`teacher-profile-edit` 已確認）：approved 老師編輯自己的個人資料，suspended 唯讀查看，其餘狀態導向 `/teachers/join` |
| `/teacher/availability` | **已落地**（`teacher-availability` 已確認）：管理固定 availability 與 exception |
| `/teacher/demands` | 查看 eligible demand requests |
| `/teacher/demands/[demandRequestId]` | 查看需求詳情並提交 response |
| `/teacher/classes` | 查看自己的 class sessions（含團主媒合與自建兩種來源，**已擴充**——`teacher-initiated-open-classes` 已確認：顯示來源徽章與所屬常規/固定期課程系列名稱連結；`origin = teacher_initiated` 的課程顯示取消/開放報名/標記完成按鈕；有 `pending` 報名的課程顯示確認/拒絕按鈕） |
| `/teacher/classes/new` | **新增**（`teacher-initiated-open-classes` 已確認）：approved 老師建立單堂、常規（每週固定星期）或固定期課程；僅 `approved` 老師可建立，其餘狀態顯示引導文案 |
| `/teacher/classes/series/[recurringClassSeriesId]` | **新增**（`teacher-initiated-open-classes` 已確認）：管理單一常規/固定期課程系列——列出已生成場次、手動生成更多（僅常規模式）、取消整個系列 |

## Organizer Routes

| Route | 目的 |
|---|---|
| `/organizer/dashboard` | **已落地**（`role-dashboards` 已確認）：彙整自己的近期通知與需求狀態；任何 signed-in user 可進入，尚未建立 `OrganizerProfile` 時只顯示建立團主資料 CTA（見下方 Route Guard 例外） |
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
| `/member/dashboard` | **已落地**（`role-dashboards` 已確認）：彙整自己的近期通知、報名狀態與即將到來的已確認課程 |
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
| `/admin/organizations` | **已落地（唯讀）**（`admin-organizations` 已確認）；`管理`維持完整未來設計，V1 未開放編輯或代管 |

**修正（`admin-class-enrollment-management` 已確認）：原本規劃的 `/admin/enrollments` 獨立路由不建**——Enrollment 沒有任何狀態需要 Admin 核准才能推進，一個扁平、無篩選的全站報名列表沒有天然的用途；roster 與取消單筆報名的能力改為併入 `/admin/classes/[classSessionId]`（比照 Organizer／Teacher 既有頁面把 roster 顯示在 class session 詳情頁的既有資訊架構），理由與範圍見該輪 plan 的 D2。

## Route Guard 原則

- `/admin/*` 必須只允許 Admin。
- `/teacher/dashboard` 是登入後 teacher onboarding / status route，允許 signed-in user 進入並建立 teacher application；頁面只能顯示自己的 TeacherProfile status 與申請下一步，不可開放 demand、availability、response 或 class session 功能。
- 其他 `/teacher/*` workspace routes 必須只允許 Teacher 或 Admin；未 approved 的 Teacher 只能進入 onboarding / profile 相關頁。Demand response、eligible demand pool、availability 與 class session 能力必須另外檢查 TeacherProfile status 與 service-layer permission。**`/teacher/classes` 與 `/teacher/classes/series/[id]` 是例外**：查看**已經指派給自己的既有 class session／課程系列**不受此限，任何曾建立 `TeacherProfile` 的使用者皆可查看（比照既有唯讀查看自己 demand response 的權限模式），因為這是查看既有承諾而非申請新機會（`class-session-creation` D15 已確認；`teacher-initiated-open-classes` 已確認延伸到課程系列查看）。**`/teacher/classes/new` 不適用這個例外**：建立新課程／新系列是申請新機會，僅 `approved` 老師可進入，非 approved 顯示引導文案（`suspended` 顯示「老師資格已暫停」的獨立文案，其餘狀態顯示通用引導）。
- `/organizer/*` 必須只允許 Organizer 或 Admin；**`/organizer/profile` 與 `/organizer/dashboard` 是 bootstrap 例外**：比照 `/teacher/dashboard` 的 onboarding 模式，允許任何 signed-in user 進入。`/organizer/profile` 可自助建立自己的 `OrganizerProfile` + `Organization`（`organizer-demand-request-foundation` D1 已確認）；`/organizer/dashboard` 在尚未建立 profile 時只顯示前往建立資料的 CTA，不讀取或顯示任何 Organizer 私有資料（`role-dashboards` 已確認）。建立之後，這兩頁與其餘 `/organizer/*` workspace routes 一律限定 own 資料存取；例外不代表非 Organizer 可存取他人的需求、課程或 organization 資料。
- `/member/*` 必須只允許登入會員或 Admin。
- 所有登入者預設具備 Member 基本能力；Teacher 或 Organizer 若要報名課程，使用同一個 User 的 Member 能力。
- 公開 class detail / share link 只允許 `open_for_enrollment` 或 `confirmed` 且標記可公開的 class session。**已落地並擴充（`teacher-initiated-open-classes` Slice D 已確認）**：未登入 Visitor 走 `getPublicClassSessionDetail()`，額外要求授課老師 `status = approved`；已登入 Member 仍沿用既有 `getClassSessionForMember()`（不檢查 `isPublic`，維持既有 share-link 模式，D4 的既有行為不變）。兩條路徑對「不符合公開條件」與「`draft` 狀態」都一律回傳 not-found，不揭露任何欄位。
- `/classes` 公開列表**已落地**（`teacher-initiated-open-classes` Slice D 已確認），不再是 optional / later。

## RWD 原則

- Public、Teacher、Organizer、Member 的核心流程必須 mobile-first。
- Admin pages 至少要在 tablet 與 desktop 可用；若手機版限制較多，需要在 spec 中明確說明。
