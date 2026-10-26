# 團主：第一次發起團課流程走查（2026-10-26）

目標：團主第一次使用，從「發起團課」入口 → 送出需求 → 選定老師 → 開課 → 第一位學員報名，能不能不用人教就走完。

這次的做法：**只讀程式，沒有在瀏覽器實際操作**。原因：產品主人指定這一步只讀程式、不改任何東西；這條路線中間還需要管理員審核、老師回應、學員報名，要多個帳號配合，也不能為了製造畫面狀態寫假資料進資料庫。所以下面所有結論都標「待驗證」。

方法：flow-walkthrough skill（cognitive walkthrough 4 問題 × 3 位固定 persona，加上日常工作對照）。

與上次相比：團主沒有舊的走查報告，這是第一份。相關的舊紀錄有：團主改版票 14（[手機／桌機全旅程驗收](../organizer-usability-redesign/tickets/14-organizer-journey-usability-review.md)，2026-10-06，驗的是「每一步做得到」，不是「看不看得懂」）、[backlog](../../../backlog.md) 第 10、12、27、29 項。舊紀錄已記下的問題在表中標「沿用」。

另外要知道：這條路線的兩支自動旅程測試（`tests/smoke/organizer-journeys.spec.ts` 的 direct class、find a teacher）目前標成 `test.fixme` 略過（backlog 第 27 項，等不到同意勾選框）。也就是說，票 14 之後這條路線有沒有被改壞，現在沒有自動測試在把關。

## Persona

| 代號 | 是誰 | 現在怎麼做 | 最在意 | 容易卡在 |
| --- | --- | --- | --- | --- |
| 雅婷 | 公司福委，幫同事辦課 | 自己上網找老師、一個一個問 | 找到可靠的老師、對上級好交代 | 需求表單太長、不知道多久有回應 |
| 王老闆 | 小型工作室或社區場地主 | 已有合作老師，只想排課 | 少打字、直接開團 | 被迫走「發需求」流程、找不到直接邀請老師 |
| 小芳 | 媽媽社團召集人 | LINE 群組喊人 | 簡單、人數湊得到 | 術語（需求、媒合）、看不懂狀態 |

## 路線

這次走「我需要找老師」這條（使用者指定的起訖點都在這條上）。「我已有合作老師」的直接開團路線只在入口看分岔，沒有往下走。

