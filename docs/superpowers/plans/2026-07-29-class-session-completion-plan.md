# ClassSession Completion — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D8）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

「媒合 → 開課 → 完成」這條主線目前卡在「開課」：`ClassSession` 一旦 `open_for_enrollment`，就永遠停在那個狀態，沒有任何方式標記「這堂課真的上完了」。`ClassSessionStatus` enum 裡的 `completed` 從一開始就保留但從未接線，`docs/domain/permissions-matrix.md` 明確把它列為「V1 仍不接線」。這是這條主線走到底之前的最後一塊缺口——完成之後才有意義的下一輪功能（Review／課後評價）需要一個明確的「這堂課已經結束」的資料事實可以依附，本輪先把這個事實補上。

### 1.2 風險等級

低。這是一個 Organizer own-scoped、單一狀態欄位翻轉的動作，沒有 cascade（見 D3）、沒有新的 migration（`completed` enum 值已經保留，見 2.1）、沒有新的 Notification 事件（見 D5，本輪刻意不加）。唯一需要注意的是不要把「已完成」的資格判斷做錯（見 D1/D2），以及正確修正 `permissions-matrix.md` 裡一段已經跟落地狀態矛盾的舊敘述（延續 `class-session-cancellation`／`demand-request-cancellation` 已經修正過同類敘述的先例）。

### 1.3 命名澄清

- **本輪的「完成」**指 `ClassSession.status: open_for_enrollment → completed`，純粹是「這堂課的時間已經過去、Organizer 確認這堂課發生過」的資料事實標記，**不等於**「出席紀錄」（`Enrollment.attended`/`no_show`，見 D3，本輪明確不做）。
- 跟 `enrollment` 一輪 D11 已經寫明的「V1 不做完整 Teacher attendance workflow」是同一個既有邊界，本輪沒有改變它，只是再次確認並延續。

## 2. 現況核對（Repo Reality Audit；2026-07-29 working tree = committed `main` @ `9781fd1`）

### 2.1 已 committed 的基礎（可直接依賴）

