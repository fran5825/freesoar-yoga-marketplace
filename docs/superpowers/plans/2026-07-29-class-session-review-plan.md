# Class Session Review — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D9）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

「媒合 → 開課 → 完成」這條主線走完之後（`class-session-completion` 已落地 `open_for_enrollment → completed`），Member 沒有任何管道對已經上完的課程留下回饋，Teacher／Organizer 也沒有任何管道知道課程實際上得到的評價。這是一個完全從零開始的新領域——`prisma/schema.prisma` 目前**沒有 `Review` model**，`src/domain/` 也**沒有 `review/` 目錄**，`docs/domain/permissions-matrix.md`／`docs/product/route-map.md` 都沒有任何 Review 相關的列。

### 1.2 這輪跟既有 scope 文件的關係（先澄清，避免誤判成「本輪不該做」）

`docs/product/PRD.md`：「`PaymentIntent` 與 `Review` 可保留為未來擴充概念，但 V1 不實作完整金流與複雜評價系統，**除非另行核准**」。`docs/scope/v1-scope.md` 把「Basic review system」列在 **Nice to Have**（不是 Must Have，但也不是 Non-goals）。使用者這輪明確要求開始做 Review 功能，構成 PRD 所說的「另行核准」；但 PRD 同時明確警告不要做「複雜評價系統」——本輪的每一個 D 項都刻意往「basic」的方向收斂，不做公開評分頁、不做編輯/刪除、不做管理後台，理由見各 D 項。

### 1.3 風險等級

低。這是一個新增的獨立 model，沒有既有資料要 migrate，沒有既有程式碼路徑要修改（唯一例外：`completeOwnClassSession` 需要補一個先前明確延後的通知呼叫，見 D5）。核心寫入操作（`submitOwnReview`）沒有多方競爭同一列的併發場景，只需要一個 unique constraint 當作併發保護（比照既有 `submitDemandResponseForTeacher` 的既有先例，見 D6）。

### 1.4 命名澄清

- **本輪的「評價」**指 Member 對自己已經 `confirmed` 報名、且該堂課 `ClassSession.status = completed` 之後，對授課老師留下的一則評分（1–5）+ 選填文字回饋。
- 跟 `docs/domain/data-model.md` 既有描述的 `Review` 欄位清單（`id`/`classSessionId`/`reviewerUserId`/`teacherProfileId`/`rating`/`comment`/`visibility`/`createdAt`）大致一致，但本輪拿掉 `visibility`（理由見 D4）與 `teacherProfileId`（理由見 D2，codex round 1 指出的問題，已採納）兩個欄位。

## 2. 現況核對（Repo Reality Audit；2026-07-29 working tree = committed `main` @ `8ec455a`）

### 2.1 已 committed 的基礎（可直接依賴）