1. **首頁入口**：首屏主按鈕「我要發起團課」，訪客連到 `/organizers/request`（依據：`src/app/page.tsx` 的 `organizerHref`）。
2. **團主入口頁**：標題下兩張卡「我需要找老師」「我已有合作老師」，下方是價值說明與「開始的三個步驟」（建立團主資料 → 整理需求 → 等待平台審核）（依據：`src/app/organizers/request/_components/OrganizerRequestExplainer.tsx`、`OrganizerEntryCards.tsx`）。
3. **登入**：訪客按卡片 → `/sign-in?callbackUrl=/organizers/request?intent=find_teacher`；登入後回入口頁，因為帶著 `intent` 直接轉走（依據：`src/domain/organizer-profile/intent.ts` 的 `getOrganizerIntentHref`、`src/app/organizers/request/page.tsx`）。
4. **一頁式團主資料**：還沒有團主資料 → `/organizer/profile?next=/organizer/demands/new`。6 個欄位：團主顯示名稱、組織名稱、組織類型、聯絡窗口姓名、聯絡信箱、聯絡電話，按「建立團主資料並開始整理需求」（依據：`src/app/organizer/profile/page.tsx`、`_components/OrganizerSignupForm.tsx`、`actions.ts` 的 `createOrganizerProfileAction`）。這一頁進入 `/organizer` 版面，所以 `fsy_last_role` 會被寫成 `organizer`（依據：`src/app/organizer/layout.tsx` 的 `RememberLastRole`）。
5. **需求表單** `/organizer/demands/new`：三段——「團體與課程需求」（團體、需求標題、服務類型最多 3 個、需求說明 20–2000 字、適合對象、預計參與人數）、「時間與地點」（期望地點、期望時段、單堂長度、上課頻率、期望開課日期）、「預算備註」。可存草稿；按「送出審核」會先出現「確認送出需求」確認區，再按「確認送出」（依據：`src/app/organizer/demands/_components/DemandRequestForm.tsx`）。
6. **送出後**：導到 `/organizer/demands/[id]?submitted=1`，綠色提示「需求已收到，待平台審核後才會公開給合適的老師。」，下一步卡片是「目前進度：平台正在審核這筆需求……老師回應時會通知你」（依據：`src/app/organizer/demands/[demandRequestId]/page.tsx`、`src/domain/demand-request/next-step.ts`）。團主收到站內通知「需求已送出」類（`demand_request_submitted`，帶單筆 target）。
7. **等平台審核**：管理員通過 → 團主收到「需求已發布：你的需求已經公開在『團體需求』，老師可以開始回應了。」（站內＋email，**沒有 target、沒有需求名稱**，連結到 `/organizer/demands` 列表）；同時所有 approved 老師收到「有新的團體需求」。被退回 → 「需求審核結果」附原因（同樣連到列表）（依據：`src/domain/demand-request/admin-service.ts`、`src/domain/notification/copy.ts`、`link.ts`、`email-policy.ts`）。
8. **老師回應**：每有一位老師回應，團主收到「有老師回應了你的需求」（站內＋email，直達這筆需求）。詳情頁下一步卡片變成「已有 N 位老師回應，請看看回應內容並選擇合作的老師」，按鈕「查看老師回應」跳到 `#responses`（依據：`src/domain/demand-response/__internal__/select-and-submit-core.ts`、`NextStepCard.tsx`）。總覽「待你處理」也會出現這一筆（依據：`src/app/organizer/dashboard/page.tsx`）。
9. **選定老師**：每則回應顯示老師名稱、教學風格、擅長標籤、回覆內容、可配合時段、參考價格；展開「選定這位老師…」→ 勾「我確認要選定這位老師」→「確認選定」。成功提示「已選定這位老師。」；團主與被選定的老師各收到一則通知；其他老師的回應被標為「未獲選」，**但沒有收到通知**（依據：`src/app/organizer/demands/[demandRequestId]/_components/ResponseList.tsx`、`select-and-submit-core.ts` 第二個 `notifyUsers`）。
10. **建立課程**：同一頁出現「建立課程」表單（下一步按鈕「填寫課程資訊」跳到 `#create-class`）：課程名稱、課程類型（單選）、開始時間、結束時間、地點、名額上限、課程說明、「同時公開在課程列表」（**預設不勾**）、「我確認以上資訊無誤，同意建立課程」。成功後導到 `/organizer/classes/[id]`，提示「課程已建立。」，狀態是「草稿」（依據：`src/app/organizer/demands/[demandRequestId]/page.tsx`、`actions.ts` 的 `createClassSessionAction`、`src/domain/class-session/__internal__/create-class-session-core.ts`）。老師與團主都收到「課程已建立：課程「…」已經建立完成。」。
11. **開放報名**：課程頁標題下的主按鈕「開放報名」→ 確認視窗「開放後，會員就能看到並報名這堂課，此動作無法復原。」→ 提示「已開放報名。」。之後主按鈕換成報名連結欄位＋「複製報名連結」「開啟課程頁」「看報名名單」（依據：`src/app/organizer/classes/[classSessionId]/page.tsx`、`actions.ts`、`_components/ClassShareLink.tsx`）。開放報名**不會通知任何人**（依據：`src/domain/class-session/service.ts` 的 `openOwnClassSessionForEnrollment` 沒有呼叫 `notifyUsers`）。
12. **團員點連結**：課程沒勾公開時，未登入的人看到通用的「登入後查看這堂課」，沒有課名、團體、時間；登入後才看到課程頁（團體名稱、授課老師、時間地點、名額）並報名（依據：`src/app/classes/[classSessionId]/page.tsx`、`src/app/classes/_components/ClassSignInGuide.tsx`、`ClassSummary.tsx`）。
13. **第一位學員報名**：團主建的課 `requiresApproval` 預設 false，報名直接成立；學員收到「報名成功」（站內＋email），授課老師收到站內「有新的報名」（不寄 email），**團主沒有收到任何通知**（依據：`src/domain/enrollment/__internal__/create-enrollment-core.ts` 的 `enrollment_confirmed` 收件人、`email-policy.ts`、`prisma/schema.prisma` 的 `requiresApproval @default(false)`）。團主要自己回到課程詳情的「已報名會員（N 人）」才看得到（依據：`src/app/organizer/classes/[classSessionId]/page.tsx`）。

## 走查發現（依嚴重度）