- **`completed` enum 值已保留，不需要 migration**：`ClassSessionStatus`（`prisma/schema.prisma:267-274`）已經有 `completed`，跟 `class_session_cancelled` 當初的情況一樣，本輪只是接線既有值，不像 `demand-request-cancellation` D8 那樣需要真的跑一次 `ALTER TYPE ... ADD VALUE`。
- **文案已經備齊**：`src/app/organizer/classes/_components/status-labels.ts` 的 `classSessionStatusLabels`/`classSessionStatusToneClasses`（line 4-20）已經有 `completed: "已完成"`（`bg-emerald-100 text-emerald-800`），從未被觸發過。這兩個 map 同時被 `src/app/organizer/classes/page.tsx`（line 65）與 `src/app/teacher/classes/page.tsx`（line 56-58）**通用引用**——一旦 `ClassSession.status` 真的變成 `completed`，這兩個既有頁面會**自動**顯示「已完成」徽章，不需要改這兩個檔案任何一行程式碼就能正確顯示狀態徽章。
- **修正（codex round 1 指出的問題，已採納）：Teacher 端 roster 顯示條件本輪必須改，不是「不需要改」**：`src/app/teacher/classes/page.tsx` line 105 的 roster 區塊跟 Organizer 詳情頁一樣，也是寫死 `classSession.status === "open_for_enrollment"` 才顯示已報名會員清單（逐行確認過，先前 2.1 稿子誤判成「兩個既有頁面都不用改」，只有狀態徽章那部分不用改，roster 顯示條件這部分必須跟 Organizer 詳情頁同步擴大，否則老師在課程完成後會突然看不到自己教過的班級名單，見 D6）。
- **單一狀態轉換不需要 `__internal__` + hooks 的既有先例**：`openOwnClassSessionForEnrollment`（`src/domain/class-session/service.ts` line 148-222，D2 已確認）是同一種「Organizer own-scoped、單一 organizer 對自己單一 class session 的單一欄位翻轉」，沒有多方競爭同一資源的併發場景，直接用 `prisma.classSession.updateMany({ where: {...guard}, data: {...} })`，`count === 0` 時再查一次區分確切錯誤原因。本輪的「標記完成」是同一種形狀，比照同一個既有先例，**不需要**新的 `__internal__` pure-core 檔案（跟 `cancelClassSessionForOrganizer` 需要 cascade Enrollment、因此需要 `__internal__`+hooks 的情況不同）。
- **`open_for_enrollment` 是唯一可能的來源狀態**：`docs/domain/state-machines.md` 已確認 `pending_confirmation`/`confirmed` 兩個 enum 值保留但從未接線，V1 唯一會停留的「活躍」狀態就是 `open_for_enrollment`（`draft` 只是尚未開放，`cancelled`/`completed` 是終止狀態）。
- **修正（codex round 1 指出的問題，已採納）：`getClassSessionForMember`（`src/domain/enrollment/read-service.ts` line 61-93）目前只認 `status: "open_for_enrollment"`，這件事本身在本輪之後會變成一個真的行為回歸，不是「維持既有行為」**：現況是這個查詢的 `where` 只認 `open_for_enrollment`，但因為 `completed` 從未被觸發過，一堂已經過期的課程今天永遠停留在 `open_for_enrollment`，會員透過既有連結造訪仍然看得到完整內容（走下方 `hasStarted` 分支顯示「這堂課程目前無法報名，可能已經開始。」，只是不能再報名）。本輪一旦真的把過期課程轉成 `completed`，同一個連結會**第一次**因為這個查詢排除 `completed` 而變成 404——這是本輪新增的行為劣化，不是延續 `cancelled` 的既有先例（`cancelled` 從一開始上線就是這個查詢排除的狀態，本輪不是造成 `cancelled` 404 的原因）。已完成的課程對已報名會員而言仍然是有意義的歷史紀錄（未來 Review 一輪很可能需要從這個連結導向留下評價），沒有理由讓它消失。修正方案見 D7。
- **`listOwnEnrollmentsForMember`（同檔案 line 20-35）不受 `ClassSession.status` 限制**：Member 在 `/member/enrollments` 永遠看得到自己的報名紀錄，不管對應的 class session 現在是什麼狀態——`completed` 之後這筆歷史報名紀錄依然正確顯示，不需要改這個檔案。
- **`cancelOwnEnrollment`（`src/domain/enrollment/service.ts` line 140-215）已經預留了對 `attended`/`no_show` 的伏筆**：既有註解明確寫著取消要卡在 `startAt` 之前，理由包含「讓這筆 enrollment 永遠無法在未來銜接 `confirmed → attended/no_show`」——確認這是本專案早就規劃好、但尚未落地的方向，本輪不動它（見 D3）。
- **`Review` model（`prisma/schema.prisma`）目前沒有對應的 `src/domain/review/` 目錄**：完全未落地，本輪不觸碰，只是確認完成之後 Review 一輪要依賴的「這堂課已完成」事實由本輪提供。

### 2.2 上游依賴狀態

- 無新的上游依賴。本輪不需要 `demand-request-cancellation` 或其他任何進行中/最近落地輪次的變更。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不做 Enrollment 的 `attended`/`no_show` 標記（見 D3）——這是完全獨立的「誰出席了」子功能，`enrollment` D11 已經明確列為 V1 不做，本輪不擴大範圍。
- 不新增 Notification 事件（見 D5）。
- 不做 Review 功能本身——本輪只提供 Review 未來需要依賴的「已完成」狀態事實，不建立 `src/domain/review/` 或任何 Review 相關 UI/API。
- 不做系統自動完成（例如 cron 在 `endAt` 一到就自動翻轉）——這個 repo 目前沒有 cron/queue infra（`class_reminder_basic` 通知一直沒接線就是同一個既有限制），本輪維持「Organizer 明確按按鈕觸發」的一貫模式。
- 不改動 `next.config.ts`／`package.json`／`playwright.config.ts`。
- 不回頭修改 `openOwnClassSessionForEnrollment` 既有的兩次取時寫法（見 Slice 1 的修正說明）——那是已出貨的既有行為，本輪只在新函式 `completeOwnClassSession` 採用單一 `now` 的寫法，不觸碰既有函式。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `src/domain/class-session/service.ts` 新增 `completeOwnClassSession(classSessionId)`（Organizer own-scoped，見 D1/D2/D4）。
- `src/domain/enrollment/read-service.ts` 的 `getClassSessionForMember` 查詢條件擴大到同時允許 `completed`（見 D7）。
- `src/app/organizer/classes/[classSessionId]/actions.ts` 新增 `completeClassSessionAction`；`page.tsx` 新增「標記完成」區塊（見 D6），並把 roster 顯示條件從只認 `open_for_enrollment` 擴大成同時認 `completed`。
- `src/app/teacher/classes/page.tsx` 的 roster 顯示條件同步擴大成同時認 `completed`（見 D6）。
- Playwright smoke 測試（狀態邊界 + 時間邊界 + IDOR + 重複標記 + roster 在 completed 狀態下於 Organizer 與 Teacher 兩端皆仍可見 + Member 公開連結在 completed 狀態下仍可見（不 404）+ 完整 UI E2E 流程）。
- 文件對齊：`docs/domain/state-transition-details.md`、`docs/domain/state-machines.md`、`docs/domain/permissions-matrix.md`、`docs/specs/class-session-and-enrollment-spec.md`（落地現況段落追加）。