- **`ClassSession.status = "completed"` 已經真的可以被寫入**（`class-session-completion` 已落地）：`completeOwnClassSession`（`src/domain/class-session/service.ts`）是 Organizer own-scoped 的單一狀態轉換，只能從 `open_for_enrollment` 觸發，且要求 `endAt` 已經過去。這是本輪「什麼時候可以留評價」的前置依賴。
- **`completeOwnClassSession` 目前刻意沒有觸發任何 Notification**（`class-session-completion` D5 已確認），該輪的理由明確寫著：「更有價值的通知其實是『邀請留下評價』，但那需要 Review 功能存在才有意義……不如把『課程完成』的通知價值整合進 Review 那一輪的事件裡一次做好」——這是**本輪需要兌現的既有承諾**（見 D5），不是本輪自己新提出的想法。
- **`Enrollment` 是判斷「誰可以評價」的唯一依據**：`Enrollment.status = "confirmed"` 代表這位 Member 真的報名且沒有事後取消；`@@unique([classSessionId, userId])` 已經保證一位 Member 對同一堂課至多一筆 enrollment 紀錄。`listOwnEnrollmentsForMember()`（`src/domain/enrollment/read-service.ts`）目前的 `select` **沒有帶出 `classSession.status`**，本輪需要擴充這個既有查詢才能在 `/member/enrollments` 判斷該不該顯示評價表單（不需要新增查詢，只是擴充既有 select，避免 N+1）。
- **沒有任何公開的 Teacher 目錄頁**：已核對 `docs/product/route-map.md` 的 Teacher 路由清單，V1 只有 `/teachers/join`（申請入口）、`/teacher/dashboard`／`/teacher/profile`／`/teacher/availability`／`/teacher/demands`／`/teacher/classes`（全部是登入後的 own-scoped workspace），**沒有任何 Visitor/Member 可以瀏覽的公開老師列表或個人頁**。這代表原始 `data-model.md` 欄位清單裡的 `visibility` 欄位目前沒有任何頁面可以消費它——不管值是什麼，都不會有任何公開頁面因此顯示或隱藏評價。
- **`docs/domain/permissions-matrix.md`／`docs/product/route-map.md` 完全沒有 Review 相關的列**：已用 `grep -i review` 逐一核對過（`grep` 出來的其他命中都是 `Admin review demand`／`teacher review actions` 這類既有、不相關的「審核」語意，跟本輪的「評價」是兩個不同的中文詞但共用英文單字 review，容易混淆，已逐一排除）。這是一個要從零建立的新 permission 表格區塊。
- **`src/app/organizer/classes/[classSessionId]/page.tsx`／`src/app/teacher/classes/page.tsx`／`src/app/member/enrollments/page.tsx` 三個既有頁面已經各自有針對 `ClassSession.status` 的既有條件式區塊**（roster 顯示、取消報名、標記完成……），本輪比照同一個既有版型慣例插入新的評價相關區塊，不新增頁面。
- **既有的「選填短文字」欄位驗證先例**：`Enrollment.notes`（`src/domain/enrollment/validation.ts` 的 `NOTES_MAX_LENGTH = 500`）是這個 repo 目前唯一一個「選填、簡短備註、不需要 `DemandRequest.description` 等級長度」的既有欄位設計，本輪的 `comment` 欄位直接比照同一個上限與既有先例（見 D2）。
- **既有的「unique constraint 本身就是併發保護」先例**：`submitDemandResponseForTeacher`（`src/domain/demand-response/__internal__/select-and-submit-core.ts`）的原子 INSERT 用 `WHERE EXISTS (...)` 檢查資格，並且用 `isUniqueConstraintViolation` 捕捉 P2002 對應到 `response_already_exists`——沒有用 `SELECT ... FOR UPDATE`。本輪的 `submitOwnReview` 是同一種形狀（單一 Member 對單一 `(classSessionId, reviewerUserId)` 組合的一次性 INSERT，見 D6）。

### 2.2 上游依賴狀態

