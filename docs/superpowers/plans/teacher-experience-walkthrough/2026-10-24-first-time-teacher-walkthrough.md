# 老師：第一次加入到第一位學員報名流程走查（2026-10-24）

目標：「我會從老師群開始開發。我在意網站對他們來說有沒有解決他們日常的各項問題，只要有一個網站就可以幫助他們管理日常業務；每一個環節都能很清楚地讓他們自然而然學會使用。」

這次的做法：**沒有在瀏覽器實際操作**。這是測試回合，限定只讀程式：沒有登入的瀏覽器工作階段，也沒有開發伺服器。所有結論都從程式推出，全部標「待驗證」。

方法：flow-walkthrough skill（cognitive walkthrough 4 問題 × 3 位固定 persona，加上日常工作對照）。

與上次相比：同一天稍早有一份沒用 skill、由 Claude 直接整理的版本 `first-time-teacher-review.md`。這份是 skill 的第一次實測，由一個沒讀過舊版的 agent 獨立完成。舊版的 3 個高嚴重度問題（總覽沒有下一步、通過通知導向需求池、說明頁沒講日常管理）這份都有；另外新增課程預設不公開讓學員卡在登入（F3）、自動成立的報名不通知老師（F4）等 8 項。之後以這份為準，舊版保留作比較。

流程範圍：從首頁看到老師入口 → 申請 → 等審核 → 通過 → 開第一堂課 → 招生分享 → 第一位學員報名 → 收款紀錄 → 上完課標記完成。

既有紀錄（引用，不當成新發現）：
- `docs/superpowers/plans/teacher-experience-walkthrough/handoff.md` 第 1 站：「待你處理」卡片整張可點，但看起來不像能點。
- `docs/superpowers/plans/entry-and-sign-in-flow-review/flow-map.md` 疑點 A（換電腦後登入落在學員總覽）、B（老師專區多數頁面要求登入時沒帶 `callbackUrl`）、E（申請各狀態畫面）。
- `docs/backlog.md` 第 15 項（課程頁直接開 Google 登入）、第 20 項（真實寄信還沒開通，`EMAIL_DELIVERY_MODE` 沒設定＝只發站內通知）、第 24 項（課程結束後自動標記完成）。

## Persona

| 代號 | 是誰 | 現在怎麼做 | 最在意 | 容易卡在 |
| --- | --- | --- | --- | --- |
| 小美 | 兼職老師，社區教室每週 2 堂，主要用手機 | LINE 群組招生、Excel 記報名和收費 | 把現有學員搬過來，不能比 LINE 麻煩 | 長表單、學員要多一道登入、看不懂的術語 |
| 阿哲 | 自由接案老師，想多接企業課 | 靠朋友介紹 | 有沒有案子可以接、多快接到 | 需求池是空的、審核要等多久 |
| Linda | 資深老師，有自己的小工作室 | 已有固定學員和報名表單 | 省時間、形象專業，懷疑「又一個平台」 | 價值說得不清楚、功能分散、不能先看再決定 |

## 路線