Q1＝知道該做什麼、Q2＝看得到入口、Q3＝看得懂結果、Q4＝知道成功了；不是 4 題造成的（例如日常工作缺口、通知漏發）填「—」。

| # | 在哪一步 | 哪一題 | 發現 | 卡到誰 | 嚴重度 | 依據 |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | 9→10 選定老師後建課 | Q1 | **選定老師後，團主沒有任何方式聯絡老師，但建課表單要團主填「和老師確認後的實際時間」。** 回應卡上沒有老師的聯絡方式，也沒有連到老師公開頁；老師那邊被選定後，需求詳情就看不到了，也看不到團主的聯絡資料。表單說明寫「可以依和老師討論的結果調整」「請填和老師確認後的實際時間」，但站內沒有可以討論的地方。團主只能憑老師回應裡的「可配合時段」猜一個時間，猜錯就撞到老師行程（建課會失敗，見 F9），或建出老師不知道的時間。對照直接開團路線：那條要老師確認課程內容才能開放，找老師這條則是團主自己填完就成立。 | 雅婷、王老闆、小芳 | 高（待驗證） | `organizer-read-service.ts` 的 select 沒有聯絡欄位；`demands/[demandRequestId]/page.tsx` 建課表單說明；`select-and-submit-core.ts` 註解「需求已媒合，老師端詳情看不到」 |
| F2 | 10→11 建課後 | Q4 | **建完課只是「草稿」，但所有訊息都說「已建立完成」，之後沒有地方提醒要「開放報名」。** 成功提示「課程已建立。」、團主與老師收到的通知都寫「已經建立完成」。需求詳情的下一步卡片會寫「到課程頁可以開放報名、分享連結並查看報名狀況」，但它是 info（不進「待你處理」），而且團主要自己回到那筆需求才看得到；總覽只列需求與直接開團的邀請，不列課程；「我的課程」卡片只有一個「草稿」標籤。團主若建完課就離開，總覽與通知都不會再提醒，學員也報不了名。 | 小芳、雅婷 | 高（待驗證） | `next-step.ts` 的 `converted_to_class`；`dashboard/page.tsx` 的 `pendingActions`；`classes/page.tsx`；`copy.ts` 的 `class_session_created` |
| F3 | 10、12 公開設定 → 團員點連結 | Q3 | **「同時公開在課程列表」預設不勾，結果是團員點連結時，沒登入只看到「登入後查看這堂課」，連課名和是哪個團體都看不到。** 團主勾選時只被告知「不會出現在公開列表」，不知道這也決定了團員第一眼看到什麼。團主自己按「開啟課程頁」是登入狀態，看到的是完整課程頁，跟團員看到的不一樣。 | 小芳（她的團員多半先看到登入畫面）、雅婷 | 中（待驗證） | `demands/[demandRequestId]/page.tsx` 的 `isPublic` checkbox；`ClassSignInGuide.tsx`；`ClassShareLink.tsx` 的「開啟課程頁」 |
| F4 | 9 比較老師回應 | Q3 | **選老師時能比較的資料很少。** 程式已經讀出老師的自我介紹、年資、服務區域、授課形式、照片，畫面只顯示名字、教學風格、擅長標籤、回覆、時段、價格；也沒有連到老師公開頁。雅婷要「對上級好交代」，只看這些很難說明為什麼選這位。 | 雅婷 | 中（待驗證） | `organizer-read-service.ts` 第 34–44 行 vs `ResponseList.tsx` |
| F5 | 2、6 送審前後 | Q1、Q4 | **不知道要等多久，也看不到整條路有多長。** 入口頁的「開始的三個步驟」停在「等待平台審核」，沒提到之後還要選老師、建課、開放報名；送審後只寫「平台正在審核」，沒有大約多久，也沒有說沒有老師回應時怎麼辦。 | 雅婷、小芳 | 中（待驗證） | `OrganizerRequestExplainer.tsx` 的 `howItWorksSteps`；`next-step.ts` 的 `submitted`／`published` |
| F6 | 7 審核結果通知 | Q3 | **審核通過／退回的通知沒寫是哪一筆需求，點了只到需求列表。** 「需求已發布」內文沒有需求名稱，也沒有帶 target，會寄 email。第一次使用的人只有一筆還好；第二次以後就要自己猜。對照「有老師回應了你的需求」那則已經帶名稱、直達單筆。 | 雅婷 | 中（待驗證） | `admin-service.ts` 兩個 `notifyUsers`（`{}` 參數、沒有 target）；`copy.ts`；`link.ts` 的 `demand_request_published` |
| F7 | 13 第一位學員報名 | — | **有人報名時，團主不會知道。** 報名直接成立時通知學員本人與授課老師（老師只有站內），收件人不含團主；總覽和「我的課程」也沒有報名人數，要點進單堂課程詳情才看得到名單。小芳最在意「人數湊不湊得到」，現在只能一直點進去看。 | 小芳、雅婷 | 中（待驗證） | `create-enrollment-core.ts` 的收件人；`dashboard/page.tsx`；`classes/page.tsx` |
| F8 | 9、10、13 價格 | — | **價格的說法前後不一致，團員也不知道要不要付錢。** 老師填「建議價格」時被告知「僅供團主參考」，但學員報名後在「我的報名」會看到這個價格（付款快照的 P5 規則）；報名前課程頁看不到價格；團主建課表單沒有價格或「誰付費」的欄位。公司福委辦的課常是公司付，團員看到老師報給團主的整團價格會誤會。這是跨角色問題，影響學員 Kevin。 | 雅婷（學員端影響 Kevin） | 中（待驗證） | `teacher/demands/[demandRequestId]/page.tsx` 的「僅供團主參考」；`src/domain/enrollment/payment-snapshot.ts`；建課表單沒有 `priceNote` |
| F9 | 10 建課失敗 | Q4 | **建課失敗時，剛填的開始／結束時間會清空。** 失敗會整頁重新導回需求頁，表單欄位只帶需求原本的值，使用者填的時間、改過的內容都不見。最容易失敗的情況正是 F1 造成的「時間撞到老師的行程」。 | 雅婷、小芳 | 中（待驗證） | `demands/[demandRequestId]/actions.ts` 的 `redirectWithFeedback`；建課表單的 `startAt`／`endAt` 沒有預設值 |
| F10 | 5 需求表單 | Q3 | **需求表單「服務類型／需求說明／適合對象」重複、不順**（沿用 backlog 第 29 項 F5-1）。這次補充：表單上的「適合對象」其實是程度（初學／進階），團主課程頁同一個欄位叫「程度」，而服務類型裡又有「特定對象與主題」，三處用「對象」指不同的事。整張表單 11 個欄位，雅婷會覺得長。 | 雅婷、小芳 | 沿用，未評 | backlog 第 29 項；`DemandRequestForm.tsx` 的 `targetLevel`；`classes/[classSessionId]/page.tsx` 的「程度」 |
| F11 | 10 課程類型 | Q3 | **課程類型只能單選，預設帶需求的第一個類型，可能是「還不確定，請老師建議」，這段文字會直接出現在學員看到的課程類型。** 需求選的其他類型也會在建課時遺失。 | 小芳 | 低（待驗證） | 建課表單的 `serviceType` select；`create-class-session-core.ts` 的 `serviceTypes ?? [serviceType]`；相關 backlog 第 12 項 |
| F12 | 4、11、13 全程 | Q3 | **用詞前後不一致。** 團主資料頁寫「組織名稱」「組織類型」，總覽寫「補齊組織聯絡資訊」，入口頁寫「所屬組織」，但導覽列與其他頁都叫「團體」；課程頁寫「已報名會員」「會員就能看到」，複製連結後寫「傳給團員」。glossary 規定介面用「團體」「學員」，避免「會員」。 | 小芳 | 低（待驗證） | `OrganizerSignupForm.tsx`；`dashboard/page.tsx`；`classes/[classSessionId]/page.tsx`；`docs/context/glossary.md` |
| F13 | 9、11 老師端 | — | **另一方不知道狀態變了。** 沒被選上的老師不會收到通知（回應只是被標成「未獲選」）；團主開放報名時，授課老師也沒收到通知，老師最後收到的一則是「課程已建立完成」（實際上還是草稿）。 | 老師端（跨角色） | 低（待驗證） | `select-and-submit-core.ts` 第二個 `notifyUsers` 的收件人；`class-session/service.ts` 開放報名沒有通知 |