- 依賴 `class-session-completion`（已 commit + push 進 `main`）。不依賴任何其他進行中輪次。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不做公開的 Teacher 評分/評價頁面（2.1 已確認沒有這類頁面存在，新增一個屬於範圍大得多的獨立功能）。
- 不做評價的編輯或刪除（見 D3）。
- 不做 Admin 審核/管理評價的介面（沒有既有的內容審核機制，也沒有被要求要有）。
- 不做「回覆評價」（Teacher 或 Organizer 回應 Member 留下的評價）。
- 不做評分聚合/平均分數的顯示（例如「這位老師平均 4.5 顆星」）——只顯示個別評價，理由見 D7。
- 不通知 Organizer 或 Admin 有新評價送出（見 D5，只通知被評價的 Teacher）。
- 不改動 `next.config.ts`／`package.json`／`playwright.config.ts`。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `prisma/schema.prisma`：新增 `Review` model（`id`/`classSessionId`/`reviewerUserId`/`rating`/`comment`/`createdAt`，`@@unique([classSessionId, reviewerUserId])`——**不含** `teacherProfileId`，理由見 D2）；`NotificationType` 新增 `class_session_completed`／`review_submitted`（需要 migration）。
- `src/domain/review/validation.ts`：`validateReviewInput`（rating 1–5 必填、comment 選填 ≤500 字，trim 後比照 `Enrollment.notes` 既有先例）。
- `src/domain/review/service.ts`：`submitOwnReview(classSessionId, input)`（Member own-scoped，見 D1/D2/D3/D6）。
- `src/domain/review/read-service.ts`：`listReviewsForClassSession(classSessionId)`（Organizer own-scoped，比照 `listConfirmedEnrollmentsForClassSession` 既有形狀）。**不含** `getOwnReviewForClassSession`，理由見 D7 修正版（N+1 查詢問題，改用 `listOwnEnrollmentsForMember` 的 nested select）。
- `src/domain/enrollment/read-service.ts`：`listOwnEnrollmentsForMember()` 的既有 `select` 擴充 `classSession.status` 與 `classSession.reviews`（nested select，見 D7 修正版；不新增查詢）。
- `src/domain/class-session/read-service.ts`：`listOwnClassSessionsForTeacher()` 的既有 nested select 擴充 `reviews`（不新增查詢，比照既有 `enrollments` nested select 的既有手法）。
- `src/domain/class-session/service.ts`：`completeOwnClassSession` 補上 D5 承諾的 `class_session_completed` 通知（Organizer own-scoped 動作本身不變，只新增 tx-commit 之後的通知呼叫）。
- `src/app/member/enrollments/page.tsx`／`actions.ts`：新增評價表單區塊（`completed` + `confirmed` 且尚未評價時顯示）。
- `src/app/organizer/classes/[classSessionId]/page.tsx`：新增評價顯示區塊（`completed` 時顯示既有評價列表）。
- `src/app/teacher/classes/page.tsx`：新增評價顯示區塊（`completed` 時顯示既有評價列表，比照既有 roster 區塊的既有版型）。
- Playwright smoke 測試（資格邊界、重複評價、驗證邊界、通知正確性、三端 UI 顯示、**IDOR：非本人 Organizer／非本人 Teacher 看不到不屬於自己的評價**（codex round 1 指出的問題，已採納，見 D11-equivalent 清單）、完整 E2E 流程）。
- 文件對齊：`docs/domain/data-model.md`（新增 Review 區塊，修正欄位清單拿掉 `visibility`**與 `teacherProfileId`**，codex round 2 指出原本只列前者，已修正）、`docs/domain/permissions-matrix.md`（新增 Review 區塊）、`docs/product/route-map.md`（若需要，見 D7）、`docs/product/notification-spec.md`（落地現況追加兩個新事件）、`docs/specs/class-session-and-enrollment-spec.md`（落地現況段落追加，見 D9）。

### 3.2 本輪明確不包含

見 2.3。

## 4. 安全與權限設計

- `submitOwnReview` 必須 own-scoped：`requireUser()` 解析出 `userId`，資格檢查（`Enrollment.userId = 該 userId`）直接內建在原子 INSERT 的 `WHERE EXISTS` 子句裡，不信任 client 傳入的任何身分欄位。
- `listReviewsForClassSession` 必須 own-scoped：比照既有 `listConfirmedEnrollmentsForClassSession` 的既有寫法（`requireUser()` + `organizerProfile.userId` 擁有權查詢，查不到回傳 `null`，not-found 語意不洩漏擁有權差異）。
- **修正（codex round 1 指出的問題，已採納）：三個角色的評價可見範圍都需要明確的負向測試，不能只驗證「三方各自看得到自己該看的」，還要驗證「看不到不屬於自己的」。** `listReviewsForClassSession` 的 own-scoped 查不到即回傳 `null`（同上）需要一則 IDOR 測試直接證明；Teacher 端透過既有 `listOwnClassSessionsForTeacher`（已經是 `teacherProfileId` own-scoped）取得，天生不會回傳其他老師的 class session，但仍需要一則測試明確斷言；Member 端的評價資料透過 `listOwnEnrollmentsForMember`（已經是 `userId` own-scoped，且 nested `reviews` select 本身又用 `reviewerUserId: currentUser.id` 二次過濾）取得，同一堂課其他 Member 的評價內容不會出現在這份清單裡，也需要一則測試明確斷言（見 Slice 3 測試清單）。
- 評價內容（`rating`/`comment`）只顯示給：留言的 Member 自己、該堂課的 Organizer（own-scoped）、被評價的 Teacher（own-scoped）。不對外公開、不給其他 Organizer/Teacher/Member 看到。