1. **發現入口**：首頁主按鈕下方小字「了解老師加入」，或公開導覽列「老師合作」，都到 `/teachers/join`（依據：`src/app/page.tsx` 的 `teacherHref`；`src/app/_components/public-header.tsx`）。
2. **老師介紹頁（未登入）**：三個好處（被團體看見／開自己的固定課／大新竹生活圈）、按鈕「登入／建立帳號並開始申請」、審核三步驟、欄位預覽（必填 7 項＋建議欄位）、FAQ「審核大概要多久？目前沒有固定的審核時間承諾」（依據：`src/app/teachers/join/_components/TeacherJoinExplainer.tsx`）。
3. **登入**：`/sign-in?callbackUrl=/teachers/join`，只有 Google；第一次登入自動建帳號（依據：`TeacherJoinExplainer.tsx` 的 `signInHref`；flow-map 共用規則）。
4. **申請表單（已登入、沒有老師資料）**：同一個網址換成表單，外框是**學員**專區導覽列；標題「一起建立清楚、安心的瑜伽團課合作」；說明「填好下方 7 項必填就能直接送出審核」；可「儲存草稿」或「送出審核」，送出前有確認框列出送出內容（依據：`src/app/teachers/join/page.tsx` 的 `signedInArea`；`TeacherApplicationForm.tsx` 第 1236–1300、1137–1176 行；`_lib/application-fields.ts` 的 `applicationSections`）。
5. **送出後（`submitted`）**：同頁改成唯讀摘要「你的老師申請正在審核」＋按鈕「回老師總覽」；站內通知「老師申請已送出」（依據：`TeacherApplicationForm.tsx` 的 `SubmittedApplicationSummary`；`src/domain/notification/copy.ts` 的 `teacher_application_submitted`）。
6. **等審核期間**：老師導覽列只剩「總覽／老師資料／通知」；總覽顯示「已送出」卡片與「查看申請內容」；可授課時間、照片、收款與聯絡三個分頁都顯示「通過審核後才能設定」（依據：`src/app/teacher/_components/TeacherShell.tsx` 的 `limitedLinks`；`src/app/teacher/dashboard/page.tsx` 的 `statusCopy.submitted`；`src/app/teacher/profile/page.tsx`、`profile/photos/page.tsx` 第 79 行、`profile/payment/page.tsx` 第 66 行）。
7. **被退回（分岔）**：總覽顯示「平台的退回說明」與「修正並重新送審」；申請頁一進來就標出缺的必填；站內通知標題「老師申請審核結果」、內文「很抱歉，你的老師申請這次未通過審核。原因：…」（依據：`dashboard/page.tsx` 的 `statusCopy.rejected`；`TeacherApplicationForm.tsx` 第 668–669 行；`copy.ts` 的 `teacher_application_rejected`）。
8. **審核通過**：站內通知「老師申請已通過／現在可以開始回應需求了」，連結「前往老師資料」到 `/teacher/profile`（可授課時間分頁）；email 依政策會寄，但目前沒開通寄信（依據：`copy.ts`、`src/domain/notification/link.ts` 的 `teacher_application_approved`、`email-policy.ts`；backlog 第 20 項）。
9. **第一次看到通過後的總覽**：還沒有任何課，所以「待你處理」「等待對方回覆」兩張卡都不出現；只剩狀態卡「你的老師資料已通過審核」，按鈕是「編輯我的資料」「管理可授課時間」（依據：`dashboard/page.tsx` 第 105–151、166–293 行）。
10. **我的課程（空）**：預設分頁「即將上課」，空畫面寫「目前沒有即將上課的課程。草稿要先開放報名才會出現在這裡。」；建立入口是右上「＋ 建立課程」（依據：`src/app/teacher/classes/page.tsx` 的 `emptyMessages`、`canCreate`）。
11. **建立課程** `/teacher/classes/new`：先選「單堂／每週固定／指定日期」（預設單堂）；必填包含課程名稱、課程風格（最多 N 項）、瑜伽類型、日期時間、地點、名額；「是否列在公開課程列表」預設**不列**；報名方式預設「報名送出即成立」。單堂建立後一律是草稿（依據：`ClassSessionCreateForm.tsx` 第 51–53、125、315 行、`PublicListingField`、`RequiresApprovalField`、`ServiceTypesField`；`new/page.tsx` 說明文字）。
12. **建好之後**：轉到這堂課的頁面，提示「課程已建立。下一步：確認內容後按『開放報名』。」（依據：`src/app/teacher/classes/new/actions.ts` 第 63–67 行）。
13. **開放報名**：按「開放報名」→「已開放報名。」；之後主按鈕變「複製報名連結」，另有收合的「分享文案」（招募公告／課前一天提醒／課後感謝）；下一步文字變「課程正在開放報名，報名狀況會即時顯示在這裡。」（依據：`src/app/teacher/classes/actions.ts` 第 41 行；`[classSessionId]/page.tsx` 第 162–235、615–627 行；`src/domain/class-session/class-action-slots.ts`；`teacher-next-step.ts` 第 79 行；`share-templates.ts`）。
14. **學員點分享連結**：課程沒列在公開列表時，沒登入的學員只看到「登入後查看這堂課」，看不到時間、地點、費用；分享文案也寫「（需要先登入飛索帳號才能報名）」（依據：`src/app/classes/[classSessionId]/page.tsx` 第 36–46 行；`src/domain/class-session/public-read-service.ts` 的 `getPublicClassSessionDetail` 條件 `isPublic: true`；`ClassSignInGuide.tsx`；`share-templates.ts` 第 68 行）。
15. **第一位學員報名**：「報名送出即成立」的課，只有學員本人收到「報名成功」；老師**不會**收到通知。只有「需要我確認」的課，老師才會收到「有新的報名待確認」（依據：`src/domain/enrollment/__internal__/create-enrollment-core.ts` 第 280–303 行）。
16. **收款**：學員報名後才看得到老師在「收款與聯絡」填的帳號與規則；老師在名單上手動「標記已收款／已退款」，錢不經過平台（依據：`profile/payment/page.tsx`；`teacher/classes/actions.ts` 第 104–163 行；`prisma/schema.prisma` 的 `paymentStatus`）。
17. **上完課**：總覽「待你處理」出現「已結束：請標記完成」，標記後學員收到評價邀請（依據：`teacher-next-step.ts` 第 67 行；handoff 第 1 站）。
18. **旁支：需求池** `/teacher/demands`：導覽列叫「需求池」，頁面標題叫「團體需求」；空的時候寫「目前沒有符合條件的需求／之後有新的需求會顯示在這裡，可以稍後再回來看看。」；查詢沒有依老師條件篩選（依據：`src/app/teacher/demands/page.tsx` 第 107–121 行；`src/domain/demand-response/demand-read-service.ts` 的 `listPublishedDemandRequestsForTeacher`）。
19. **旁支：老師公開頁**：`isPublicPageEnabled` 預設關閉，開關在「老師資料 › 照片」分頁裡的「公開我的老師頁」（依據：`prisma/schema.prisma` 第 92 行；`profile/photos/page.tsx` 第 100–127 行）。