### 3.2 本輪明確不包含

見 2.3。

## 4. 安全與權限設計

- `completeOwnClassSession` 必須 own-scoped：`requireUser()` 解析出 `organizerProfileId`，更新查詢的 `WHERE` 同時驗證 `id` 與 `organizerProfileId`，非自己的 class session 一律回傳 not-found 語意（比照既有 `openOwnClassSessionForEnrollment`／`cancelOwnClassSession` 先例）。
- Admin 不介入（見 D1，延續系列先例，並修正 `permissions-matrix.md` 的舊敘述，見 D8）。

## 5. 產品主人決策 Gate（D1–D8）

### D1 — 誰可以標記完成？從哪個狀態可以標記？

- **推薦：Organizer own-scoped，Admin 不介入。只能從 `open_for_enrollment` 觸發。** `docs/domain/permissions-matrix.md` 目前把 `Complete class session` 寫成「Admin」，但這是完整設計的佔位敘述，不是 V1 決策——跟 `Cancel class session`／`Cancel demand` 當初的情況一模一樣（兩者原始表格也都寫 Admin，V1 落地時都改成 Organizer own-scoped，`class-session-cancellation` D1、`demand-request-cancellation` D1 已經是同一個模式）。本輪延續同一個系列先例。來源狀態只能是 `open_for_enrollment`：`draft` 從未開放報名，沒有人可能出席過，若 Organizer要停止一個從未開放的課程，應該用既有的「取消課程」，不是「標記完成」；`pending_confirmation`/`confirmed` 從未接線，不可能是實際存在的來源狀態（2.1 已確認）。

### D2 — 需不需要時間限制？

- **推薦：需要，且方向與既有的「取消」/「開放報名」相反。** 只能在 `endAt` 已經過去之後才能標記完成——不能把一堂還沒發生或正在進行中的課程標記為「已完成」，這會讓「完成」這個狀態失去「這件事真的發生過」的意義，而這正是下一輪 Review 功能要依賴的前提（「已完成」代表「Member 真的有機會參加，可以留下評價」）。比照既有 `openOwnClassSessionForEnrollment` D14（`startAt` 尚未到達才能開放）、`cancelOwnClassSession` D2（`startAt` 尚未到達才能取消）把時間 guard 直接寫進 `updateMany` 的 `WHERE` 子句、不額外查詢的既有手法，本輪用 `endAt: { lte: now }` 做相反方向的守門。

### D3 — Enrollment 要不要連帶處理（attended/no_show）？

- **推薦：不做。** `EnrollmentStatus` 的 `attended`/`no_show` 兩個 enum 值保留，但本輪明確不接線，延續 `enrollment` D11 已經寫明的「V1 不做完整 Teacher attendance workflow」這個既有邊界（2.1 已確認這個既有註解本身就預告了這個方向）。標記完成只單純翻轉 `ClassSession.status`，不觸碰任何 `Enrollment` 列——`confirmed` 的 enrollment 在課程完成後仍然是 `confirmed`，語意上完全合理（代表「這位會員確實報名了這堂已完成的課程」這個歷史事實），不需要額外轉換，也不需要新的 cascade 邏輯。

### D4 — 併發設計：需不需要 `__internal__` pure-core + hooks？