## 5. 產品主人決策 Gate（D1–D9）

### D1 — 誰可以留評價？前提條件是什麼？

- **推薦：任何登入使用者，只要對目標 `ClassSession` 有一筆 `status = "confirmed"` 的 `Enrollment`，且該 `ClassSession.status = "completed"`。** 不需要額外的 Member capability model（這個 repo 從一開始就採「任何登入使用者皆有 Member 能力」的既有慣例，`enrollment` 一輪已確認）。`cancelled` 狀態的 enrollment 不可評價——這位 Member 在課程開始前就已經取消，沒有真的參與，不應該留下評價。

### D2 — 評價內容？

- **推薦：`rating`（1–5 整數，必填）+ `comment`（選填文字，trim 後上限 500 字）。** `rating` 是 Review 最核心的資訊，必填合理；`comment` 比照既有 `Enrollment.notes` 的既有先例（選填、簡短備註等級，不需要 `DemandRequest.description` 等級的長度）——這個 repo 目前沒有其他「使用者對彼此的開放式文字回饋」欄位可以參考，`notes` 是最接近的既有精神（簡短、選填、非正式文件）。
- **修正（codex round 1 指出的問題，已採納）：`Review` model 不新增 `teacherProfileId` 欄位。** 原始 `docs/domain/data-model.md` 的欄位清單裡有 `teacherProfileId`，但一筆 Review 本來就透過 `classSessionId` 關聯到 `ClassSession`，而 `ClassSession.teacherProfileId` 已經明確記錄授課老師——如果 `Review` 自己再存一份 `teacherProfileId`，一般的外鍵機制沒有辦法保證這兩個值永遠一致（沒有 DB 層級的一致性檢查），未來任何一次疏忽的寫入都可能讓一筆評價「掛」在錯的老師底下卻無法被偵測。而且核對過本輪實際規劃的查詢（`listReviewsForClassSession` 用 `classSessionId` 查、Teacher 端的評價顯示是透過 `listOwnClassSessionsForTeacher` 既有的 `teacherProfileId` own-scoped 查詢外加 nested select 取得，見 D7 修正版），**沒有任何一個規劃中的查詢真的需要直接用 `Review.teacherProfileId` 查詢**——這是照抄原始欄位清單、沒有驗證是否真的用得到的多餘欄位，拿掉即可，需要授課老師資訊時一律透過 `classSession` 關聯取得。

### D3 — 可不可以編輯或刪除？

- **推薦：不行，一次到位，不提供編輯/刪除。** 比照這個系列一貫的 V1 最小化原則（`ClassSession` 建立後不可編輯、`TeacherProfile.rejectionReason`/`suspensionReason` 只能被 Admin 動作覆寫而非本人編輯）。允許編輯評價會需要額外的「editedAt」時間戳、UI 編輯流程、甚至可能的濫用防護（例如留了好評又改成負評），這些都超出「basic」的範圍。`@@unique([classSessionId, reviewerUserId])` 保證一位 Member 對同一堂課至多留一則評價，資料庫層面直接擋下重複提交。

### D4 — 誰看得到評價？要不要 `visibility` 欄位？

- **推薦：拿掉 `visibility` 欄位，評價只給三方看：留言的 Member 自己、該堂課的 Organizer（own-scoped）、被評價的 Teacher（own-scoped）。** 2.1 已經逐一核對過 `docs/product/route-map.md` 的完整 Teacher 路由清單——V1 沒有任何公開可瀏覽的老師列表或個人頁，`visibility`（例如區分 `public`/`private`）這個欄位不管值是什麼都沒有任何頁面會消費它，屬於「為假設中的未來需求先建欄位」，違反這個專案一貫「不做超出目前需求的抽象」的原則。`docs/domain/data-model.md` 既有的欄位清單會在本輪同步修正（見 D9），並附上這個理由，避免未來規劃者誤以為 V1 就有公開評價頁。
- **修正（codex round 1 指出的問題，已採納）：Organizer／Teacher 看到評價時，作者身分明確顯示 Member 的既有 display label，不做匿名化。** 原始 D7 草稿留了一句「匿名或顯示 Member 名稱」沒有拍板，這裡明確決定：**顯示**，比照既有 roster 顯示（`ClassSessionRosterEntry.memberLabel`，`entry.user.name ?? entry.user.email`）的既有 label 邏輯與既有先例，不新增匿名機制。理由：Organizer／Teacher 本來就透過既有的報名名單（roster）知道這堂課上了哪些 Member，把評價作者匿名化在這裡沒有實質隱私效果（隨時可以對照名單猜出來），只會讓評價少一個可信度依據，屬於沒有必要的額外複雜度。