## 走查發現（依嚴重度）

| # | 在哪一步 | 發現 | 卡到誰 | 嚴重度 | 依據 |
| --- | --- | --- | --- | --- | --- |
| F1 | 9 通過後總覽 | **剛通過審核的老師，總覽上沒有「開第一堂課」或「去看需求」的入口。** 還沒有課，所以待辦卡整張不出現；畫面只剩一張狀態卡，主按鈕是「編輯我的資料」。內文雖寫「可以瀏覽並回應團體需求、查看已建立的課程」，但沒有對應按鈕。這是第一次能拿到價值的時刻，空畫面卻沒說「怎麼開始」。（問題 1、2 答「不」） | 小美、阿哲、Linda | 高（待驗證） | `src/app/teacher/dashboard/page.tsx` 的 `statusCopy.approved`、`hasClassCapability && actionItems.length > 0` |
| F2 | 8 通過通知 | **通過通知只說「可以開始回應需求了」，連結到可授課時間。** 小美和 Linda 最想做的是開自己的課，通知完全沒提；點進去落在「可授課時間」，這個功能目前只畫在老師自己的月曆底色上，團主也看不到。第一步就被帶到價值最低的地方。另外寄信還沒開通，老師要自己回來看站內通知才知道通過了。 | 小美、Linda（阿哲較不受影響） | 高（待驗證） | `src/domain/notification/copy.ts`、`link.ts` 的 `teacher_application_approved`；可授課時間只被 `src/domain/teacher-calendar/*` 使用；backlog 第 20 項 |
| F3 | 14 學員點連結 | **課程預設「不列在公開列表」，沒登入的學員點 LINE 連結只看到「登入後查看這堂課」。** 小美的學員在看到時間、地點、費用之前就得先用 Google 登入，比 LINE 群組直接貼資訊多一道關卡。老師在建課表單上不一定意識到這個預設會造成登入牆；分享文案也直接寫「需要先登入」。（問題 3 答「不」：老師看不懂「不列在公開列表」對學員的實際影響） | 小美（直接）、Linda | 高（待驗證） | `ClassSessionCreateForm.tsx` 第 125 行 `isPublic: false`；`src/app/classes/[classSessionId]/page.tsx` 第 36–46 行；`share-templates.ts` 第 68 行 |
| F4 | 15 第一位報名 | **「報名送出即成立」的課有人報名時，老師收不到通知。** 這是預設選項，所以第一次開課的老師大多會選它；第一位學員報名是最重要的成功時刻，老師卻得自己點進課程頁才看得到。總覽的待辦也不會出現新報名。（問題 4 答「不」） | 小美、Linda | 高（待驗證） | `create-enrollment-core.ts` 第 295–303 行只通知 `self`；`teacher-next-step.ts` 對開放中課程只顯示「開放報名中」 |
| F5 | 6 審核期間 | **送審後到通過前，老師什麼都不能先準備。** 可授課時間、照片、收款與聯絡全部鎖住，FAQ 也說沒有審核時間承諾。阿哲會一直回來看、看不到進度；小美和 Linda 想先把收款帳號、照片準備好也不行。 | 阿哲、Linda、小美 | 中（待驗證） | `profile/page.tsx` 第 40–42 行、`profile/photos/page.tsx` 第 79 行、`profile/payment/page.tsx` 第 66 行；`TeacherJoinExplainer.tsx` 的 `faqItems` |
| F6 | 13 開放報名 | **開放報名前後，網站都沒有提醒老師先填收款帳號。** 學員報名後看的是「報名當下」的收款資訊快照；老師如果沒先填，第一批學員就看不到怎麼繳費。收款設定藏在「老師資料 › 收款與聯絡」第四個分頁。 | 小美、Linda | 中（待驗證） | `profile/payment/page.tsx` 第 122 行；`src/app/teacher/classes/**` 沒有任何收款資料的檢查或提示 |
| F7 | 11 建立課程 | **建課表單要同時分辨「課程風格」和「瑜伽類型」兩組必填標籤，還有多組排程選擇。** 「課程風格」說明是「放鬆紓壓、流汗活力」，「瑜伽類型」是陰瑜伽、流瑜伽，兩者在老師平常的說法裡常是同一件事。加上單堂／每週固定／指定日期，以及每週固定再分持續開課／期班、期班報名方式、建立後、報名方式、公開列表，手機上很長。小美會在這裡猶豫。 | 小美 | 中（待驗證） | `ClassSessionCreateForm.tsx` 的 `ServiceTypesField`、`YogaStylesField`、`SeriesKindField`、`TermEnrollmentModeField`、`OpenForEnrollmentField` |
| F8 | 12–13 建好與開放 | **單堂課一定要分兩步：先建立草稿、再按「開放報名」；系列卻可以選「建立後全部開放報名」。** 兩種做法不一致。開放後的回饋只有「已開放報名。」，下一步文字說「報名狀況會即時顯示在這裡」，沒有說「現在把連結傳給學員」，雖然主按鈕已經換成「複製報名連結」。 | 小美、阿哲 | 中（待驗證） | `new/actions.ts` 第 63–67 行；`teacher/classes/actions.ts` 第 41 行；`teacher-next-step.ts` 第 79 行；`OpenForEnrollmentField` 只在系列表單出現 |
| F9 | 19 老師公開頁 | **老師公開頁預設關閉，開關放在「照片」分頁。** Linda 想要專業形象、想被陌生學員找到，但不會想到要去「照片」找「公開我的老師頁」；沒打開時，課程頁也不會連到她的老師頁。 | Linda、阿哲 | 中（待驗證） | `prisma/schema.prisma` 第 92 行；`profile/photos/page.tsx` 第 100–127 行；`src/domain/enrollment/read-service.ts` 第 256 行 |
| F10 | 2 老師介紹頁 | **介紹頁只講「被團體看見」和「開自己的課」，沒讓老師先看到日常會用到的工具。** 報名管理、收款紀錄、分享文案、月曆、期班這些真正能取代 LINE＋Excel 的功能都沒提，也沒有畫面範例。Linda 想「先看再決定」，看不到。（依 onboard.md 的 Show, Don't Tell） | Linda、小美 | 中（待驗證） | `TeacherJoinExplainer.tsx` 的 `joinBenefits` |
| F11 | 18 需求池空 | **需求池空的時候只說「稍後再回來看看」，有新需求也不會通知老師。** 阿哲最在意「有沒有案子」，只能自己一直回來刷。另外導覽列叫「需求池」、頁面標題叫「團體需求」、空畫面寫「沒有符合條件的需求」，但查詢其實沒有任何篩選條件。 | 阿哲 | 中（待驗證） | `teacher/demands/page.tsx` 第 107–121 行；`demand-read-service.ts` 第 71–90 行；`email-policy.ts` 的 `demand_request_published` 只給團主 |
| F12 | 4 申請表單 | **剛登入、還沒送申請的人看到的是「學員」專區導覽列。** 申請頁上方導覽列寫學員，老師可能以為登錯身分。存過草稿之後才換成老師專區。 | 小美 | 低（待驗證） | `src/app/teachers/join/page.tsx` 的 `signedInArea={hasTeacherProfile ? "teacher" : "member"}` |
| F13 | 7 被退回 | **退回通知的語氣跟頁面不一致。** 通知寫「很抱歉……這次未通過審核」，聽起來像結案；總覽與申請頁卻寫「可修正後重新送出、沒有次數限制」。老師只看通知會以為被拒絕了。 | Linda、阿哲 | 低（待驗證） | `copy.ts` 的 `teacher_application_rejected`；`dashboard/page.tsx` 的 `statusCopy.rejected` |
| F14 | 17 上完課 | （既有紀錄，引用）「待你處理」卡片整張可點，但看起來不像能點，老師不一定知道去哪按「標記完成」。 | — | 待產品主人確認 | handoff.md 第 1 站 |
| F15 | 3、通知連結 | （既有紀錄，引用）老師專區多數頁面要求登入時沒帶 `callbackUrl`；換電腦後登入先落在學員總覽。從通知或書籤回來的老師要自己再找一次。 | — | 見 flow-map | flow-map 疑點 A、B |