- **推薦：不需要。** 跟 `openOwnClassSessionForEnrollment`（D2）同一個理由：這是單一 organizer 對自己單一 class session 的單一狀態欄位翻轉，沒有其他角色會競爭同一個資源（不像 `createEnrollmentForUser` vs `cancelClassSessionForOrganizer` 那樣需要跟 Member 併發搶鎖，也不像 D4 的連帶取消需要多步驟原子性）。用單一 `prisma.classSession.updateMany({ where: { id, organizerProfileId, status: "open_for_enrollment", endAt: { lte: now } }, data: { status: "completed" } } )` 即可——Postgres 對單一 UPDATE 陳述式本身就有列鎖，足以正確序列化跟既有「取消課程」之間的競態（同一個 organizer 幾乎不可能真的同時點兩個按鈕，但就算發生，兩個都是單一 atomic UPDATE，最終只有其中一個的 `WHERE` 條件還成立，不會產生矛盾狀態——跟 `demand-request-cancellation` 2.1 已經論證過的「Admin 的 publish/reject 是單一 updateMany，不需要額外鎖」是同一類推理）。

### D5 — 要不要新增 Notification？

- **推薦：本輪不新增。** 理由有兩個：(a) 「課程已完成」這個事實本身資訊價值有限——Organizer／Teacher 對自己排定的課程時間通常已經知道課已經結束，不像「被取消」或「被選中」那樣是需要主動告知的意外變化；(b) 更有價值的通知其實是「邀請留下評價」，但那需要 Review 功能存在才有意義。與其本輪先加一個資訊量低的「已完成」通知、下一輪 Review 又要再加一個「邀請評價」通知（等於同一個時間點對使用者連續發兩則低資訊量通知），不如把「課程完成」的通知價值整合進 Review 那一輪的事件裡一次做好（屆時文案可以直接帶「立即留下評價」的 CTA，資訊量更高）。這對齊本專案一貫的 V1 最小化原則——沒有下游需要，就不先做；也代表本輪**不需要**任何 `NotificationType`／`NotificationRecipientRole` 變更，不需要 migration。

### D6 — UI 放哪裡？

- **推薦**：`src/app/organizer/classes/[classSessionId]/page.tsx` 在 `open_for_enrollment` 狀態下，且 `endAt` 已過時，顯示一個「標記完成…」區塊（比照既有「取消課程」/「開放報名」的既有先例：`<details>`/`<summary>` + 一個帶 confirm checkbox 的 `<form>`）。若 `endAt` 尚未到達，不顯示這個區塊（避免使用者點了才發現時間不對，被動等後端擋，比照 D2 的時間 guard 精神）。
- Roster 顯示條件（既有 line 52-55：`classSession.status === "open_for_enrollment" ? 查詢並顯示 : []`）擴大為 `["open_for_enrollment", "completed"].includes(classSession.status)`——完成之後這堂課「當初報名了誰」這個資訊不應該消失，這也是未來 Review 一輪可能需要的資料前提。
- `src/app/organizer/classes/[classSessionId]/actions.ts` 新增 `completeClassSessionAction`，比照既有 `openForEnrollmentAction`/`cancelClassSessionAction` 的寫法（`revalidatePath` + `redirect` + query string 帶 result/message）。`revalidatePath` 需涵蓋 `/organizer/classes/${classSessionId}`、`/organizer/classes`、`/teacher/classes`（roster 顯示條件也在這個頁面擴大，見下一點）；不需要 revalidate `/member/enrollments`（D7 已確認 Member 端這個頁面不受 `ClassSession.status` 影響）。
- **修正（codex round 1 指出的問題，已採納）：`src/app/teacher/classes/page.tsx` 的 roster 顯示條件（line 105）必須跟 Organizer 詳情頁同步擴大**——從 `classSession.status === "open_for_enrollment"` 改成 `["open_for_enrollment", "completed"].includes(classSession.status)`，理由與上一點相同（老師也不該在課程完成後失去自己教過班級的名單）。這是本輪 Teacher 頁面**唯一**需要的程式碼變更；狀態徽章本身仍然不需要改（2.1 已確認）。
- Organizer 列表頁（`src/app/organizer/classes/page.tsx`）**不需要任何程式碼變更**（2.1 已確認透過既有的 `classSessionStatusLabels`/`classSessionStatusToneClasses` 通用顯示狀態徽章，這個頁面本來就不顯示 roster）。