### D5 — 通知設計？

- **推薦：兩個新事件，各自只通知一種角色，不通知 Admin 或 Organizer。**
  1. **`class_session_completed`**（`completeOwnClassSession` 觸發，兌現 `class-session-completion` D5 的既有承諾）：收件人是每一位對該 `ClassSession` 仍是 `confirmed` 的 Member，角色 reuse 既有的 `affected_member`（`class-session-cancellation` 新增的角色，語意是「因為這個事件而受影響/相關的 Member」，跟本輪「邀請這些 Member 留下評價」的語意吻合，不需要新角色）。**不通知 Organizer／Teacher**：他們是自己觸發完成這個動作的人，不需要被告知自己剛做的事。
  2. **`review_submitted`**（`submitOwnReview` 觸發）：收件人只有被評價的 Teacher 自己，角色 `counterpart`（比照 `demand_response_submitted` 「Organizer 收到 Teacher 回應」的既有先例——這裡對稱地是「Teacher 收到 Member 的評價」）。**不通知 Organizer**：Organizer 想看評價可以隨時造訪自己的 class 詳情頁（D7），不需要主動推播；**不通知 Admin**：沒有既有的評價管理/審核機制，Admin 收到通知也無事可做。

### D6 — 併發設計：需不需要 `SELECT ... FOR UPDATE`？

- **推薦：不需要。** 跟既有 `submitDemandResponseForTeacher` 完全同一種形狀：單一使用者對單一 `(classSessionId, reviewerUserId)` 組合的一次性 INSERT，沒有需要跨列協調的 cascade（不像 select 需要同時把其他 response 轉 declined、把 demand 轉 matched）。原子 INSERT 用 `WHERE EXISTS (...)` 同時檢查 enrollment 資格與 class session 是否 `completed`，`@@unique([classSessionId, reviewerUserId])` 這個資料庫層面的 unique constraint 本身就是唯一需要的併發保護——兩個並發請求最多只有一個會成功寫入，另一個會撞到 P2002，被 `isUniqueConstraintViolation` 捕捉並回傳明確的 `review_already_exists`（比照既有先例的既有錯誤處理手法）。

### D7 — UI 放哪裡？