對照 Nielsen 原則（只列真的違反的）：
- 第 1 條 Visibility of System Status：F4（第一位報名沒有任何提示）、F5（審核沒有進度可看）。
- 第 2 條 Match Between System and Real World：F7（課程風格／瑜伽類型對老師是同一件事）、F11（「需求池」與「團體需求」兩種叫法）。
- 第 4 條 Consistency and Standards：F8（單堂與系列開放報名的做法不同）、F13（通知與頁面語氣不同）。
- 第 5 條 Error Prevention：F3（預設值造成學員登入牆，老師不一定知道）、F6（沒填收款就開課）。

## 本輪處理狀態（2026-10-24）

依 `docs/specs/teacher-first-run-spec.md` 的範圍（Solution 與 Out of Scope）標記；「已處理」代表程式已改、smoke 已涵蓋，但還沒經過真人測試驗證。

| # | 狀態 | 說明 |
| --- | --- | --- |
| F1 | 已處理 | 老師總覽最上方加「開始使用」三步（票 08）。 |
| F2 | 已處理 | 通過通知改提開課與團體需求，連到老師總覽（票 08）；email 寄送仍不在本輪。 |
| F3 | 已處理 | 第一堂課預設公開、之後沿用上一堂；選項旁加白話說明；分享文案依公開設定調整登入說明（票 01）。 |
| F4 | 已處理 | 報名即成立、學員自己取消、整期報名、退出整期、單堂請假都通知老師（票 04、05）。 |
| F5 | 已處理（部分） | 審核中畫面加「通過後你會先做的三件事」（票 09）；審核中開放編輯資料不處理（Q3 決定權限不變）。 |
| F6 | 已處理 | 每個開放報名入口在按下之前提醒缺少的收款資訊（票 03）。 |
| F7 | 下一輪 | 建課欄位說明。 |
| F8 | 已處理 | 單堂也能建立後直接開放，回饋改成「下一步：把報名連結傳給學員」（票 02）。 |
| F9 | 已處理 | 公開頁開關搬到「個人資料」分頁（票 07）。 |
| F10 | 下一輪 | 老師介紹頁改版。 |
| F11 | 已處理 | 新團體需求通知老師、名稱統一為「團體需求」、空畫面說明（票 06）；依地區或類型篩選通知對象不處理（Q6 先通知全部）。 |
| F12 | 下一輪 | 申請頁導覽列。 |
| F13 | 已處理 | 退回通知改成「可修正」語氣（票 09）。 |
| F14 | 下一輪 | 待你處理卡片看起來不能點。 |
| F15 | 下一輪 | 登入後回到原本頁面。 |