## 日常工作對照

| 團主平常要做的事 | 網站現況 | 備註 |
| --- | --- | --- |
| 建立團體資料，可能不只一個團體 | 有 | 第一次在一頁式團主資料建立；之後在「我的團體」新增（`src/app/organizer/organizations/`） |
| 發起需求、找老師 | 有 | `/organizer/demands/new`；要等平台審核，沒寫要等多久（F5） |
| 比較老師回應、選定老師 | 部分 | 能看回應、選定；能比較的資料少、沒有老師頁連結（F4） |
| 已有合作老師時直接邀請開課 | 有 | `/organizer/class-proposals/new`，入口頁與總覽首屏都看得到；這次沒有往下走 |
| 開放團員報名、分享給團員 | 有 | 開放報名＋複製完整連結；但草稿沒有提醒（F2），預設不公開會影響團員第一眼（F3） |
| 掌握報名人數 | 部分 | 只有單堂課程詳情有名單；沒有通知、列表沒有人數（F7） |
| 取消或改期 | 部分 | 可以取消（課程頁「取消課程」、需求頁「取消需求…」）；**不能改期**：團主課程頁只有開放、複製、取消、標記完成，沒有改課（`classes/[classSessionId]/page.tsx` 註解），建課表單也寫「之後無法修改」。要改只能取消重開 |
| 與老師溝通細節 | 沒有 | 需產品主人決策（jobs 清單標「未定」）；找老師這條路線因此在建課那一步卡住（F1） |
| 企業進階權限，例如多位管理者 | 沒有 | 超出 V1 |