- **推薦**：三個既有頁面各自新增一個條件式區塊，不新增任何新路由。
  - `src/app/member/enrollments/page.tsx`：`enrollment.status === "confirmed" && enrollment.classSession.status === "completed"` 時，顯示評價區塊——如果已經有資料，顯示唯讀的既有評價；否則顯示表單（`<select>` 1–5 分 + 選填 textarea + 送出按鈕），比照既有「取消報名…」`<details>` 區塊的既有版型（但評價表單不需要 confirm checkbox 這種二次確認，因為這不是破壞性動作）。**修正（codex round 1 指出的問題，已採納，見下方 D7 N+1 修正說明）**：這個頁面判斷「是否已經評價過」不透過額外呼叫 `getOwnReviewForClassSession`，而是直接使用 `listOwnEnrollmentsForMember` 擴充後、隨列表一併帶出的評價資料。
  - `src/app/organizer/classes/[classSessionId]/page.tsx`：`classSession.status === "completed"` 時，顯示「課程評價」區塊，列出 `listReviewsForClassSession` 回傳的所有評價（rating + comment + Member 顯示名稱，見上方 D4 修正版——不匿名化，比照既有 roster label 的既有顯示邏輯）。
  - `src/app/teacher/classes/page.tsx`：`classSession.status === "completed"` 時，顯示「課程評價」區塊，列出該堂課收到的評價，比照既有 roster 區塊的既有版型（`["open_for_enrollment", "completed"].includes(...)` 那種既有寫法，但這裡只在 `completed` 顯示，因為 `open_for_enrollment` 狀態不可能有任何評價）。
  - **不做評分聚合顯示**（2.3 已列為 non-goal）：只列出個別評價，不計算平均分數——平均分數需要額外的聚合查詢與呈現設計，且沒有下游需要（沒有公開頁面會用到，見 D4），屬於超出本輪「basic」範圍的裝飾性功能，需要時可以作為獨立的小 slice 加上。
  - **不新增 `docs/product/route-map.md` 路由列**：三個區塊都掛在既有路由上，沒有新路由。
  - **修正（codex round 1 指出的問題，已採納）：`src/domain/review/read-service.ts` 不新增獨立的 `getOwnReviewForClassSession` 函式，直接拿掉。** 原始草稿設計 Member 頁面對每一筆 `completed` 狀態的 enrollment 各自呼叫一次 `getOwnReviewForClassSession(classSessionId)` 來判斷「這筆是否已經評價過」——如果一位 Member 有多筆已完成課程，這個頁面就會產生 N+1 查詢（列表本身一次查詢，外加每一行各一次額外查詢）。改為直接擴充 `listOwnEnrollmentsForMember()` 既有查詢的 nested select，在 `classSession` 底下一併帶出這位使用者對這堂課的既有評價（`reviews: { where: { reviewerUserId: currentUser.id }, select: { id: true, rating: true, comment: true } }`，需要 `ClassSession` model 新增 `reviews Review[]` 反向關聯）——一次查詢就拿到「這堂課完成了嗎」與「我評價過了嗎」兩個判斷所需的全部資料，不需要額外的函式或額外的請求，比照既有 `enrollment` domain D9「roster 一次隨列表帶出，避免 N+1」的既有先例。`src/domain/review/read-service.ts` 因此只剩 `listReviewsForClassSession`（Organizer own-scoped，供 Organizer 頁面使用）；Teacher 端一樣透過 `listOwnClassSessionsForTeacher` 既有查詢擴充 nested select 取得（見 3.1 in-scope 清單），不需要額外函式。

### D8 — Migration 風險確認

- **推薦：新增一個 model（`Review`）+ 兩個新的 `NotificationType` enum 值，都是低風險加法變更。** `CREATE TABLE "Review"` 不影響任何既有資料表；`ALTER TYPE "NotificationType" ADD VALUE` 兩次，不影響任何既有 enum 值或既有資料（跟 `demand-request-cancellation` D8、`teacher-profile-suspension` D8 是同一類已經驗證過的低風險 migration）。

### D9 — 文件對齊策略？

- **推薦**：
  1. `docs/domain/data-model.md` 的既有 `Review` 區塊（目前只有欄位清單，沒有任何說明文字）要補上「已落地」標記、修正欄位清單**同時**拿掉 `visibility`（D4）**與 `teacherProfileId`**（D2，codex round 2 指出原本這裡漏了後者，已修正——這兩個欄位都要從既有清單移除，不是只有 `visibility`），並比照其他已落地 model 的既有格式補上欄位語意說明（含說明為什麼不需要 `teacherProfileId`：授課老師一律透過 `classSession` 關聯取得）。
  2. `docs/domain/permissions-matrix.md` 新增一個全新的 `## Review` 區塊（目前完全沒有）——`Create review` 僅 Member own-scoped（且 own-scoped 的判斷條件是 confirmed enrollment + class completed，不是泛用的 Member capability）；`View own review`／`View reviews for own class session`／`View reviews received`（Teacher own-scoped）。
  3. `docs/product/notification-spec.md` 落地現況段落追加 `class_session_completed`／`review_submitted` 兩個新事件，比照既有格式說明這是原始事件表沒有規劃過的新事件。
  4. `docs/specs/class-session-and-enrollment-spec.md` 的既有「落地現況」段落追加一條，說明 Review 功能已經在這一輪落地，這是這條 user flow（demand → matched → class → enrollment → **review**）最後一塊拼圖。**不新增獨立的 `docs/specs/review-spec.md`**：本輪範圍小（一個表單 + 三處唯讀顯示），比照這個 repo 對「規模較小、跟既有 spec 主題高度相關的新能力」一貫選擇併入既有 spec 而非另開新檔的既有慣例（例如 `class-session-cancellation`／`class-session-completion` 都沒有各自獨立的 spec 檔案，都是併入 `class-session-and-enrollment-spec.md` 的落地現況段落）。
  5. **不修改 `docs/scope/v1-scope.md`／`docs/scope/future-expansion.md`**：這兩份是最初的範圍規劃輸入文件，這個專案至今從未在任何一輪修改過它們（一貫只更新「落地現況」類的追蹤文件，不回頭改規劃輸入文件本身）。