## 日常工作對照

| 老師平常要做的事 | 網站現況 | 備註 |
| --- | --- | --- |
| 排課、開課（單堂、每週固定、期班） | 有 | 三種排程都有，系列可「生成更多」。依據：`ClassSessionCreateForm.tsx`、`recurring-actions.ts`。易學程度見 F7、F8 |
| 招生：分享報名連結、文案範本 | 有 | 複製報名連結＋三種分享文案。依據：`CopyEnrollLinkButton.tsx`、`ShareTemplates.tsx`。但預設不公開時學員要先登入，見 F3 |
| 被陌生學員找到：公開課程列表、老師公開頁 | 部分 | 兩者都有，但預設都是關閉，見 F3、F9 |
| 收報名：確認或婉拒、名額 | 部分 | 有名額與確認／婉拒；「報名即成立」的課老師收不到新報名通知，見 F4。依據：`create-enrollment-core.ts` |
| 候補名單 | 沒有 | 程式裡沒有 waitlist／候補。超出目前 V1 範圍清單，需產品主人決策 |
| 收款與對帳（V1 不做金流，只能是紀錄） | 部分 | 收款帳號快照＋手動標記已收款／已退款。依據：`teacher/classes/actions.ts`、`schema.prisma` 的 `paymentStatus`。沒有對帳總表 |
| 請假、補課 | 部分 | 期班有請假與追加日期（補課）；單堂課沒有。依據：`add-makeup-session-core.ts`、glossary 第 37、47 行 |
| 行事曆、避免撞期（含 Google 日曆） | 部分 | 建課時會檢查自己課程撞期，有「我的行事曆」月曆；Google 日曆連結已核准（ADR 0009）但程式裡還沒有。依據：`conflict-check`、`TeacherMonthCalendar.tsx` |
| 聯絡學員、課程異動通知 | 部分 | 改時間地點、取消時會通知學員；老師名單只顯示學員名字，沒有聯絡方式，也不能主動發訊息。依據：`copy.ts` 的 `class_session_changed`、`[classSessionId]/page.tsx` 第 379 行。主動訊息屬「LINE deep integration」類，需產品主人決策 |
| 點名、出席紀錄 | 沒有 | 資料有 `attended`／`no_show` 狀態，但老師端沒有點名動作（管理員頁也註明不提供）。依據：`src/app/admin/classes/[classSessionId]/page.tsx` 第 53 行。需產品主人決策 |
| 學員名冊、回頭客 | 沒有 | 只有每堂課的名單，沒有跨課程的學員清單。需產品主人決策 |
| 收入統計 | 沒有 | 程式裡沒有收入統計。V1 不做金流，需產品主人決策 |
| 評價與口碑 | 部分 | 標記完成後學員可評價，老師在課程頁看得到；老師公開頁沒有顯示評價。依據：`[classSessionId]/page.tsx` 第 646 行、`src/app/teachers/[teacherProfileId]/page.tsx` |
| 接團體案子（需求池、合作邀請） | 有 | 需求池＋回應、團主直接邀請。空池與通知見 F11 |
| 維護個人資料、照片、可授課時間 | 有 | 四個分頁。可授課時間目前只畫在自己的月曆上；送審期間全部鎖住，見 F5 |