讀法：功能大多有了，問題在**步驟和步驟之間的交接**：選完老師不知道怎麼跟老師對時間（F1）、建完課不知道還要開放（F2）、開放後不知道有沒有人報（F7）。每一頁自己看都清楚，但從一頁走到下一頁時，該提醒的地方沒有提醒。

## 建議

每條標來源：（skill 方法：<哪個原則>）或（Claude 的判斷）。
動到 Auth／schema／權限／狀態機／V1 scope 的標「需產品主人決策」。

1. **F1：先決定選定老師之後雙方怎麼聯絡。** 選項例如：(a) 選定後，雙方在各自頁面看到對方的聯絡方式（團主看老師的 `contactInfo`，老師看團體的聯絡窗口）；(b) 改成跟直接開團一樣，團主填好課程後送老師確認，老師確認才開放。(a) 是揭露個資的權限變更，(b) 會改狀態機，**兩個都需產品主人決策**。在決定之前，只改畫面能做的是：把建課表單的「請填和老師確認後的實際時間」改成誠實的說法，並把被選定老師回應裡的「可配合時段」放在時間欄旁邊。（Claude 的判斷；Nielsen 2：用語要符合使用者實際情境）
2. **F2：讓草稿課程出現在總覽「待你處理」，文案改成「課程已建立，還沒開放報名」。** 判斷條件用現有資料（課程 `status = draft`、`organizerProfileId` 是自己）就做得到，不用改 schema，**只改畫面**＋新增一個讀取查詢。課程頁草稿狀態也補一句「學員還看不到這堂課，開放報名後才能分享連結」。通知文案（給團主與老師的「已經建立完成」）要改的話，**只能改找老師媒合建課這一處的內容**：`class_session_created` 這個通知類型同時用在直接開團（`open-direct-class-core.ts`，建好就已開放報名）和老師自建課（`create-teacher-class-session-core.ts`，可建立時直接開放），共用文案一律改成「還沒開放報名」會讓這兩條路線說錯。做法是依課程建立後的實際狀態決定文案（例如傳入狀態參數），或媒合建課改用自己的文案。總覽提醒那部分，團主端讓草稿變成開放報名的入口只有課程頁那一顆「開放報名」按鈕（直接開團是建立時就一次開放，不會留下草稿），所以只要處理這一處。（skill 方法：onboard.md 的 Context Over Ceremony，在需要的時候提醒；Nielsen 1：系統狀態可見）
3. **F3：建課表單的公開設定下面，寫清楚團員點連結會看到什麼**，例如「不公開時，團員要先登入才看得到課程內容」。分享區也可以加一句同樣的說明。**只改畫面**。要不要改預設值（預設公開或預設不公開）會影響隱私與所有團主課，需產品主人決策。（Claude 的判斷；skill 第 2 步「預設值對下一個角色的影響」）
4. **F4：回應卡補上已讀出的自我介紹、年資、服務區域、照片。** 這些資料已在 `organizer-read-service.ts` 讀出，**只改畫面**。若要連到老師公開頁，需要多讀老師 id 與 `isPublicPageEnabled`（改讀取查詢，不動 schema）。（Claude 的判斷；Nielsen 6：讓人看得到資訊來比較，不用靠記憶）
5. **F5：入口頁步驟補完整條路（找老師 → 選老師 → 開放報名），送審後的等待說明補「通常多久」。** 步驟文字只改畫面；「多久」是對外承諾，要產品主人給數字，需產品主人決策。（skill 方法：onboard.md 的 Time to Value，先讓人知道多快能拿到結果）
6. **F6：審核通過／退回的通知補需求名稱與單筆 target。** `organizer_demand_request` 這種 target 已存在，不用改 enum，不動 schema。要改三處：(a) `admin-service.ts` 兩個 `notifyUsers` 補 target 與 `demandTitle`（退回那一條目前的查詢沒讀需求名稱，要補讀）；(b) `copy.ts` 的 `demand_request_published`、`demand_request_rejected` 文案目前不用任何名稱參數，要改成顯示名稱，只改呼叫端通知上不會出現名稱。（Claude 的判斷；跟 backlog 第 26、31 項的 target 盤點同一類，可以一起做）
7. **F7：分兩件事。** (a)「我的課程」卡片與總覽顯示「已報名 N / 名額」，用現有報名資料計數，**只改畫面**。(b) 有學員報名時要不要通知團主，**需產品主人決策**（老師已收到站內「有新的報名」，不在這次範圍）；若要做，團主那則要帶團主自己的單堂 target、連到團主課程頁 `#roster`，不能沿用給老師的 target。（Claude 的判斷）
8. **F8：價格與付費方式要先決定規則。** 牽涉付款快照 P5 規則與學員看到的內容，**需產品主人決策**：例如建課表單加「給團員看的價格說明」（可填「公司支付，團員免費」），不填時不再沿用老師報給團主的價格。在決定前，至少把老師端「僅供團主參考」的說明改成符合現況。（Claude 的判斷）
9. **F9：建課失敗時保留已填的欄位。** 比照團主資料表單（票 03）改成失敗時回傳值、留在原頁，**只改畫面與 action**。（Claude 的判斷；Nielsen 9：幫使用者從錯誤中恢復）
10. **F10–F12：併入既有待辦。** F10 跟 backlog 第 29 項一起做；F11 跟 backlog 第 12 項（移除 `serviceType`）一起處理，並把「還不確定」排除在課程類型之外；F12 照 glossary 統一用詞，**只改畫面**。（Claude 的判斷）
11. **F13：老師端通知缺口**留給下一次老師角色走查，或併入 backlog 第 31 項的通知盤點。（Claude 的判斷）