## 6. 品牌與 UX 規則

- 評價表單文案清楚、溫和，不強迫填寫文字回饋（只有星等必填）。
- Teacher／Organizer 看到的評價原樣呈現，不做情緒性引導文案。

## 7. RWD Requirements

- 三個新增區塊在 360px 手機寬度可用，比照既有區塊版型，星等選擇器不使用複雜的自訂元件（用原生 `<select>`）。

## 8. 實作切片（Slice 1–3；施工前提：D1–D9 已拍板）

### Slice 1 — Schema + Review domain service

- `prisma/schema.prisma`：`Review` model（D1/D2/D3/D4，不含 `teacherProfileId`／`visibility`）、`ClassSession` 新增 `reviews Review[]` 反向關聯（D7 修正版）、`NotificationType` 新增兩個值（D5/D8）；跑 `npx prisma migrate dev`，核對 migration SQL 只是 `CREATE TABLE`／`ADD VALUE`，不影響既有資料。
- `src/domain/review/validation.ts`：`validateReviewInput`（D2）。
- `src/domain/review/service.ts`：`submitOwnReview`（D1/D2/D3/D6）。
- `src/domain/review/read-service.ts`：`listReviewsForClassSession`（D7 修正版，不含 `getOwnReviewForClassSession`）。
- `src/domain/notification/types.ts`／`copy.ts`：`class_session_completed`（`affected_member` 角色）／`review_submitted`（`counterpart` 角色）文案（D5）。
- `src/domain/class-session/service.ts`：`completeOwnClassSession` 補上 `class_session_completed` 通知呼叫（D5，tx commit 之後才執行，try/catch 隔離失敗，比照既有先例）。
- **實作補充（施工時發現，比照 `teacher-profile-suspension` 一輪的既有解法）**：`submitOwnReview` 的 `review_submitted` 通知呼叫本來規劃放在 auth-wrapper（`service.ts`），但這樣會讓通知邏輯困在需要真正 HTTP session 才能觸發的函式裡，無法在 Node context 直接驗證通知正確性。改為把 resolver query（class title／被評價老師的 userId／留言者顯示名稱）與 `notifyOverride` 呼叫都放進 `__internal__/submit-review-core.ts` 的 `submitReviewForUser`（新增可選的 `notifyOverride` 參數，預設值為真正的 `notifyUsers`），`service.ts` 縮減成只做 `requireUser()` 把關 + 輸入驗證 + 委派，比照 `suspendApprovedTeacherProfileForAdmin` 已經驗證過的同一個模式。
- **驗證**：throwaway `tsx` script 直接呼叫 `submitReviewForUser`（`__internal__` pure-core，不需要 `requireUser()`）／`listReviewsForClassSession`（這個仍然需要 `requireUser()`，無法直接呼叫，IDOR 驗證延到 Slice 3 的 Playwright UI 測試），涵蓋：符合資格成功寫入、`class_session` 非 completed 時擋下、`enrollment` 非 confirmed 時擋下、重複評價擋下（`review_already_exists`）、rating/comment 驗證邊界、`review_submitted` 通知正確性（用 `notifyOverride` 注入驗證收件人與文案）。

### Slice 2 — UI