讀法：網站「功能」其實已經涵蓋小美現在用 LINE＋Excel 做的大部分事（開課、分享、收報名、收款紀錄）。真正的問題在**學不會、找不到**：第一次通過後沒有人帶老師走到「開第一堂課」，幾個預設值（不公開、報名不通知老師、公開頁關閉、沒提醒填收款）讓老師以為已經完成了，其實學員端卡住。功能缺口主要在點名、學員名冊、收入統計、候補，這些都超出 V1，需產品主人決定。

## 建議

每條標來源：（skill 方法：<哪個原則>）或（Claude 的判斷）。
動到 Auth／schema／權限／狀態機／V1 scope 的標「需產品主人決策」。

1. **通過後的總覽加一張「開始使用」卡**：沒有任何課時，在待辦位置顯示 2–3 步：填收款與聯絡 → 開第一堂課 → 把連結傳給學員；再給一個「看看團體需求」的次要入口。判斷「完成了沒」只用現有資料：有沒有課（`listOwnClassSessionsForTeacher`）、收款欄位有沒有填（`TeacherProfile` 既有欄位），不需要新欄位。只改畫面。對應 F1、F6。（skill 方法：onboard.md 的 Time to Value 與空狀態「What / Why / How to start」）
2. **通過通知改文案與連結**：內文同時提「開自己的課」與「回應需求」，連結改到 `/teacher/dashboard`（配合建議 1）。只改 `copy.ts`、`link.ts`，不動 schema。對應 F2。（Claude 的判斷）
3. **建課時把「公開列表」的影響講白**：在選項說明直接寫「不列在公開列表：學員點連結要先登入才看得到課程內容」；並在建課摘要（`ClassCreateSummary`）提醒一次。要不要把預設改成「列在公開列表」，或讓沒登入的人也能看到不公開課程的內容，會改變可見性規則（權限），**需產品主人決策**。對應 F3。（Claude 的判斷；Nielsen 第 5 條 Error Prevention）
4. **「報名即成立」的課也通知老師**：沿用既有 `enrollment_confirmed` 事件，多加 `counterpart`（老師）收件人與文案；`NotificationRecipientRole` 已有 `counterpart`，不需動 schema。**通知連結也要分開處理**：`link.ts` 目前把 `enrollment_confirmed` 一律導到 `/member/enrollments`，老師點了會進到自己的學員報名頁。老師收件人要導到該堂課的老師詳情頁，學員收件人維持原目的地；要依收件人的角色（`counterpart`／`self`）分流，不能只看這個人是不是老師，因為老師也可能以學員身分報名別人的課。但會增加通知量、是否寄 email 要改 `EMAIL_POLICY`，**需產品主人決策**（通知打擾程度）。對應 F4。（Claude 的判斷；Nielsen 第 1 條）
5. **送審期間開放先填收款與照片**：讓 `submitted` 的老師可以先準備收款與聯絡、照片。這會改「誰能編輯什麼」，屬於權限，**需產品主人決策**。不改的替代做法（只改畫面）：在審核中畫面列出「通過後你會先做的三件事」，讓等待有方向。對應 F5。（Claude 的判斷）
6. **開放報名前檢查收款資料**：收款帳號與收款規則**分開檢查**，缺哪個就提醒哪個，並連到「收款與聯絡」。只填規則、沒填帳號也要提醒，因為學員報名時拿到的是當下的收款資訊快照（`payment-snapshot.ts` 分別保存兩個欄位），事後補填不會更新已報名的人。提醒可以關掉（現金或免費課程不需要帳號），不擋操作。提醒要涵蓋**所有會讓課程開始收報名的入口**，並出現在按下之前：單堂詳情頁的「開放報名」、建立系列時選「建立後全部開放報名」（`recurring-actions.ts`）、系列詳情的全部開放、系列詳情每一場的快速「開放報名」（`OccurrenceQuickAction`），以及「生成更多」時直接開放。實作前先在程式裡搜尋所有會把課程改成開放報名的操作，確認沒有漏掉的入口。資料已存在，只改畫面。對應 F6。（Claude 的判斷；Nielsen 第 5 條）
7. **開放報名後的回饋加下一步**：「已開放報名。下一步：複製報名連結或分享文案，傳給你的學員。」下一步文字在 0 人報名時也改成同樣意思。只改文案。對應 F8。（skill 方法：cognitive walkthrough 問題 4「做完知道成功了嗎」）
8. **單堂課是否也給「建立後直接開放報名」**：讓單堂與系列一致。會改建課流程與預設狀態，涉及 `ClassSession` 狀態轉換，**需產品主人決策**。對應 F8。（Claude 的判斷；Nielsen 第 4 條）
9. **課程風格與瑜伽類型的關係**：先做只改畫面的版本：兩個欄位的標題和說明寫清楚差別（「這堂課給人的感覺」vs「用哪種瑜伽帶」），並在旁邊放一個例子。要合併成一組或改成選填，會影響媒合對照表與資料，**需產品主人決策**。對應 F7。（Claude 的判斷；Nielsen 第 2 條）
10. **老師公開頁開關搬到「個人資料」分頁**，總覽「開始使用」卡只放一個連過去的額外入口：建議 1 的卡片在有課之後就會消失，開關若只放在卡片上，老師之後就關不掉已公開的頁面。只改畫面位置，預設值不變。要不要預設開啟，**需產品主人決策**（隱私考量）。對應 F9。（Claude 的判斷）
11. **介紹頁加「你每天會用到的工具」區塊**：用現有真實功能（報名名單、收款標記、分享文案、月曆）各一句＋示意圖。只改畫面，且只寫已有的功能。對應 F10。（skill 方法：onboard.md 的 Show, Don't Tell）
12. **需求池用詞統一、空狀態說明為什麼空**：導覽列與標題用同一個詞（依 glossary 決定），空狀態拿掉「符合條件」，改說「需求要先經過平台審核才會公開，大新竹地區目前數量還不多」。新需求通知老師屬於新的通知行為，**需產品主人決策**。對應 F11。（skill 方法：onboard.md 空狀態原則；Nielsen 第 2 條）
13. **退回通知改成「可修正」語氣**：例如「你的老師申請需要補充：原因…，修改後可以重新送出」。只改 `copy.ts`。對應 F13。（Claude 的判斷；Nielsen 第 4 條）

