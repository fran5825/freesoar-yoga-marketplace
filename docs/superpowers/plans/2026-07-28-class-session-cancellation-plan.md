# ClassSession Cancellation — Implementation Plan

> Status: DRAFT — 待 codex peer review。

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–8 節再開始施工，不要跳著讀。`## 5. 產品主人決策 Gate（D1–D10）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

### 1.1 產品問題

`docs/domain/permissions-matrix.md` 明確把 `Cancel class session` 列為「本輪仍不接線（D9），保留於表中作為未來 slice 參考」。目前 Organizer 建立課程後，完全沒有辦法取消——不管是老師臨時有事、報名人數不足、場地出狀況，Organizer 都無計可施。這是真實會發生的情境，也是目前 marketplace 交易流程裡唯一「進得去、出不來」的環節。本輪把這個能力補上。

`docs/product/notification-spec.md` 的 event 表本來就列有 `class_session_cancelled`，`NotificationType` enum 也已經保留這個值（`notification` 一輪特意保留、當時未接線）——本輪同時把這個保留欄位接上。

### 1.2 風險等級

中高。取消動作牽動兩個既有的併發敏感路徑：

1. Organizer 取消課程，跟 Member 同時報名（`createEnrollmentForUser`）搶同一個 `ClassSession` 資源，若沒有正確序列化，可能出現「會員在課程被取消的瞬間報名成功、但課程已經取消」的資料不一致（見 D3）。
2. 取消需要連帶處理既有的 `confirmed` Enrollment（見 D4），這條 cascade 邏輯若做錯，可能讓會員誤以為自己還要去上一堂已經取消的課。

### 1.3 命名澄清

- **「連帶取消」**：Organizer 取消 ClassSession 時，該課程底下所有 `status="confirmed"` 的 Enrollment 會在同一個 transaction 內一併轉成 `status="cancelled"`（D4）。這跟既有的「Member 自助取消報名」（`cancelOwnEnrollment`，enrollment 一輪已出貨）是兩個不同的觸發來源，但都會讓 Enrollment 進入同一個 `cancelled` 狀態。
- **`affected_member`**：本輪新增的第四種 `NotificationRecipientRole`（見 D7），代表「因為連帶取消而受影響的會員」，跟既有的 `self`/`admin`/`counterpart` 都不同——既有的 `counterpart` 假設一個事件最多一種對象，但 `class_session_cancelled` 同時要通知 Teacher（一位）與受影響的 Member（可能多位），需要能分別給不同文案。

## 2. 現況核對（Repo Reality Audit；2026-07-28 working tree = committed `main` @ `729644d`）

### 2.1 已 committed 的基礎（可直接依賴）

- `ClassSessionStatus` enum 已有 `cancelled`（終止狀態，目前完全未接線）。V1 目前唯一會實際出現的狀態只有 `draft` 與 `open_for_enrollment`（`pending_confirmation`/`confirmed`/`completed` 都保留未接線）。
- `src/domain/class-session/service.ts` 的 `openOwnClassSessionForEnrollment`（line 147–221）是既有的「單一 organizer、單一狀態轉換」guard 範例：不用 `__internal__` pure-core（因為沒有多方併發），guard 直接寫進 `updateMany` 的 `where`，`startAt` 已過的 class session 不可操作（D14 精神）。**本輪的取消動作不能照抄這個模式**——原因見 D3。
- `src/domain/enrollment/__internal__/create-enrollment-core.ts` 的 `createEnrollmentForUser`（line 73–168）是既有的「多方併發」pure-core 範例：`prisma.$transaction` 內先用 raw SQL `SELECT ... FOR UPDATE` 鎖住 `ClassSession` 行，再檢查 `status === "open_for_enrollment"`。本輪的取消必須鎖住**同一張表的同一行**才能正確序列化（D3）。
- `src/domain/class-session/__internal__/create-class-session-core.ts` 的 `createClassSessionForOrganizer`（line 74–171）是既有的「own-scoped + 鎖」範例：鎖查詢的 `WHERE` 子句本身就同時驗證擁有權（`organizerProfileId`），不用額外查詢。本輪的取消沿用同一個手法。
- `docs/superpowers/plans/2026-07-27-notification-plan.md` 已確認並驗證過的失敗隔離設計（D4/D7）：resolver query 與 `notifyUsers` 呼叫一律在主要 tx commit **之後**才用 `prisma`（不是 `tx`）執行，且外層包 try/catch；`createEnrollmentForUser` 已經有一個可注入的 `notifyOverride` 測試專用參數（第 5 個位置參數）可以直接參考同一個設計。
- `src/domain/notification/types.ts` 的 `NotificationRecipientRole` 目前只有 `"self" | "admin" | "counterpart"` 三種；`src/domain/notification/copy.ts` 的 `COPY_TABLE` 是 `Partial<Record<NotificationType, Partial<Record<NotificationRecipientRole, CopyBuilder>>>>`，每個 `(type, role)` 組合只能對應一份文案——這是本輪 D7 需要新增第四種角色的直接依據（稽核已確認，不是猜測）。
- `docs/domain/permissions-matrix.md` 的 ClassSession 範圍註記：`Cancel class session` 本輪（`class-session-creation`、`enrollment`、`notification` 三輪）都刻意跳過，保留給未來 slice；`Complete class session` 也還沒接線，本輪不動它。
- `src/app/organizer/classes/[classSessionId]/page.tsx` 已有 `draft`/`open_for_enrollment` 兩個狀態各自的條件區塊（開放報名表單、報名連結 + roster），與 `_components/status-labels.ts` 的 `已取消` 文案（cancelled 這個 label 早就備好，只是從未有實際資料觸發過）。
- `src/domain/enrollment/read-service.ts` 的 `listOwnEnrollmentsForMember`／`src/app/member/enrollments/page.tsx` 已經會依 `enrollment.status` 顯示「已取消」——連帶取消後，Member 自己的報名列表**不需要任何程式碼變動**就會正確顯示「已取消」（因為列表本來就是依 `status` 欄位渲染文案，不分辨取消來源）。
- `src/domain/class-session/read-service.ts` 的 `listOwnClassSessionsForTeacher`（line 111–148）的 `enrollments` 已經 `where: {status:"confirmed"}` 篩選——連帶取消後，roster 裡的個別項目會自動消失，這部分不需要程式碼變動。
- **修正（codex round 1 指出的問題，已採納）**：`src/app/teacher/classes/page.tsx` 稽核後確認**完全沒有渲染 `classSession.status`**（逐行讀過整個檔案確認，不是假設）——目前只有 `classSession.status === "open_for_enrollment"` 這個條件式用來決定要不要顯示 roster 區塊，沒有任何狀態徽章。這代表課程被取消後，Teacher 在 `/teacher/classes` 看到的卡片會是「標題、時間、地點都正常顯示，只是 roster 區塊悄悄不見了」，Teacher 完全無法分辨這堂課是「還沒人報名」還是「已經被取消」——這是會誤導使用者的真實 UI 缺口，不是可以忽略的小事。本輪必須修正，見 D9 與 Slice 3。

### 2.2 上游依賴狀態

- `DemandRequest` 在 ClassSession 建立時已經由 `markDemandRequestAsConvertedToClassIfMatched` 轉成 `converted_to_class`（`class-session-creation` 一輪已確認）。本輪**不**讓 ClassSession 取消回頭影響 DemandRequest 的狀態（見 D5）。

### 2.3 Non-goals 邊界重申（不得偷偷併入本輪）

- 不做 `Complete class session`（`docs/domain/permissions-matrix.md` D9 仍標記不接線，本輪只做取消，不做完成）。
- 不做取消原因欄位（見 D6）。
- 不讓 DemandRequest 因為 ClassSession 被取消而連帶變化（見 D5）。
- 不做 Admin 代為取消（延續 `class-session-creation` D1、`enrollment` D2 系列先例：Admin 不介入 Organizer own-scoped 的動作）。
- 不處理「課程已經開始後才發現需要緊急取消」這個情境（見 D2）。

## 3. Scope Boundary

### 3.1 本輪 in-scope

- `src/domain/class-session/__internal__/cancel-class-session-core.ts`：新的 pure-core，鎖 + 狀態轉換 + Enrollment 連帶取消（D3/D4）。
- `src/domain/class-session/service.ts` 新增 `cancelOwnClassSession`（auth wrapper，比照既有 `openOwnClassSessionForEnrollment`/`createOwnClassSession` 的寫法）。
- `src/domain/notification/types.ts` 的 `NotificationRecipientRole` 新增 `"affected_member"`（D7）。
- `src/domain/notification/copy.ts` 新增 `class_session_cancelled` 的三種角色文案（`self`/`counterpart`/`affected_member`）。
- `src/app/organizer/classes/[classSessionId]/actions.ts` 新增 `cancelClassSessionAction`；`page.tsx` 新增取消區塊（D9）。
- `src/app/teacher/classes/page.tsx` 新增狀態徽章（D9 修正版，codex round 1 指出的缺口）。
- Playwright smoke 測試（決定性併發測試 + 連帶取消驗證 + 通知驗證 + 完整 UI E2E 流程）。
- 文件對齊：`docs/domain/state-transition-details.md`、`docs/domain/state-machines.md`、`docs/domain/data-model.md`、`docs/domain/permissions-matrix.md`、`docs/product/notification-spec.md`（落地現況段落更新）。

### 3.2 本輪明確不包含

見 2.3。額外重申：不改動 `next.config.ts`／`package.json`／`playwright.config.ts`。

## 4. 安全與權限設計

- `cancelOwnClassSession` 必須 own-scoped：`requireUser()` 解析出 `organizerProfileId`，鎖查詢的 `WHERE` 同時驗證 `id` 與 `organizerProfileId`，非自己的 class session 一律回傳 not-found 語意（比照 `createClassSessionForOrganizer` 既有先例），不洩漏存在性差異。
- Admin 不介入（見 2.3），也沒有對應的 Admin API。
- 連帶取消不需要受影響 Member 的 session——這是系統內部因果，不是使用者發起的 mutation（比照 notification 一輪 D-Security 章節的既有原則）。
- 通知內容不得洩漏超出既有頁面就會顯示的資訊（比照既有最小揭露原則）。

## 5. 產品主人決策 Gate（D1–D10）

### D1 — 誰可以取消？從哪些狀態可以取消？

- **推薦：Organizer own-scoped，Admin 不介入**（延續 `class-session-creation` D1、`enrollment` D2 系列先例，本輪不重新開放這個already-settled 的爭論）。可從 `draft` 與 `open_for_enrollment` 兩個狀態取消——這是目前 V1 唯一會實際出現的兩個非終止狀態（`pending_confirmation`/`confirmed`/`completed` 都還沒接線，defensive 起見取消 guard 仍會檢查狀態，但實務上不會撞到後三者）。已經是 `cancelled` 的 class session 再次取消，回傳「已經取消過」的明確錯誤碼，不是 no-op 成功。

### D2 — 課程開始後還能不能取消？

- **推薦：不行。** 比照 `enrollment` D14 的既有先例與理由：取消一堂已經開始（甚至已經上完）的課程，會抹除「這堂課真的發生過」這筆歷史紀錄的正確性，跟 Member 自助取消已開始課程的報名是同一類資料完整性問題，不是單純的「操作便利性」考量。`startAt` 已過的 class session 不可取消；guard 邏輯與 `enrollment` D14 完全一致（鎖查詢裡一併取回 `startAt`，在同一個 transaction 內比較）。
- V1 明確不處理「課程已經開始後才發現需要緊急取消」這個情境（2.3 已重申），這類例外留給 Admin 未來的手動介入能力（`Cancel class session` 表格裡的 Admin 欄位目前仍是完整未來設計）。

### D3 — 併發設計：需不需要 `__internal__` pure-core + hooks？

- **推薦：需要。** 這跟 `openOwnClassSessionForEnrollment`（單純狀態轉換，不用 pure-core）不同：取消動作會跟 `createEnrollmentForUser` 搶**同一個** `ClassSession` 資源——如果沒有鎖住同一行，可能發生「Member 的 `createEnrollmentForUser` 交易剛好在 Organizer 的取消交易之間插入，讀到 `status="open_for_enrollment"` 就建立了新的 `confirmed` Enrollment，但 Organizer 的取消交易緊接著把 ClassSession 轉成 `cancelled`」——這筆新報名永遠不會被連帶取消（因為它是在取消交易的 cascade UPDATE **之後**才建立的），造成「課程已取消、但還有一筆 confirmed 報名」的資料不一致。
- 做法：新增 `src/domain/class-session/__internal__/cancel-class-session-core.ts`，整段包在 `prisma.$transaction` 內，第一步用跟 `createEnrollmentForUser`／`createClassSessionForOrganizer` 完全一致的手法——`SELECT ... FOR UPDATE` 鎖住 `ClassSession` 那一行（`WHERE id = ... AND organizerProfileId = ...`，鎖查詢本身就驗證擁有權）。這樣一來，取消交易跟報名交易會被資料庫序列化：不管誰先鎖到，後鎖到的一方會等前一個交易 commit 才能繼續，讀到的永遠是最新狀態，不會有上述插入問題。
- `draft` 狀態的 class session不可能有任何 Enrollment（`createEnrollmentForUser` 的 guard 要求 `status="open_for_enrollment"`），理論上取消 draft 不需要搶鎖。但為了架構一致、少一種特殊分支，一律用同一個 pure-core、一律先鎖再判斷狀態，不特別為 `draft` 開快速路徑。

### D4 — 取消時，既有的 `confirmed` Enrollment 要怎麼處理？

- **推薦：在同一個 transaction 內，把該 class session 底下所有 `status="confirmed"` 的 Enrollment 一併轉成 `status="cancelled"`。** 理由：如果不連帶處理，Member 會在自己的 `/member/enrollments` 頁面看到一筆「已確認」的報名，實際上那堂課早就被取消了，這是明顯會誤導使用者、甚至讓人白跑一趟的資料不一致。
- 這個 UPDATE 用 `RETURNING "userId"` 取回被連帶取消影響的 Member `userId` 清單，供 tx commit 之後的 notification 使用（D7）——不需要額外查詢。
- 已經是 `cancelled`／未來若接線後可能出現的 `pending`/`attended`/`no_show` 狀態的 Enrollment 不受影響（`WHERE status = 'confirmed'` 精準鎖定，不動其他狀態）。

### D5 — DemandRequest 是否要連帶變化？

- **推薦：不動。** `converted_to_class` 是「這個需求曾經成功轉換成一堂課程」的歷史事實，不因為那堂課後來被取消而改變——這跟 Enrollment 的情況不同（Enrollment 的 `confirmed` 直接代表「現在還算數的報名」，ClassSession 被取消後就不該再算數；但 DemandRequest 的 `converted_to_class` 代表的是「媒合流程走到了這一步」這件事本身，不是即時狀態）。`DemandRequest` 自己的 `cancelled` 狀態（`docs/domain/permissions-matrix.md` 已標記為完整未來設計、本輪不接線）留給未來一個獨立切片決定「ClassSession 被取消後，要不要連動把 DemandRequest 也標記為某種狀態」這個更大的問題，不在本輪範圍內偷偷夾帶。

### D6 — 是否要填寫取消原因？

- **推薦：不用。** V1 保持最小：跟 `TeacherProfile`/`DemandRequest` 的 reject 系列不同（那些原因會顯示給被拒絕的一方，是明確的產品需求），目前沒有任何下游頁面需要顯示「這堂課為什麼被取消」；`class_session_cancelled` 的通知文案（D7）只需要說「已取消」，不需要引用原因欄位。用一個純 UX confirm checkbox 把關即可（比照既有「開放報名」「取消報名」的既有樣式），不寫入資料庫。

### D7 — Notification 事件與收件人角色設計

- **推薦：使用 `notification` 一輪已保留的 `class_session_cancelled` 事件類型**，收件人分三種角色：
  - `self`（Organizer 自己）
  - `counterpart`（授課 Teacher）
  - **新增第四種角色 `affected_member`**（每一位因為 D4 連帶取消而受影響的 Member，各自收到一筆）
- **為什麼需要新增角色，不能沿用既有的 `counterpart`**：`src/domain/notification/copy.ts` 的 `COPY_TABLE` 是 `Partial<Record<NotificationType, Partial<Record<NotificationRecipientRole, CopyBuilder>>>>`——每個 `(type, role)` 組合只能對應**一份**文案。既有的 `counterpart` 角色在之前所有事件裡都只代表**一種**對象（例如 `demand_response_selected` 的 counterpart 是被選中的 Teacher；`class_session_created` 的 counterpart 也是 Teacher）。但 `class_session_cancelled` 同時要通知 Teacher **與** Member，這是兩種完全不同的對象、需要不同文案（「你的課程已取消」vs「你報名的課程已取消，報名也一併取消了」），不能共用同一個 `(class_session_cancelled, counterpart)` 文案格。因此 `src/domain/notification/types.ts` 的 `NotificationRecipientRole` 新增第四個值 `"affected_member"`，`copy.ts` 對應新增這個角色的文案函式。這是本輪對既有 notification 模組的唯一結構性修改，其餘既有事件的 `(type, role)` 對應完全不受影響。
- **不跟既有的 `enrollment_cancelled` 共用**：`enrollment_cancelled` 現有的 `self` 角色文案是「你已經取消「X」的報名。」——語氣假設是 Member 自己主動點擊取消。本輪的連帶取消不是 Member 自己做的，用這份文案會誤導使用者以為自己做了什麼操作。改用 `class_session_cancelled` 的 `affected_member` 角色，文案改成「「X」已經取消，你的報名也一併取消了。」，語意精確對應實際發生的事。兩個 `NotificationType` 保持獨立，未來如果要拆分已讀邏輯或報表統計也比較乾淨。
- 收件人解析（D7 呼應 `notification` 一輪的 D7）：resolver query 在 tx commit **之後**用 `prisma`（不是 `tx`）執行，取得 `teacherProfile.userId`／`organizerProfile.userId`（`__internal__` 回傳的 `teacherProfileId`/`organizerProfileId` 只是 profile id，不是 user id，需要一次小查詢解析）；受影響 Member 的 `userId` 清單已經由 D4 的 `RETURNING` 直接取得，不需要額外查詢。整段包在 try/catch，失敗不影響 `cancelOwnClassSession` 的回傳結果（比照 `notification` 一輪 D4 的既有設計，一字不差沿用）。
- **已知且刻意接受的限制（codex round 1 指出，已討論後明確記錄，不修正）：跨請求的 notification 落地順序不保證等於真實業務事件順序。** 情境：Member 的 `createEnrollmentForUser` 先搶到鎖並 commit（`enrollment_confirmed` 的資料寫入完全正確），但 Organizer 的取消交易在 Member 那筆交易釋放鎖之後才能開始——兩者的**主要交易**因為 D3 的鎖設計而正確序列化，DB 最終狀態永遠正確（該筆 Enrollment 一定會被連帶取消）。但兩邊「commit 之後才呼叫 `notifyUsers`」這件事本身是兩個獨立、不受鎖保護的非同步呼叫，理論上 Node.js 的 event loop 排程有極小機率讓取消交易的 `notifyUsers`（在它自己的交易 commit 之後才開始）比 Member 那筆更早完成 `Notification` 記錄的實際寫入，導致 `/notifications` 依 `createdAt` 排序時，「報名成功」看起來比「已取消」還新。這跟 `notification` 一輪 D4 第 5 點已經明文接受的風險（「主要狀態變更成功、但 notification 沒寫成功」）是同一類——V1 的 notification 系統本來就是 best-effort、無序列化保證、不做 outbox/retry。要徹底解決這個問題需要一個全域的通知排序機制（例如 outbox pattern 或全域序號），這是明顯超出本輪範圍的基礎建設投資，且沒有任何既有 plan 曾經做過這個等級的保證。**因此本輪明確不修正這個殘留風險，只確保被牽動的 DB 資料本身永遠正確**（見 D10 測試策略第 1 項，只斷言最終 DB 狀態正確，不斷言兩筆 Notification 的相對寫入順序）。

### D8 — Member 自助取消（既有）跟本輪 Organizer 連帶取消，要不要共用同一個 NotificationType？

- **推薦：不共用**，見 D7 的理由。`cancelOwnEnrollment`（Member 自助取消，`enrollment`／`notification` 兩輪已出貨）繼續發送既有的 `enrollment_cancelled`／`self`；本輪的連帶取消固定發送 `class_session_cancelled`／`affected_member`，兩條路徑完全獨立，互不影響既有已出貨的行為。

### D9 — UI 放哪裡？

- **推薦**：`src/app/organizer/classes/[classSessionId]/page.tsx` 新增一個「取消課程」區塊，`draft` 與 `open_for_enrollment` 兩種狀態都顯示（比照既有「開放報名」「取消報名」的 confirm checkbox 樣式：一個 `<details>`／`<summary>` 或直接一個帶 checkbox 的 `<form>`，需求標題文案清楚說明「取消後無法復原，已報名的會員也會一併取消」）。`startAt` 已過時，伺服器端本來就會擋（D2），但 UI 層不需要額外做時間判斷隱藏表單——直接送出後靠 server-side 錯誤訊息告知「這堂課程已經開始，無法取消」即可（比照既有「開放報名」在已過期 draft 上的既有處理方式，不是每個既有表單都在 UI 層做時間預先判斷）。
- `src/app/organizer/classes/[classSessionId]/actions.ts` 新增 `cancelClassSessionAction`，比照既有 `openForEnrollmentAction` 的寫法（`revalidatePath` + `redirect` + query string 帶 result/message）。
- **修正（codex round 1 指出的問題，已採納）**：`src/app/teacher/classes/page.tsx` 目前完全不顯示 `classSession.status`（見 2.1 稽核）。本輪必須在每張課程卡片加上狀態徽章，直接沿用既有的 `classSessionStatusLabels`／`classSessionStatusToneClasses`（`src/app/organizer/classes/_components/status-labels.ts`）——這個檔案雖然放在 `organizer` 路由底下，但這個 codebase 已經有跨路由目錄 import `_components/status-labels.ts` 的既有先例（同一個檔案第 3 行就已經 import `@/app/organizer/demands/_components/status-labels` 的 `demandRequestTargetLevelLabels`），本輪比照辦理，不另外搬移或複製檔案。取消後的課程卡片會顯示「已取消」徽章，roster 區塊維持原本只在 `open_for_enrollment` 顯示的條件（`cancelled` 狀態不顯示 roster 區塊，靠徽章本身就足以表達狀態）。

### D10 — 測試策略？

- **推薦：只用既有 Playwright smoke**，不引入 Vitest。必做的決定性測試：
  1. **取消 vs 報名的併發序列化**：比照既有 `createEnrollmentForUser` 的 hooks-based 併發測試手法（`createDeferred`/`waitUntil`/`sleep`），證明 `cancelClassSessionForOrganizer` 與 `createEnrollmentForUser` 搶同一把 `ClassSession` 鎖時會被資料庫序列化，且不管哪一方先搶到鎖，最終 DB 狀態永遠正確（不會出現「課程已取消、但還有一筆 confirmed 報名」的資料不一致）。只斷言 DB 最終狀態，**不**斷言兩筆 Notification 的相對寫入順序（見 D7 已明確接受的殘留風險）。
  2. **連帶取消**：一堂已有多筆 `confirmed` Enrollment 的課程被取消後，全部轉成 `cancelled`；其他不相關 class session 的 Enrollment 不受影響。
  3. **D2 時間守衛**：已開始的課程無法取消。
  4. **Notification**：取消後，Organizer(self)/Teacher(counterpart)/受影響 Member(affected_member) 各自收到正確文案的 `class_session_cancelled` 記錄；未受影響的 Member（例如報名已經被自己取消過的）不會重複收到。
  5. **IDOR**：非本人 Organizer 無法取消別人的 class session（404／not-found 語意）。
  6. **重複取消**：已經是 `cancelled` 的 class session 再次取消，回傳明確錯誤碼，不是靜默成功。
  7. **必做的 UI E2E 測試（codex round 1 指出的問題，已採納新增）**：上面 1–6 項若全部只透過直接呼叫 domain function 驗證（比照 `createEnrollmentForUser` 的既有測試手法），會完全沒有涵蓋到「Organizer 實際在瀏覽器上點擊取消按鈕」這條路徑本身——表單有沒有正確渲染、`cancelClassSessionAction` 有沒有接對 server action、`revalidatePath`／redirect／query string feedback 有沒有正常運作、`requireUser()` session 有沒有正確串接，這些都不會被上面任何一個直接呼叫的測試捕捉到，跟本專案每一輪既有 plan（`enrollment`、`class-session-creation` 等）都至少有一個完整 UI 驅動測試的既有慣例不一致。本輪至少要有一個測試，從瀏覽器實際走完整流程：Organizer 建立課程 → 開放報名 → Member 報名 → Organizer 在 `/organizer/classes/[classSessionId]` 點擊取消 → 確認 checkbox → 送出 → 確認頁面顯示取消成功的 feedback、Member 的 `/member/enrollments` 顯示「已取消」、Teacher 的 `/teacher/classes` 顯示「已取消」徽章。

## 6. 品牌與 UX 規則

- 取消文案清楚說明後果（無法復原、已報名會員的報名會一併取消），不使用威脅或模糊字眼。
- Notification 文案延續既有「清楚、溫和、可信任」原則。

## 7. RWD Requirements

- 取消區塊在 360px 手機寬度可用，比照既有「開放報名」區塊版型，不使用密集表格。

## 8. 實作切片（Slice 1–4；施工前提：D1–D10 已拍板）

### Slice 1 — Notification 角色擴充

- `src/domain/notification/types.ts`：`NotificationRecipientRole` 新增 `"affected_member"`。
- `src/domain/notification/copy.ts`：新增 `class_session_cancelled` 的 `self`/`counterpart`/`affected_member` 三份文案。
- **驗證**：throwaway `tsx` script 直接呼叫 `notifyUsers("class_session_cancelled", [...], {...})` 三種角色各一筆，確認文案正確、事後清除測試資料。

### Slice 2 — 取消 domain service

- `src/domain/class-session/__internal__/cancel-class-session-core.ts`：`cancelClassSessionForOrganizer(organizerProfileId, classSessionId, hooks?, notifyOverride?)`（D3/D4/D7，簽章比照 `createEnrollmentForUser` 的 `notifyOverride` 設計）。
- `src/domain/class-session/service.ts`：`cancelOwnClassSession(classSessionId)`（auth wrapper，比照既有 `openOwnClassSessionForEnrollment`/`createOwnClassSession` 寫法）。
- **驗證**：throwaway `tsx` script 直接呼叫 `cancelClassSessionForOrganizer`，涵蓋：正常取消、連帶取消多筆 Enrollment、D2 時間守衛、重複取消。

### Slice 3 — UI

- `src/app/organizer/classes/[classSessionId]/actions.ts`：`cancelClassSessionAction`。
- `src/app/organizer/classes/[classSessionId]/page.tsx`：取消區塊（D9）。
- `src/app/teacher/classes/page.tsx`：加上狀態徽章，import `classSessionStatusLabels`/`classSessionStatusToneClasses`（D9 修正版）。
- **驗證**：瀏覽器實際操作——建立課程、開放報名、會員報名、Organizer 取消，確認 Member 端顯示「已取消」、Teacher 端顯示「已取消」徽章且 roster 區塊不再顯示、Organizer 頁面顯示「已取消」狀態。

### Slice 4 — Tests + Docs 對齊

- `tests/smoke/class-session-cancellation.spec.ts`：D10 列出的 7 類測試（含必做的 UI E2E 測試）。
- 更新 `docs/domain/state-transition-details.md`（ClassSession 新增 `→ cancelled` 轉換說明、Notification Side Effects 更新 `class_session_cancelled` 為已落地）、`docs/domain/permissions-matrix.md`（`Cancel class session` 列的 V1 落地範圍註記，修正 D9 的舊「不接線」敘述；**同時修正 Notification 那一列「11 個既有 trigger 點」為「12 個」**，因為 `class_session_cancelled` 這一輪落地後，`notification` 一輪原本統計的 11 個事件數就過時了）、`docs/product/notification-spec.md`（落地現況段落追加 `class_session_cancelled`，並補充 `affected_member` 角色是站內落地細節）。
- **修正（codex round 1 指出的問題，已採納新增）**：也要更新 `docs/domain/state-machines.md`（ClassSession Status 小節目前明文寫著「`cancelled` enum 值保留但無對應 transition」，本輪落地後這句話變成假的，必須改成說明 `draft`／`open_for_enrollment → cancelled` 已接線，且 D2 的時間守衛也要記錄進去）與 `docs/domain/data-model.md`（Notification 欄位說明目前寫「V1 落地 11 個」，本輪之後要改成 12 個，並把 `class_session_cancelled` 從「保留未接線」清單移除）——這兩個檔案原本的 Slice 4 清單漏掉了，若不修正，`state-machines.md` 跟 `state-transition-details.md`／`data-model.md` 跟自己的欄位說明就會同時存在兩套互相矛盾的現況描述。
- 最終：`npm run lint` + 全套 `npm run test:smoke`（乾淨的 `npm run build` 之後，不可重用舊的 dev server——`notification` 一輪已經踩過這個坑：`reuseExistingServer` 會讓 Playwright 誤用一個殘留的 dev server 而非真正的 production build，必須先確認 port 3000 沒有殘留 process）。

### Slice 順序

Slice 1 → 2 必須先完成（notification 角色擴充 + 核心 service）。Slice 3 依賴 Slice 2。Slice 4 排最後。

## 9. Verification Planning

- Domain 層（Slice 1–2）：throwaway `tsx` script 直接對本機 Postgres 驗證，跑完即刪除腳本與測試資料。
- UI 層（Slice 3）：瀏覽器手動驅動 + Prisma 查 DB 核對。
- 併發相關（Slice 2/4）：新的決定性鎖測試 + 重跑既有 `tests/smoke/enrollment.spec.ts` 確認沒有破壞既有的 `createEnrollmentForUser` 併發行為。
- 最終：跑 `npm run lint` 與全套 `npm run test:smoke`（先確認 port 3000 無殘留 process，見 Slice 4）。

## 10. Rollback 總則

- 本輪不新增 migration（`cancelled` 狀態值與 `class_session_cancelled` enum 值都已存在），無 schema rollback 疑慮。
- 若 Slice 2 的併發鎖測試發現破壞既有 `enrollment` 測試，優先 revert 該筆 commit，不做 hotfix 疊加。

## 11. Planning-only self review

- 已核對：`ClassSessionStatus.cancelled`、`NotificationType.class_session_cancelled` 兩個 enum 值都已存在於 schema，本輪不需要 migration。
- 已核對：`NotificationRecipientRole`／`copy.ts` 的 `COPY_TABLE` 型別，確認一個 `(type, role)` 只能對應一份文案，是新增 `affected_member` 角色的直接依據。
- 已核對：`createEnrollmentForUser`／`createClassSessionForOrganizer` 的鎖查詢寫法，確認本輪取消動作可以沿用同一套「own-scoped WHERE + FOR UPDATE」手法。
- 待 codex 檢查：D3 的併發設計是否有遺漏的競態情境；D4 的連帶取消 `RETURNING userId` 手法在 raw SQL 或 Prisma API 層面是否可行；D7 新增 `affected_member` 角色對既有 `copy.ts`/`create.ts` 的型別是否有破壞性影響。

<!-- codex-peer-reviewed: 2026-07-28T08:10:02Z rounds=2 verdict=approved -->