### D7 — 標記完成後，公開分享連結與 Member 報名列表要不要變化？

- **修正（codex round 1 指出的問題，已採納）：`getClassSessionForMember` 的 `where` 需要一併把 `completed` 納入允許查看的狀態，不能維持只認 `open_for_enrollment`。** 2.1 已經重新論證過：今天過期課程永遠停留在 `open_for_enrollment`，會員造訪既有連結仍看得到完整內容；本輪把過期課程真的轉成 `completed` 之後，如果查詢條件不同步放寬，同一個連結會**第一次**因為這一輪新出現的狀態值而 404——這是本輪造成的新行為劣化，不是延續 `cancelled` 的既有先例。修正方式：`src/domain/enrollment/read-service.ts` 的 `getClassSessionForMember` 查詢條件從 `status: "open_for_enrollment"` 改成 `status: { in: ["open_for_enrollment", "completed"] }`。
  - **修正後不需要再改 `/classes/[classSessionId]/page.tsx` 的分支邏輯本身**：這個頁面既有的三段式分支（`ownEnrollment` 存在 → 顯示已報名/已取消徽章；不存在但 `hasClassSessionStarted(startAt)` 為真 → 顯示「這堂課程目前無法報名，可能已經開始。」；否則 → 顯示報名表單）已經足以正確處理 `completed` 狀態：`completed` 的來源狀態保證 `endAt` 已過，因此 `startAt` 也必然已過，`hasClassSessionStarted` 恆為真，會自然落入「已報名/已取消徽章」或「目前無法報名」兩個既有分支之一，不會誤顯示報名表單。文案沿用既有措辭即可，不需要為 `completed` 另外新增第四種分支（V1 最小化原則；未來 Review 一輪若要在這個頁面加「留下評價」CTA，屆時再針對 `ownEnrollment.status === "confirmed" && classSession.status === "completed"` 這個既有可推導的組合加分支）。
- `listOwnEnrollmentsForMember`（`/member/enrollments`）不受 `ClassSession.status` 限制，本來就會繼續正確顯示這筆歷史報名紀錄，不需要改動。

### D8 — `permissions-matrix.md` 需不需要修正？

- **推薦：需要。** 目前 `ClassSession` 表格的 `Complete class session` 這一列寫死「No / No / No / No / Admin」，且下方 V1 落地範圍段落也還沒提到這一列——這是完整設計的佔位敘述，本輪落地後要修正成 Organizer own-scoped、Admin 不介入，並補上時間限制（`endAt` 已過）與 roster 顯示擴大的說明，比照 `class-session-cancellation` D1 當初修正 `Cancel class session` 那一列、`demand-request-cancellation` D1 修正 `Cancel demand` 那一列的既有先例。

## 6. 品牌與 UX 規則

- 標記完成的文案清楚說明這是確認課程已經結束，不使用威脅或模糊字眼。
- 不做取消原因欄位那種額外輸入——單純一個 confirm checkbox 把關即可（比照系列既有先例）。

## 7. RWD Requirements

- 「標記完成」區塊在 360px 手機寬度可用，比照既有「取消課程」/「開放報名」區塊版型，不使用密集表格。

## 8. 實作切片（Slice 1–3；施工前提：D1–D8 已拍板）

### Slice 1 — 標記完成 domain service