## 真人測試腳本（每人約 20 分鐘，只觀察、不教）

開場：「我們測的是網站，不是你。想到什麼就說出來，卡住也是很有用的資料。」

1. 「從首頁開始，看完老師介紹頁，跟我說：加入之後，你覺得這個網站能幫你做哪些事？哪些你現在用 LINE 或 Excel 在做的事，它可以取代？」→ 驗 F10
2. 「你剛收到一則通知，請打開看看。」（用已通過、沒有課的帳號，通知列表裡有審核通過那則）請他點通知，看他被帶到哪裡、接下來想做什麼；再請他回到老師總覽，問：「你接下來會先做什麼？」→ 驗 F2、F1
3. 「開一堂下週六早上的課，名額 10 人。開好之後，你覺得學員現在可以報名了嗎？」→ 驗 F7、F8
4. 「把這堂課傳到你的 LINE 群組。你覺得學員點進去會看到什麼？」（接著用沒登入的手機打開連結，請他看）→ 驗 F3
5. 測試人員用另一個學員帳號報名第 3 題新開的那堂課（不要事先準備，才能測到當下的收款快照）。問老師：「有一位學員剛報名了，你怎麼知道？他要怎麼付錢給你？」接著打開學員那邊的報名畫面，看學員實際看到的收款資訊。→ 驗 F4、F6
6. 「如果你想讓不認識你的學員也能在網站上找到你和你的課，你會怎麼做？」→ 驗 F9、F3
7. 「看一下有沒有團體在找老師。現在沒有的話，你覺得之後要怎麼知道有新的案子？」（給阿哲類型的受測者）→ 驗 F11

每題記：有沒有完成、花多久、在哪裡停下來、說了什麼原話。

## 體驗紀錄（真人測試時填）

| 受測者 | 題號 | 原話／觀察 | 類型（看不懂／找不到／太擠／錯誤／建議） | 對應 F# |
| --- | --- | --- | --- | --- |

<!-- codex-peer-reviewed: 2026-10-24T01:45:24Z rounds=3 verdict=approved -->