## 真人測試腳本（每人約 20 分鐘，只觀察、不教）

開場：「我們測的是網站，不是你。想到什麼就說出來，卡住也是很有用的資料。」

事前準備：需要一筆「已有 2 位老師回應」的需求，和一位可以配合報名的測試學員帳號；由產品主人自己準備，不寫假資料進正式資料庫。

1. 「你是公司福委，想幫同事辦瑜伽課，還沒有認識的老師。從首頁開始，你覺得送出之後會發生什麼事、大概要等多久？」→ 驗 F5
2. 「這筆需求已經有老師回應了。請選一位你會推薦給主管的老師，並說說為什麼選他。」→ 驗 F4
3. 「選好之後，請把這堂課的時間定下來。你會怎麼決定時間？」→ 驗 F1、F9
4. 「課程建好了。現在請讓同事可以開始報名。」（觀察：建完課是否以為已經完成、是否找得到開放報名）→ 驗 F2
5. 「把報名連結傳給一位同事。你覺得同事點開會看到什麼？」（接著讓受測者用未登入的手機打開連結）→ 驗 F3
6. 「隔天，你想知道有幾個人報名了。你會去哪裡看？」→ 驗 F7
7. 「同事問你：這堂要自己付錢嗎？你會怎麼回答？在網站哪裡找得到？」→ 驗 F8

每題記：有沒有完成、花多久、在哪裡停下來、說了什麼原話。

## 體驗紀錄（真人測試時填）

| 受測者 | 題號 | 原話／觀察 | 類型（看不懂／找不到／太擠／錯誤／建議） | 對應 F# |
| --- | --- | --- | --- | --- |

<!-- codex-peer-reviewed: 2026-10-26T10:40:49Z rounds=2 verdict=approved -->