- `src/domain/class-session/service.ts`：新增 `completeOwnClassSession(classSessionId)`（D1/D2/D4，單一 `updateMany`，比照 `openOwnClassSessionForEnrollment` 的既有寫法與錯誤碼分層手法：`class_session_not_found` → `class_session_already_completed` → `class_session_not_completable`（狀態不是 `open_for_enrollment`，例如 `draft`/`cancelled`）→ `class_session_not_ended`（`endAt` 尚未到達）→ `class_session_complete_failed`（理論上不會發生的防禦分支））。
- **修正（codex round 1 指出的問題，已採納）：`updateMany` guard 與 `count === 0` 後的分類查詢必須共用同一個 `now`，不能像 `openOwnClassSessionForEnrollment` 既有寫法那樣分別呼叫兩次 `new Date()`／`Date.now()`。** 既有寫法在極端邊界下（`endAt` 剛好落在兩次取時之間）會出現「`updateMany` 判定尚未到達 `endAt` 而失敗，但分類查詢重新取時後卻判定已經到達」的自相矛盾，最終誤落到 `class_session_complete_failed` 這個理論上不該出現的防禦分支，回傳一個對使用者沒有意義的錯誤訊息。本輪在函式最開頭呼叫一次 `const now = new Date()`，同時用於 `updateMany` 的 `endAt: { lte: now }` guard 與失敗後分類查詢的 `classSession.endAt.getTime() <= now.getTime()` 比較，徹底消除這個競態（不需要、也不建議回頭修 `openOwnClassSessionForEnrollment` 既有程式碼——那是既有 already-shipped 行為，不在本輪 scope，見 2.3）。
- **驗證**：throwaway `tsx` script 直接呼叫，涵蓋四種來源狀態邊界（`draft`/`open_for_enrollment` 已過期／未過期/`cancelled`/`completed` 自己）、IDOR、重複標記。

### Slice 2 — UI