- `src/domain/enrollment/read-service.ts`：`listOwnEnrollmentsForMember` 的 select 擴充（含 nested `reviews`，D7 修正版）。
- `src/domain/class-session/read-service.ts`：`listOwnClassSessionsForTeacher` 的 select 擴充（含 nested `reviews`）。
- `src/app/member/enrollments/page.tsx`／新增 `actions.ts` 內的 `submitReviewAction`：評價表單（D7）。
- `src/app/organizer/classes/[classSessionId]/page.tsx`：評價顯示區塊（D7）。
- `src/app/teacher/classes/page.tsx`：評價顯示區塊（D7）。
- **驗證**：瀏覽器實際操作——建立 completed class session（含 confirmed enrollment）、Member 留下評價、確認 Organizer／Teacher 頁面正確顯示（含 Member 顯示名稱，D4 修正版）、Member 頁面顯示唯讀版本、不可重複送出。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/class-session-review.spec.ts`：涵蓋 Slice 1 驗證清單的所有邊界（用真正的 Playwright smoke 測試取代 throwaway script 的等價案例）、通知正確性、**IDOR（非本人 Organizer 看不到別人 class session 的評價；Teacher 只看得到指派給自己的 class session 的評價；Member 的評價列表不包含同一堂課其他 Member 的評價內容）**（codex round 1 指出的問題，已採納）、完整 UI E2E 流程（Member 留評價 → Organizer/Teacher 看到）。
- 更新 `docs/domain/data-model.md`（D9 第 1 點）、`docs/domain/permissions-matrix.md`（D9 第 2 點）、`docs/product/notification-spec.md`（D9 第 3 點）、`docs/specs/class-session-and-enrollment-spec.md`（D9 第 4 點）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 → 2 必須先完成（domain service 先於 UI）。Slice 3 排最後。

## 9. Verification Planning

- Domain 層（Slice 1）：throwaway `tsx` script 直接對本機 Postgres 驗證，跑完即刪除腳本與測試資料。
- UI 層（Slice 2）：瀏覽器手動驅動 + Prisma 查 DB 核對。
- 最終：跑 `npm run lint` 與全套 `npm run test:smoke`（先確認 port 3000 無殘留 process）。

## 10. Rollback 總則

- Slice 1 的 migration 只新增一個新 model 與兩個 enum 值，本機開發資料庫可用 `prisma migrate reset` 復原，不影響任何已部署環境（本專案目前沒有已部署環境）。
- 本輪唯一觸碰既有已出貨程式碼的地方是 `completeOwnClassSession` 補上的通知呼叫——這是新增的 try/catch 隔離區塊，不改變既有的狀態轉換邏輯本身，回滾這部分不影響任何既有資料的可見性或正確性，可以安全整批 `git revert`。

## 11. Planning-only self review

- 已核對：`docs/product/route-map.md` 完整 Teacher 路由清單，確認 V1 沒有任何公開老師列表/個人頁，`visibility` 欄位沒有下游可以消費，這是拿掉這個欄位的直接證據，不是猜測。
- 已核對：`class-session-completion` D5 明確承諾這一輪要補上「邀請留下評價」通知，本輪 D5 兌現這個承諾。
- 已核對：`Enrollment.notes` 是這個 repo 唯一可參考的「選填簡短文字」既有先例，`comment` 欄位的長度上限直接沿用同一個常數精神。
- 已核對：`submitDemandResponseForTeacher` 的既有「unique constraint 當併發保護，不用 FOR UPDATE」寫法，確認 `submitOwnReview` 可以直接比照，不需要更重的鎖機制。
- 待 codex 檢查：D1 的資格條件（confirmed enrollment + completed class）是否有遺漏的邊界情況（例如 enrollment 先 confirmed、後來被 organizer 取消課程連帶取消，這種情況下 class session 會是 `cancelled` 不是 `completed`，理論上不會發生資格誤判，但需要交叉確認）；D5 只通知 Teacher 不通知 Organizer 是否有遺漏的產品價值；D7 的三處 UI 插入點是否有遺漏的既有程式碼相依性需要核對（本輪撰寫時只讀了現況，還沒逐行核對三個檔案目前確切的最新版本）。

<!-- codex-peer-reviewed: 2026-07-29T07:02:46Z rounds=3 verdict=approved -->