- `src/app/organizer/classes/[classSessionId]/actions.ts`：`completeClassSessionAction`。
- `src/app/organizer/classes/[classSessionId]/page.tsx`：「標記完成」區塊（D6）；roster 顯示條件擴大到 `completed`（D6）。
- `src/app/teacher/classes/page.tsx`：roster 顯示條件同步擴大到 `completed`（D6，codex round 1 指出的修正）。
- `src/domain/enrollment/read-service.ts`：`getClassSessionForMember` 查詢條件擴大到同時允許 `completed`（D7，codex round 1 指出的修正）。
- **驗證**：瀏覽器實際操作——建立、開放報名、（用 Prisma 把 `endAt` 調到過去以模擬課程已結束）、Organizer 標記完成，確認頁面顯示「已完成」徽章、roster 仍然可見；Teacher 端 roster 同樣仍然可見（D6 修正後的行為，需實測，不能只靠既有機制帶過）；Member 透過既有分享連結造訪 completed 課程仍能看到內容、不 404（D7 修正後的行為）；Organizer 列表頁不改程式碼也正確顯示徽章（D6 已確認的既有機制）。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/class-session-completion.spec.ts`：D1/D2/D3/D6/D7 涵蓋的所有邊界（狀態邊界、時間邊界、IDOR、重複標記、roster 在 completed 狀態下於 Organizer 與 Teacher 兩端皆仍可見、Member 公開連結在 completed 狀態下仍可見且不 404、`/member/enrollments` 行為不變、完整 UI E2E 流程）。不需要決定性併發鎖測試（D4 已論證不需要 `__internal__`+hooks，跟既有 `openOwnClassSessionForEnrollment` 一致，該既有函式本身也沒有這類測試）。
- 更新 `docs/domain/state-transition-details.md`（ClassSession 新增 `open_for_enrollment → completed` 轉換說明）、`docs/domain/state-machines.md`（ClassSession V1 落地範圍更新）、`docs/domain/permissions-matrix.md`（`Complete class session` 列的 V1 落地範圍修正，見 D8）、`docs/specs/class-session-and-enrollment-spec.md`（落地現況段落追加本輪）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 → 2 必須先完成（domain service 先於 UI）。Slice 3 排最後。

## 9. Verification Planning

- Domain 層（Slice 1）：throwaway `tsx` script 直接對本機 Postgres 驗證，跑完即刪除腳本與測試資料。
- UI 層（Slice 2）：瀏覽器手動驅動 + Prisma 查 DB 核對（含手動把 `endAt` 調整到過去以建立「已過期但還沒標記完成」的測試情境）。
- 最終：跑 `npm run lint` 與全套 `npm run test:smoke`（先確認 port 3000 無殘留 process）。

## 10. Rollback 總則

- 本輪沒有任何 schema/migration 變更，純粹是既有 enum 值與既有 UI 元件的接線，不涉及資料庫結構復原。
- **修正（codex round 1/2/3 三輪反覆指出的問題，已採納，取代先前版本互相矛盾的敘述）：本輪的變更集合本質上是「forward-only」，`git revert` 整個 commit（或整批 revert 本輪所有檔案）不是安全的回滾手段，不能寫成「回滾只需要 revert 對應 commit」這種無條件敘述。** 理由：
  - `completed` 是一個已經發生過的歷史事實，資料本身**不該**被回滾抹除或改回 `open_for_enrollment`（rollout 期間已經被標記完成的 class session，即使功能之後被拔掉，也應該維持 `completed`）。
  - 但同一批變更裡混合了兩種本質不同的東西：(1) **mutation 進入點**——`completeOwnClassSession`（`service.ts`）、`completeClassSessionAction`（`actions.ts`）、Organizer 詳情頁裡「標記完成」那個 UI 區塊；(2) **read-path 擴大**——`getClassSessionForMember` 的 `status` 條件、Organizer 詳情頁與 Teacher 列表頁各自的 roster 顯示條件。後者只是「正確處理 `ClassSessionStatus.completed` 這個原本就合法、只是從未真正出現過的 enum 值」，一旦資料庫裡已經存在任何一筆 `completed` 的 class session，這三處 read-path 就**不能再被移除**，否則會讓那些既有資料重新變成 D6/D7 修正前的兩個已知 regression（會員連結 404、roster 消失）——不管 mutation 能力本身要不要保留。
  - **Organizer 詳情頁 `page.tsx` 是這兩類變更的交會點**：同一個檔案裡同時有「標記完成」UI 區塊（可安全移除）跟 roster 顯示條件擴大（一旦有 `completed` 資料就不可安全移除），因此**不能**用「revert 這個檔案」或「revert 這個 commit」當作安全的回滾單位——這個粒度太粗，兩類變更無法用檔案或 commit 邊界切開。
  - **若日後真的需要拔掉「標記完成」這個能力**：正確做法是寫一個新的 forward commit，只移除 `completeOwnClassSession`／`completeClassSessionAction`／Organizer 詳情頁的「標記完成」UI 區塊這三處，**逐 hunk** 處理、不觸碰同檔案裡的 roster 顯示條件那個 hunk，也不觸碰 `getClassSessionForMember`。這不是「回滾」，是「移除功能的新提交」，跟本專案其他輪次「schema 只加不減、回滾走 revert commit」的既有慣例不同——本輪是這個系列裡第一個「同一個檔案混合了永久性 read-path 修正與可撤回的 mutation 能力」的例外，需要明確記錄，避免未來有人直接對這個 commit 執行整批 `git revert`。

## 11. Planning-only self review

- 已核對：`ClassSessionStatus.completed`、`classSessionStatusLabels`/`classSessionStatusToneClasses` 的既有內容與被引用位置（`organizer/classes/page.tsx`、`teacher/classes/page.tsx`），確認接線後兩個既有頁面的**狀態徽章**不需要任何程式碼變更就會正確顯示；但 roster 顯示條件（Organizer 詳情頁、Teacher 列表頁各自獨立的一段 `status === "open_for_enrollment"` 判斷）兩處都要同步擴大，逐行確認過不是只有一處（codex round 1 指出 Teacher 端那處，已修正）。
- 已核對：`getClassSessionForMember` 目前只認 `open_for_enrollment`，本輪把過期課程真的轉成 `completed` 後，若不放寬查詢條件，會員既有連結會第一次因此 404——這是本輪造成的新行為劣化，已修正為同時允許 `completed`（codex round 1 指出，已採納）；`listOwnEnrollmentsForMember` 不受 `ClassSession.status` 限制，維持不變，這部分原始判斷正確。
- 已核對：`openOwnClassSessionForEnrollment` 的既有寫法（單一 `updateMany` + 分層錯誤碼 + 兩次獨立取時），確認本輪可以直接比照「不需要 `__internal__` 檔案」這個結構性決定，但**不**比照它兩次獨立取時的既有寫法（codex round 1 指出這在邊界情況下會自相矛盾，本輪改用單一 `now`，已修正）。
- 待 codex 檢查：D5「本輪不加 Notification、留給 Review 一輪一起做」是否有遺漏的使用者體驗風險；D2 的時間方向（`endAt` 已過才能標記）是否有遺漏的邊界情況；D3「不做 attended/no_show」是否會讓 Review 一輪之後反過來需要回頭修改本輪的資料模型。

<!-- codex-peer-reviewed: 2026-07-28T21:13:09Z rounds=4 verdict=approved -->
