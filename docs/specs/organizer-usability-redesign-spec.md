# Organizer Usability Redesign Spec

日期：2026-10-03（2026-10-04 補第 13 節實作 contract）。狀態：**Q1–Q19 已確認；Q18 採方案 A，Q19 核准完整規格與分批實作。票 01 已完成正式 contract 文件；程式尚未實作。**

本文件將[團主訪談決策](../organizer-usability-plan.md)轉成可實作、可驗收的規格，實作切片見[分批計畫](../superpowers/plans/2026-10-03-organizer-usability-redesign-plan.md)。舊計畫保留歷史，本文件不宣稱新 schema、permission 或 state machine 已落地；最終確認後需同步相關 domain 與 route 文件。

## 1. 問題與成功標準

團主應能從任何合理入口知道「我代表哪個團體」「我需要找老師，還是已有老師」「目前進度」「下一步由誰操作」。首次資料只填一次，切頁補資料不遺失內容，已有老師不必假裝重新找老師。

- 登入、首次建立資料與返回流程保留原目的地；不意外回首頁或建立另一份草稿。
- 同一帳號能以團主身分管理多個自有團體，每筆需求與課程清楚顯示所屬團體。
- 兩種開團路徑清楚分開；需求審核與老師授課確認不混用。
- 各列表與詳情顯示一致的實際進度；有老師回應不再誤寫等待回應。
- 開放報名後可複製完整網址，團員登入後返回原課程，不從總覽重新找。
- 手機可單手找到主要操作，缺項、錯誤與目前狀態清楚可辨識。

## 2. 已確認產品決策

| 範圍 | 已確認決策 |
| --- | --- |
| 名詞 | 建團＝管理公司／社團資料；開團＝成立團主團課並邀請學員報名。 |
| 身分 | 老師可用同帳號兼任團主；不自動賦予老師團體管理權限。 |
| 團體 | 一位團主管理多個自有團體，各有聯絡資料；不多人共管、不管理獨立團員名冊。 |
| 首次使用 | 一頁建立團主與第一個團體，姓名／email 預填；完成後直接進原先選擇的表單。 |
| 找老師 | 需求 → 平台審核 → 老師回應 → 選老師 → 成立課程 → 開放報名。 |
| 已有老師 | 選已審核老師 → 填課程 → 老師確認 → 團主開放報名；不逐課平台審核。 |
| 自己授課 | 本人是已審核老師時，可在團主表單選自己並明確確認，不必接受自己的邀請。 |
| 招募 | 預設僅透過連結，登入查看完整內容與報名；可另選公開，不驗證公司／社團成員。 |
| 邀請異動 | 待確認不占時段；確認才占。修改主要內容讓原確認失效並釋放時段；開放後取消再開。 |
| 表單 | 單頁分區、缺項可定位、明確儲存草稿與離開保護；不持續自動雲端儲存。 |
| 操作結果 | 前往單筆詳情，顯示下一步與唯一主動作，通知／待辦直達同一筆。 |

## 3. User Journeys

### 3.1 首次找老師

`/organizers/request` 選需要找老師 → Google 登入（保留 intent）→ `/organizer/profile` 一頁建立本人與第一個團體 → `/organizer/demands/new` 預選剛建立的團體 → 儲存草稿或送出審核 → 該筆需求詳情。

介紹頁交代審核、老師回應、選老師、成立課程與報名全程，不承諾低價競標、即時媒合或保證找到老師。

### 3.2 已有合作老師

同一入口選已有合作老師 → 若需登入／首次資料沿用上述連續流程 → 選自有團體、平台 approved 老師 → 填完整課程 → 確認送合作邀請 → 單筆邀請詳情 → 老師確認 → 團主開放報名 → 正式課程詳情 → 複製報名連結。

選自己授課時提供明確的本人確認操作，仍檢查 approved、時間衝突與完整欄位；不因老師與團主是同一帳號而省略資格或排課檢查。

### 3.3 返回使用與多團體

總覽首屏有兩種入口與待你處理。開需求／開團時選自有團體，只有一個時預選，多個時保留所選團體。點新增團體在目前流程展開簡短表單，不丟失課程內容；已填內容不可因切換團體而重設。

第一筆團體完整建立；往後聯絡資料不完整的團體可儲存資料草稿，但在需求送審／合作邀請送出前補齊。這項沿用原有送審聯絡完整度邊界的細則已隨 Q19 確認。

### 3.4 團員分享連結

未登入收到僅透過連結招募的課程網址 → 共用且不揭露課程內容的登入引導 → 登入後回同一課程 → 看時間、地點、老師、名額與是否可報名 → 基本 consent → 報名結果。

無效、未開放或無資格課程在登入後依既有規則回 not-found／不可報名。登入引導需對所有非公開可見結果採一致外觀，不透露某筆私有課程是否存在；不能用顯示私有標題／地址的方式換取順暢。

## 4. 頁面與 Route Map 草案

下列新增 route 是建議命名，非已上線 route。所有 identifier 維持英文。

| Route | 頁面責任 | 主要操作 |
| --- | --- | --- |
| `/organizers/request` | 訪客品牌說明＋兩種路徑；已有團主看精簡選擇。 | 我需要找老師／我已有合作老師 |
| `/organizer/dashboard` | 跨團體總覽、待你處理、近期需求與課程；列表可依團體篩選。 | 兩種開團捷徑；點待辦直接處理 |
| `/organizer/profile` | 首次一頁建立本人＋第一個團體；已建立者僅編輯本人稱呼。 | 建立並繼續／儲存團主資料 |
| `/organizer/organizations`（新增） | 自有團體列表與聯絡完整度。 | 新增團體／查看該團體需求與課程 |
| `/organizer/organizations/[organizationId]`（新增） | 單筆自有團體與聯絡資料。 | 儲存；從流程來則儲存並返回 |
| `/organizer/demands` | 需求狀態、老師有效回應數、團體篩選與下一步。 | 頂端提出需求；單筆詳情 |
| `/organizer/demands/new`、`/[id]/edit` | 找老師用的單頁需求表單，明確選團體。 | 儲存草稿／送出審核 |
| `/organizer/demands/[id]` | 下一步、老師回應、正式課程連結、需求內容。 | 選老師／成立課程／查看該課程 |
| `/organizer/class-proposals/new`、`/[id]/edit`（新增） | 已有老師的單頁課程安排與草稿。 | 儲存草稿／送合作邀請；本人授課確認 |
| `/organizer/class-proposals/[id]`（新增） | 單筆邀請、確認／拒絕原因、異動後需要重確認。 | 修改／撤回／開放報名／查看正式課程 |
| `/organizer/classes` | 正式課程列表；上方另列直接開團的草稿與合作進度。 | 已有老師直接開團；依團體篩選 |
| `/organizer/classes/[id]` | 正式課程、報名數與名單、分享。 | 開放前：開放報名；開放後：複製報名連結 |
| `/teacher/class-proposals/[id]`（新增） | 老師自己收到的合作邀請與最新內容。 | 確認授課／拒絕並說明原因 |
| `/classes/[id]` | 學員查看、登入返回、報名結果。 | 登入查看／報名 |

老師總覽與站內通知連到該筆邀請；已有團主資料的老師也能進團主流程。既有老師總覽／課程導覽保持原本分工，不把未確認邀請偽裝成已排定課程。

專區導覽建議：總覽、我的團體、我的需求、我的課程、團主資料、通知。手機收合為可辨識選單，目前頁面有明確標示；不在手機塞入六個緊湊橫排項目。建立入口位於各頁首屏，不需先捲完整個列表。

## 5. 表單、草稿與資訊設計

- 第一次：你是誰／第一個團體／聯絡方式；顯示名稱與聯絡窗口預設同步，手動改聯絡人後停止同步。
- 需求：團體與上課目的／時間地點／補充與預算；沿用課程風格最多三項與「還不確定」互斥、線上地點選填等已落地規則，不清理舊欄位或另改分類。
- 直接開團：團體與老師／課程安排／招募設定；課程名稱、課程風格、起迄時間、地點、名額為送邀請必要欄位。說明選填；瑜伽類型沿用團主課程不強制必填的既有邊界。
- 老師選擇只顯示可被選取的 approved 名片資訊與穩定 ID，搜尋不能挪用 admin-only 列表，也不揭露私人電話／email。最小搜尋使用公開顯示名稱，顯示擅長類型與既有公開服務地區協助辨識；不新增 AI 推薦。
- 團體摘要包含名稱、類型、聯絡完整度與編輯入口；不重填已儲存資料，也不把聯絡方式當授權憑證。
- 缺項與欄位錯誤以文字＋定位表達，不只使用顏色；送出資格涵蓋實際格式、數值範圍、聯絡資料、老師資格與日期，不只非空計數。
- 儲存新草稿後網址導到該筆 edit，不停留 new；返回帶穩定草稿 ID、所選團體與合法站內目的地。不能由 client 指定 organizer owner。
- 補資料操作先明確儲存；失敗時不離開、保留輸入、錯誤可見。放棄未儲存變更需明確選擇；一般首次資料／團體表單 server validation 失敗也要保留輸入。
- 返回連結、登入 callback 與分流 intent 使用允許值與站內路徑驗證，不接受任意外站 redirect；Next.js internal navigation 與 browser unload 都須評估離開保護，不僅 beforeunload。
- 送出確認顯示團體、老師（適用時）、時間與送出後的效果；草稿不送審、不通知老師、不開放報名。
- 時間使用 Asia/Taipei，期望時段只是偏好，不自動猜出確切起迄時間；需求轉課可以帶入可確定的標題、地點、人數、說明與課程風格，再由團主確認。

## 6. 多團體資料模型（Q18 已核准方案 A）

採 own-scoped 一對多，不新增共管 membership：

- `OrganizerProfile.userId` 維持 unique。
- `Organization.ownerOrganizerProfileId` 指向擁有者；`OrganizerProfile.organizations` 為反向集合。新建團體一定有 owner；不可由 client 修改 owner。
- 第一階段採 additive migration：新增 nullable owner FK、index，保留舊 `OrganizerProfile.organizationId` 作相容橋接。待舊服務與 fixtures 均改用多團體後，再用獨立 contract migration 移除舊關聯；不得同一批直接刪舊欄位。
- Backfill 保留原團體 ID、聯絡資料、需求與課程 FK；不重建公司／社團。檢查 legacy profile、demand、class 的 owner 來源是否一致；一個團體出現多位 owner 或矛盾歷史歸屬時停止，產出不含敏感資料的數量／影響說明，請產品主人決定，不自動合併或轉移。
- 無法確定 owner 的舊團體保留資料並且不暴露給任意團主；admin 原有查看能力保持。migration 未執行前不能宣稱資料已完成回填。
- 每筆 demand／proposal／class 明確保存自己的 `organizationId`，變更目前選取團體不改動舊紀錄。非草稿需求、已送邀請的團體歸屬不可直接改；需要更換則撤回／另建。
- 不新增歷史聯絡資料 snapshot；團體名稱／聯絡資料的更新維持既有「引用目前團體資料」語意，課程自己的時間／地點等內容不受影響。此相容性細則已隨 Q19 確認。
- 本輪提供新增、查看、編輯，不提供團體刪除、歸檔或權限轉移；保護已被需求／課程引用的資料。

## 7. 合作邀請與正式課程的模型（Q18 已核准方案 A）

### 方案 A：獨立 `OrganizerClassProposal`（已核准）

草稿與合作確認保存為 proposal，不在待確認時建立正式課程。欄位包含 owner organizer、organization、目標 teacher（草稿可未選）、課程欄位草稿、`status`、`version`、拒絕原因、確認版本／時間與確認者、可空且 unique 的 `classSessionId`。送邀請與確認時驗證完整資料，草稿採有界的 typed 欄位，不建立任意權限／JSON 控制介面。

核准狀態與 actor：

| 轉換 | Actor | 條件與效果 |
| --- | --- | --- |
| none → draft | 團主 own | 所選團體屬本人，可存部分欄位，不通知、不占時段。 |
| draft／declined → pending_confirmation | 團主 own | 團體聯絡與課程完整、老師 approved、未開始；送邀請。 |
| pending_confirmation → confirmed | 受邀老師 own | 老師仍 approved，確認最新 version；鎖老師時段並檢查衝突，成功才保留。 |
| draft → confirmed（本人授課） | 團主與老師同一 User | 明確本人確認；與受邀老師確認相同的資格、版本、完整性與排課檢查。 |
| pending_confirmation → declined | 受邀老師 own | 附拒絕原因；不影響學員報名或既有課程。 |
| draft／pending_confirmation／declined／confirmed → withdrawn | 團主 own | 未轉正式課程；confirmed 撤回同步釋放時段。 |
| confirmed → draft（修改主要內容） | 團主 own | 未轉正式課程；version 增加、清除確認、釋放時段，修改後須重新送邀請。 |
| confirmed → converted | 團主 own | 老師仍 approved、未開始、確認版本一致；同 transaction 建正式課程＋更新關聯＋移交時段占用。 |

待確認中的修改使 version 增加，老師舊頁面的確認不能接受已修改內容；待確認被拒後顯示原因與修改入口，不丟失課程安排。邀請超過開始時間不得再送出、接受或開放，以「已過期，需要修改時間」呈現；本輪不新增 cron 或自動過期 transition。

所有排課路徑共用老師鎖，檢查既有未取消的 `ClassSession` 與 confirmed、尚未轉換的 proposal。待確認不占時段，也不保證老師有空；確認時再次檢查。proposal 轉課時排除自己的 confirmed proposal，避免自我衝突；不可排除別人的預留。

開放報名以單一 transaction 完成：鎖老師／proposal → 驗 own、資格、version、日期與時段 → 建 `ClassSession`（`origin=organizer_direct`、`status=open_for_enrollment`）→ proposal 關聯同一 class 並 converted。這是新的 `(none) → open_for_enrollment` 路徑，必須明確同步 state machine 文件；不能先建 draft 再在另一 transaction 呼叫 open service。重複按鈕與重試收斂到同一課程，唯一關聯不得產生第二筆。

三種課程來源不變量：

| Origin | Demand | Organizer／Organization | Proposal |
| --- | --- | --- | --- |
| organizer_matched（既有） | 必有 | 必有 | 無 |
| teacher_initiated（既有） | 無 | 無 | 無 |
| organizer_direct（新增） | 無 | 必有 | 必有已確認並 converted 的 proposal |

不產生假的 `DemandRequest`／`DemandResponse`，不把直接邀請標成已媒合。團主邀請轉成的正式課程採既有團主 enrollment 規則，`requiresApproval=false`，報名確認不因新增合作邀請而改變。

直接課程沒有 demand，DTO 不可假設能從 demand 取得適合對象；沿用可空值並顯示未指定，不猜測為初學。正式課程列表與來源標籤須辨識第三種 origin，不能依 nullable FK 隱含推導來源。

代價：新增 proposal model 與老師預留時段檢查；優點：既有課程狀態機與已開放後不編輯的規則保持清楚，邀請草稿與拒絕不混進正式課程。

### 方案 B：以 `ClassSession` 承擔所有邀請（歷史選項，未採用）

需要讓欄位支援未填完的草稿，新增／接線邀請拒絕與撤回、改動目前所有非取消課程都占時段的條件，並處理老師確認後的修改。模型數較少，但影響既有媒合、老師開課、報名、唯讀 DTO 與所有課程列表的範圍較大。若選 B，需另重寫第 7 節，不能以方案 A 的驗收直接實作 B。

## 8. Permission 與通知邊界（Q18／Q19 已核准）

- 團主只能管理自己 owner 的團體／需求／proposal／課程；所有選取 ID 由 server 驗證。團體搜尋、DTO 不回傳他人或 admin-only 欄位。
- 老師只讀／確認／拒絕自己的邀請；授課確認不賦予開放、修改或取消團主課程的權限。老師的正式課程 roster 可沿用既有授課 own-read。
- 確認、直接開團送出與開放均重驗 approved。suspended 老師不能接受／自授課／開放新報名；團主保留查看、撤回／取消的既有能力。
- 老師自己的 open／cancel／complete mutation 必須在 server 驗證 origin，不能只靠 UI 藏按鈕；新增 direct origin 時要 review 既有 mediated 邊界，防止誤開放別人管理的課程。
- Admin 不新增代理老師同意、替團主選老師或直接開團能力；既有 admin 課程查看／取消繼續按原規則運作。新增 origin 的 admin 顯示相容性只做窄修改，與進行中的後台工作協調。
- 站內通知涵蓋送邀請、確認、拒絕、撤回與重大異動；選取收件人由 service 解析 owner／受邀老師，不接受 client 自訂收件人或文字。本人授課不寄給自己重複的「待你確認」。每則直達合法單筆頁，重試不得重複發送。
- 本輪不啟用尚未真正寄送的 email sender、不接 Resend、不更改通知已讀 schema；站內通知先接好，email 維持獨立工項。
- 首頁、登入、role switch 的既有 last-role 行為保留；只有有明確 intent／callback 時回該流程。未登入的私有詳情不能丟掉原目的地。

## 9. Scope 收斂與後續需求（Q19 已核准）

直接開團先支援與現行團主建課相同的單堂；不新增團主 recurring series。既有老師每週固定／指定日期保留，不動其排程功能。需求頻率仍可表達偏好，不代表自動建立整期課程。

產品主人於 Q18／Q19 回覆時補充希望「團主一次安排多堂課」。此需求已記入 [backlog 第 18 項](../backlog.md#18-團主一次安排多堂課2026-10-03)，建議接在單堂完整流程驗收後；尚未核准系列確認、逐堂／整期報名、部分衝突與取消規則。本次切票不新增團主 series schema 或多堂自動排程。

本輪不做多人共管、移交、團員資格驗證、獨立名冊、站外未審核老師授課、AI matching、付款／退款自動化、LINE／Calendar 整合、native app、Wellness／Academy／Retreat 模組、複雜遊戲化、老師完整 SaaS。正式報名與課程取消等既有狀態轉換保持原規則。

## 10. RWD、品牌與 Accessibility 驗收

- 在 390px 與 1280px viewport 完成兩條路徑；另檢查 320px 無水平溢出。
- 保持 gentle、clear、spacious 的 Free Soar 語氣；一頁一個主標題、一個主要狀態動作，等待不使用急迫行銷文案。
- 手機選單、團體選擇與欄位控件有可辨識 label；所有操作可用鍵盤，缺項定位移動到可理解的欄位，錯誤／儲存結果用 aria-live。
- Sticky 操作列不遮住輸入欄位、錯誤、螢幕鍵盤或最後一個操作；重要按鈕觸控範圍足夠。
- 草稿成功、送邀請、審核中、老師拒絕、老師已確認、時段衝突、老師失去資格、開放報名、滿額與無效連結都有清楚文字與下一步。

## 11. 核心測試與 Review 驗收

1. 訪客分流 → 登入 → 首次資料 → 正確表單；已有資料者不重填，不猜錯多角色意圖。
2. 同帳號多團體新增／編輯／選取／篩選；他人 ID 被拒，舊需求與課程保留原關聯。
3. 草稿新建後網址含 ID；補資料、返回、refresh、server validation 失敗不丟內容或產生另一筆。
4. 需求已有老師有效回應仍是 published 時，列表、總覽與詳情正確提示選老師。
5. 邀請未確認不能開放、不能占時段；他人不能看／接受，老師非 approved 不可接受。
6. 已確認 proposal 阻擋所有建課路徑的時段重疊；兩人同時確認只成功一筆；重新確認／撤回釋放時段，舊版本不得被接受。
7. 開放重試只產生同一筆 ClassSession；rollback 不留下課程或錯誤的 converted／預留狀態。
8. 自授課不需角色來回，仍驗資格／日期／衝突；未審核不能自授課。
9. isPublic 預設 false、公開選擇生效；連結登入返回同課，無效／草稿課不洩漏資料；不宣稱限制公司成員。
10. 需求轉課帶入可確定資訊；不能把偏好時段／頻率猜成正式排程。
11. 三種 origin 的 organizer、teacher、member、admin 讀取／操作權限與名單均 review；既有 teacher series 與 mediated 流程回歸。
12. 桌機／手機 manual smoke 加必要 Playwright；TypeScript、ESLint、build、變更邏輯測試與 `git diff --check` 通過。

## 12. 最終確認與文件狀態

產品主人已回答「Q18：A；Q19：A」，核准獨立 proposal 方案與完整規格／分批實作。下一步先依 to-tickets 確認票券粒度與相依，再由首張 docs contract 票把 owner、proposal、direct origin、permission、state transitions 與 routes 同步正式文件；本規格不代表程式已落地，也不授權 production migration、commit、push 或 deploy。切票提案見[票券拆分](../superpowers/plans/organizer-usability-redesign/ticket-breakdown.md)。

本輪未執行 TypeScript／ESLint／build／E2E，因為只有規格與計畫文件，尚未實作上述行為。不得將 source 查證與 docs self review 報為 runtime pass。

## 13. 實作 Contract（票 01，2026-10-04）

本節把第 6–8 節已核准的方案 A 落成工程可直接核對的 contract：schema 形狀、migration 順序、service 介面、鎖順序、錯誤碼與驗證方式。**狀態：已核准、尚未實作。** 正式 domain／route／form 文件以「已核准・未實作（organizer-usability-redesign）」標記同一批內容並指回本節；各票落地時，把對應標記改為「已落地」並寫明票號。下列 identifier 是實作命名的預設，落地時若需微調命名（不改語意），在該票紀錄並同步本節。

### 13.1 多團體 owner：expand → backfill → migrate → contract

**目標 schema（票 02 之後）**：`Organization` 與 `OrganizerProfile` 之間會同時存在兩條關聯，Prisma 必須以 relation name 區分。relation name 只存在於 Prisma 層，不改資料庫的 FK 名稱。

```prisma
model OrganizerProfile {
  organizationId     String?        // legacy pointer：相容期保留，票 15 才移除
  organization       Organization?  @relation("OrganizerLegacyOrganization", fields: [organizationId], references: [id], onDelete: SetNull)
  ownedOrganizations Organization[] @relation("OrganizationOwner")
}

model Organization {
  ownerOrganizerProfileId String?
  ownerOrganizerProfile   OrganizerProfile?  @relation("OrganizationOwner", fields: [ownerOrganizerProfileId], references: [id], onDelete: SetNull)
  organizerProfiles       OrganizerProfile[] @relation("OrganizerLegacyOrganization") // 既有欄位名不變，降低票 02 的改動範圍
  @@index([ownerOrganizerProfileId])
}
```

- **owner FK 為 nullable、`onDelete: SetNull`**：歷史資料可能有找不到 owner 的團體。owner 的 `OrganizerProfile` 消失時，團體與其需求／課程歷史保留，變成只有 admin 看得到的孤立團體，不會被其他團主接管。新建團體一律由 server 寫入 owner，client 不能指定或修改。
- 既有 `DemandRequest.organization`（Restrict）、`ClassSession.organization`（Restrict）不變，歷史 FK 與團體 ID 全部保留。

**Backfill 規則（票 02 migration）**：每個團體的候選 owner，是以下三個來源的不重複 `organizerProfileId` 聯集：legacy `OrganizerProfile.organizationId` 指向它的團主、`organizationId` 是它的需求所屬團主、`organizationId` 是它且有 `organizerProfileId` 的課程所屬團主。

| 候選數 | 處理 |
| --- | --- |
| 1 | 寫入 `ownerOrganizerProfileId` |
| 0 | 保持 null（孤立團體，admin-only），並在 migration 報告列出筆數 |
| ≥2 | **整個 migration 失敗**。訊息只列團體 ID 與候選數，不輸出姓名、email、電話；不挑第一人，也不自動合併或轉移 |

- Migration SQL 的順序：**先跑歧義檢查**（`DO` block，有歧義就 `RAISE EXCEPTION`），通過後才 `ADD COLUMN`、index、FK、`UPDATE` 回填。歧義檢查排在任何 DDL 之前，所以失敗時資料庫沒有任何部分變更。
- 票 02 驗證時，另外確認 Prisma 對這個 migration 的 transaction 行為，並記錄在票內。

**相容期讀寫規則（票 02–14）**：

- 授權一律改用 owner：「這個團體是不是我的」只看 `Organization.ownerOrganizerProfileId` 是否等於我的 `organizerProfileId`。查詢的 `WHERE` 同時帶 id 與 owner，不先讀後比對。
- legacy pointer 只當「舊單團體畫面的預設團體」。首次 bootstrap 同時寫入 owner 與 legacy pointer；之後新增的團體只寫 owner，不改 legacy pointer。
- 票 03（我的團體）、04（需求選團體）、05（邀請選團體）逐批把呼叫點改用 owner 與明確的 `organizationId`；fixtures／seed 建立團體時同時寫入 owner。
- **票 15 contract**：所有讀寫 legacy pointer 的呼叫點歸零並提出證據後，另開破壞性 migration，移除 `OrganizerProfile.organizationId` 與 `OrganizerLegacyOrganization` 關聯；執行前要先取得產品主人確認。

**Rollback**：票 02 的 expand 只新增欄位，舊資料不動。在票 03 開放建立第二個團體之前，可以用一個 forward migration 刪掉 owner 欄位、回到原狀，沒有資料損失。**一旦有團主建立了第二個團體**，刪 owner 欄位就會失去「第二個團體屬於誰」的資訊，之後只能往前修，不能回退。這個截止點寫在票 02／03 的紀錄裡。

### 13.2 `OrganizerClassProposal`（合作邀請）schema

```prisma
enum OrganizerClassProposalStatus {
  draft
  pending_confirmation
  confirmed
  declined
  withdrawn
  converted
}

model OrganizerClassProposal {
  id                 String    @id @default(cuid())
  organizerProfileId String    // owner，server 從登入者解析
  organizationId     String    // 必須是 owner 自己的團體；送出後不可改
  teacherProfileId   String?   // 草稿可以還沒選老師
  title              String?
  description        String?
  serviceType        String?   // 主要課程風格＝serviceTypes 第一個，沿用 ClassSession 慣例
  serviceTypes       String[]  @default([])
  yogaStyles         String[]  @default([])
  startAt            DateTime?
  endAt              DateTime?
  location           String?
  capacity           Int?
  isPublic           Boolean   @default(false) // 預設僅透過連結招募
  status             OrganizerClassProposalStatus @default(draft)
  version            Int       @default(1)
  transitionSeq      Int       @default(0) // 每次成功寫入 +1，供通知去重（13.7）
  declineReason      String?
  withdrawReason     String?
  submittedAt        DateTime?
  confirmedVersion   Int?
  confirmedAt        DateTime?
  confirmedByUserId  String?
  classSessionId     String?   @unique // converted 後指向正式課程；unique 保證一份邀請最多一堂課
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  organizerProfile OrganizerProfile @relation(fields: [organizerProfileId], references: [id], onDelete: Cascade)
  organization     Organization     @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  teacherProfile   TeacherProfile?  @relation(fields: [teacherProfileId], references: [id], onDelete: Restrict)
  confirmedByUser  User?            @relation(fields: [confirmedByUserId], references: [id], onDelete: SetNull)
  classSession     ClassSession?    @relation(fields: [classSessionId], references: [id], onDelete: Restrict)

  @@index([organizerProfileId])
  @@index([teacherProfileId, status])
  @@index([status])
}
```

- FK 刪除行為比照既有：owner 比照 `DemandRequest`（Cascade）；團體、老師、正式課程比照 `ClassSession`（Restrict）。
- 草稿欄位都是有界的 typed 欄位。長度與範圍沿用 `src/domain/class-session/validation.ts`：標題 ≤200、地點 ≤200、說明 ≤2000、名額 1–500、課程風格最多 3 項且在受控清單內。`yogaStyles` 選填（團主課程不強制，見第 5 節既有邊界）。`declineReason` 必填、trim 後 1–500 字；`withdrawReason` 選填、≤500 字。不建立任意 JSON 欄位。
- **`version` 語意**：任何課程內容欄位（老師、時間、地點、名額、標題、說明、風格、公開設定）存檔成功就 +1。老師確認時要帶上自己看到的 `expectedVersion`；與目前的 `version` 不同就拒絕（`proposal_version_stale`）。
- **時段占用**：只有 `status = confirmed` 且 `classSessionId IS NULL` 的邀請占用老師的 `[startAt, endAt)`；轉成正式課程後，改由該 `ClassSession` 占用。
- 本人授課沒有獨立欄位，由「`confirmedByUserId`＝團主本人的 userId＝受邀老師的 userId」推導。
- `ClassSessionOrigin` 新增 `organizer_direct`（票 09，`ALTER TYPE ... ADD VALUE`）；`ClassSession` 只增加反向關聯 `organizerClassProposal OrganizerClassProposal?`，不新增欄位。

### 13.3 轉換、actor、guard 與副作用總表

| 轉換 | Actor | Guard（全部由 server 驗證） | 時段 | 下一位 | 站內通知（票 12） |
| --- | --- | --- | --- | --- | --- |
| none → draft | 團主 own | 團體 owner 是本人 | 不占 | 團主 | 無 |
| draft → draft（存檔） | 團主 own | owner；欄位有界；只有 `submittedAt` 為 null（從未送出）時可換團體 | 不占 | 團主 | 無 |
| draft／declined → pending_confirmation | 團主 own | owner；團體聯絡資料完整；課程必要欄位完整；老師 `approved`；`startAt` 在未來；`expectedVersion` 一致 | 不占 | 受邀老師 | 受邀老師：收到邀請 |
| pending_confirmation → confirmed | 受邀老師 own | 是受邀老師本人；鎖內讀到老師仍是 `approved`；`expectedVersion = version`；在未來；欄位完整；排課無衝突 | **開始占用** | 團主（開放報名） | 團主：老師已確認 |
| draft → confirmed（本人授課） | 同一 User 的團主＋老師 | 上一列全部 guard，加上明確的本人確認操作 | **開始占用** | 團主 | 無（不通知自己） |
| pending_confirmation → declined | 受邀老師 own | 是受邀老師本人；`expectedVersion` 一致；`declineReason` 有效 | 不占 | 團主（修改重送或撤回） | 團主：老師婉拒（含原因） |
| pending_confirmation → pending_confirmation（修改） | 團主 own | owner；`version` +1；不可換團體；可換老師，新老師必須 `approved` | 不占 | 受邀老師（換老師時是新老師） | 沒換老師：受邀老師收到「內容已更新」；換老師：見 13.7 |
| pending_confirmation → draft（改成由團主本人授課） | 團主 own | owner；新老師是團主本人且 approved；`version` +1；不可換團體（`submittedAt` 保留）；內容可暫時不完整（沒有寄給任何人） | 不占（仍需之後明確本人確認才占用） | 團主（由我授課並確認） | 原受邀老師：邀請已撤回（票 12） |
| declined → draft（修改內容） | 團主 own | owner；`version` +1；不可換團體；`declineReason` 保留給團主參考，下次送出時清空 | 不占 | 團主（重新送出） | 無 |
| confirmed → draft（修改內容） | 團主 own | owner；未轉課；`version` +1；不可換團體；清除 `confirmedVersion`／`confirmedAt`／`confirmedByUserId` | **釋放** | 團主（重新送出） | 原受邀老師：安排已變更、需要重新確認（本人授課不通知；換老師時見 13.7） |
| draft／pending／declined／confirmed → withdrawn | 團主 own | owner；未轉課 | confirmed 時**釋放** | 無 | 老師曾看到的（pending／confirmed）：邀請已撤回 |
| confirmed → converted（開放報名） | 團主 own | 見 13.5 | 占用移交給新課程 | 學員報名 | 沿用 `class_session_created` 通知老師（本人授課不通知） |

- **換團體的判斷依據是 `submittedAt`，不是目前狀態**：`submittedAt` 在第一次送出時寫入、之後永遠不清空。所以即使「送出 → 確認 → 修改退回 draft」或「婉拒 → 修改退回 draft」，也不能換團體，要撤回後另建。驗收要涵蓋這兩條路徑。
- **不會自己邀請自己**（票 08）：等待確認中的邀請改成團主本人授課時退回草稿，原受邀老師不再看得到；`submittedAt` 與團體鎖定保留；時段要等團主明確「由我授課並確認」才占用。`submitOwnProposal` 也拒絕把邀請寄給自己。
- 婉拒後的完整流程是：婉拒 → 團主修改並存檔（回到 draft，version +1）→ 重新送出（清空 `declineReason`）→ 老師確認。團主也可以不修改直接重送（`declined → pending_confirmation`）。
- `withdrawn`、`converted` 是終局狀態，不能再回到其他狀態。
- 已過 `startAt` 的邀請不能送出、確認或開放，畫面顯示「已過期，需要修改時間」；不新增 cron 或 `expired` 狀態。
- Admin 不新增任何代確認、代選老師或直接開團的能力。

### 13.4 Service 介面與錯誤碼

新增兩個 domain 模組。page／action 只呼叫這些函式，不在元件裡寫商業邏輯：

- `src/domain/organization/`：`listOwnOrganizations`、`getOwnOrganization`、`createOwnOrganization`、`updateOwnOrganization`、`bootstrapOrganizerWithFirstOrganization`（團主資料＋第一個團體在同一個 transaction 建立，第一個團體的聯絡資料必須完整）、`assertOrganizationOwnedBy(tx, organizationId, organizerProfileId)`。
- `src/domain/organizer-class-proposal/`：`saveOwnProposal`（新建或修改，依目前狀態套用 13.3 的修改規則，回傳 `{ id, version, status }`）、`submitOwnProposal`、`confirmProposalForTeacher`、`declineProposalForTeacher`、`selfConfirmOwnProposal`、`withdrawOwnProposal`、`openDirectClassFromProposal`（回傳 `{ classSessionId }`）、團主與老師各自的 own-read 與列表，以及 `searchApprovedTeacherCards`。
- 老師名片查詢只查 `approved` 老師，只回傳 `teacherProfileId`、`displayName`、`specialties`、`serviceAreas`、`profilePhotoUrl`；不使用 admin 查詢，不回傳 email、電話或審核資料。
- 錯誤碼：`proposal_not_found`（不存在與不是你的都回這個，不揭露存在性）、`organization_not_found`、`organization_contact_incomplete`、`teacher_not_approved`、`proposal_incomplete`、`proposal_starts_in_past`、`proposal_version_stale`、`proposal_invalid_status`、`schedule_conflict`、`decline_reason_invalid`、`not_self_teacher`。

### 13.5 排課鎖、衝突檢查與原子開放

**全站鎖順序（所有建課與邀請路徑共用）**：

全站統一為 **`RecurringClassSeries` → `ClassSession`（多筆時依 id 排序）→ `TeacherProfile` → `OrganizerClassProposal` → `DemandRequest`**（2026-10-05 票 06 與老師排課規格 `docs/specs/teacher-class-scheduling-spec.md` 第 6 節對齊）：

1. 系列與既有場次的鎖（老師排課的系列操作、單場報名）排在老師之前；團主的邀請流程不會鎖既有場次，開放報名是新建一堂課，所以不受影響。
2. 鎖 `TeacherProfile`（`FOR UPDATE`）。同時涉及兩位老師時（例如修改已確認的邀請並換老師），依 `id` 由小到大依序鎖。
3. 再鎖 `OrganizerClassProposal`。
4. 最後才鎖 `DemandRequest`。任何路徑都不得在持有後面的鎖之後，再回頭取前面的鎖。

邀請流程先在不加鎖的情況下讀出候選 `teacherProfileId`（目前的與要換成的），依上述順序加鎖後，再確認邀請的 `teacherProfileId` 與 `version` 都沒變；有變就回 `proposal_version_stale`，不在鎖外做判斷。

**既有路徑要調整（票 06）**：目前團主媒合建課（`src/domain/class-session/__internal__/create-class-session-core.ts`）先鎖 `DemandRequest`，之後才在 `lockTeacherScheduleAndCheckConflict` 鎖 `TeacherProfile`，與上述順序相反；邀請路徑上線後，兩條路徑同時進行就可能 deadlock（兩邊互相等對方的鎖）。票 06 改成：先不加鎖讀出需求選定的老師 → 鎖 `TeacherProfile` → 鎖 `DemandRequest` 並重新確認選定的老師沒變（**已落地**）。測試用的 hooks：`onBeforeLock` 在取第一把鎖之前、`onLockAcquired` 在老師與需求的鎖都到手之後。老師自建與系列路徑本來就先鎖 `TeacherProfile`，維持不變。

**衝突檢查的相容擴充**：`lockTeacherScheduleAndCheckConflict` 保留既有的 positional 參數與 test hooks，另外新增 options（`excludeClassSessionId`、`excludeProposalId`、`hooks`）。查詢除了既有的「同老師、非 cancelled 的 `ClassSession`（含 draft）」，再加上「同老師、`confirmed` 且 `classSessionId IS NULL` 的邀請」，只排除呼叫端自己那一筆。既有的團主媒合建課、老師單堂、老師系列與「生成更多」都走同一個函式，所以都會被已確認的邀請擋下。pending、declined、draft 的邀請不占時段。

**原子開放報名（`openDirectClassFromProposal`）**：在同一個 transaction 內依序執行：鎖老師 → 鎖邀請 → 驗證 owner、`status = confirmed`、`confirmedVersion = version = expectedVersion`、老師仍是 `approved`、`startAt` 在未來 → 衝突檢查（只排除自己這筆邀請）→ 建立 `ClassSession`（`origin = organizer_direct`、`status = open_for_enrollment`、`requiresApproval = false`、`isPublic` 取邀請的設定、`demandRequestId = null`、帶入 organizer 與 organization）→ 邀請改為 `converted` 並寫入 `classSessionId`。

- 這是 `ClassSession` 新的 `(none) → open_for_enrollment` 路徑，不會先建 draft 再到另一個 transaction 開放。
- **重試與並發**：鎖到邀請時，如果它已經是 `converted`、且呼叫者是 owner，就直接回傳既有的 `classSessionId`，視為成功。`classSessionId @unique` 是最後一道保險。
- **失敗時**整個 transaction rollback：不留下半成品課程，邀請維持 `confirmed`，時段占用不變。

### 13.6 三種課程來源與權限修正

| Origin | demandRequestId | organizerProfileId／organizationId | 對應邀請 |
| --- | --- | --- | --- |
| organizer_matched | 必有 | 必有 | 無 |
| teacher_initiated | null | null | 無 |
| organizer_direct | null | 必有 | 必有一筆 converted 邀請指向它 |

- 票 09 的 migration 用 SQL `CHECK` 約束保證前兩欄的組合（加約束前先確認既有資料都符合）；「必有一筆邀請」由 service 與測試保證。
- 顯示與 DTO 一律讀 `origin` 判斷來源，不從 nullable FK 推導。直接開團沒有需求，「適合對象」顯示未指定，不猜成初學。
- **既有缺口（票 09 已修正，2026-10-05 三處都落地）**：老師端的開放、取消、完成原本只用 `teacherProfileId` 過濾，沒有檢查 `origin`。UI 雖然只在老師自建的課程顯示按鈕，直接呼叫函式仍可能操作團主的課。三個實際入口與修法：
  - 開放：`src/domain/class-session/service.ts` 的 `openOwnClassSessionForEnrollmentForTeacher`，判斷與寫入抽到 `__internal__/open-class-session-core-for-teacher.ts`（直接 `updateMany`）。系列「全部開放」（`open-all-draft-occurrences-core.ts`）與「從這場起取消」（`cancel-series-from-occurrence-core.ts`）也一併限定 `origin`。
  - 取消：`__internal__/cancel-class-session-core-for-teacher.ts`，是 `FOR UPDATE` 鎖查詢。
  - 完成：`__internal__/complete-class-session-core-for-teacher.ts`，是直接 `updateMany`。

  三處都要把 `origin = teacher_initiated` 加進實際寫入或鎖定的 `WHERE`，失敗後的分類查詢也要加同樣條件，讓團主的課對老師一律回「找不到」，不揭露狀態。驗收：分別直接呼叫三個函式，對 `organizer_matched` 與 `organizer_direct` 課程都被拒絕且資料沒有變。團主端核心以 `organizerProfileId` 過濾，`organizer_matched` 與 `organizer_direct` 都適用。

### 13.7 站內通知（票 12 的 Human Gate）

- 需要的事件：邀請送出、老師確認、老師婉拒、撤回、內容更新。建議新增以下 `NotificationType`（每個都要一次 `ALTER TYPE ... ADD VALUE`）：`class_proposal_invited`、`class_proposal_confirmed`、`class_proposal_declined`、`class_proposal_withdrawn`、`class_proposal_revised`。收件人由 service 依邀請的 owner 與受邀老師決定；本人授課不發「待你確認」。
- **換老師時的收件人**：service 在同一個 transaction 內先記下修改前的 `teacherProfileId` 與 `status`，通知依修改前後兩組資料決定，不能只看更新後的資料：
  - 原老師曾看到邀請（修改前是 pending 或 confirmed）、且不是團主本人：發 `class_proposal_withdrawn`，告訴他這個安排已取消；confirmed 的情況下他的時段同時釋放。
  - 新老師只在邀請處於 `pending_confirmation` 時收到 `class_proposal_invited`：pending 中換老師時立刻發；confirmed 或 declined 退回 draft 後換老師，則等團主重新送出時才發。
  - 驗收：A 確認後團主改成 B，A 收到安排已取消、B 在送出後才收到邀請；pending 中從 A 換成 B，兩人各收到一則正確的通知。
- 目前 `Notification` 沒有記錄是哪一筆資料（見 `src/domain/notification/link.ts`，只能連到列表），也沒有防重複的鍵。要做到「直達單筆」和「重試不重複」，建議新增可空欄位 `targetType`、`targetId`，以及 `eventKey String? @unique`。連結由 server 依 target 推導，點擊時一樣檢查權限。`eventKey` 的粒度是「邀請 ID＋`transitionSeq`＋收件人」。`transitionSeq` 存在邀請上，**每一次成功的寫入**（存檔、送出、確認、婉拒、撤回、開放，包含 pending 中老師不變、狀態也不變的內容修改）都在同一個 transaction 內 +1，並由該次寫入的結果回傳；發通知時用這個值組 key。所以同一次轉換的重試沿用同一個 key、不會重複，而「送出 → 婉拒 → 不修改直接重送 → 再次婉拒」每一步都是新的 `transitionSeq`，各自都會發通知。不能用 `version` 組 key，因為不修改直接重送時 version 不變。驗收要涵蓋上述四步流程，以及「首次邀請 → 同一位老師、修改時間 → 再修改地點」三步（各自發出正確通知），並證明每一步的重試都不重複。
- **以上兩項都是 notification schema 變更，產品主人 2026-10-05 確認方案 A，票 12 已落地。** `targetType` 實作為白名單 enum（四種單筆頁），eventKey 格式 `class-proposal:<邀請 id>:<transitionSeq>:<收件人>`；收件人規則在 `src/domain/organizer-class-proposal/notifications.ts`。團主直接開團的 `class_session_created` 也帶老師端課程 target 與同格式 eventKey。不加已讀欄位、不接 Resend。
- 已知取捨：已確認的邀請由團主修改但不換老師時，邀請回到草稿、確認失效，這一刻不另發通知；團主重新送出時老師會收到新的邀請（spec 13.3 的轉換不變）。

### 13.8 登入返回、匿名隱私與表單

- 分流 intent 只接受 `find_teacher`、`direct_class` 兩個值。`callbackUrl` 與 `returnTo` 一律經過與既有 `sanitizeCallbackUrl` 同類的檢查：必須以 `/` 開頭，不能是 `//` 或外站，而且只接受團主流程、課程詳情與老師邀請頁等允許的路徑前綴。
- **匿名開啟非公開課程（票 13）**：凡是公開規則讀不到的 `/classes/[id]`（不存在、草稿、僅透過連結招募、已取消、老師不是 approved），都回應同一個通用登入引導頁，HTTP 狀態、內容與 metadata 完全相同，不出現標題、老師或地點。登入後依既有的 Member 規則讀取，無效就 not-found。這會改變原本「匿名一律 not-found」的行為（票 13 已落地，2026-10-05，route-map 與 permissions 已同步）。
- 草稿：第一次存檔成功後，網址改成含 ID 的 edit 頁。「存草稿」與「送出」是兩個不同的動作。「儲存並補資料」要先存檔成功才離開，並帶上穩定的 ID 與允許的 `returnTo`；失敗就留在原頁、保留輸入。未存檔就離開時，要同時處理站內連結切換與瀏覽器 unload。不做持續的自動雲端存檔。

### 13.9 測試資料驗證與風險

| 風險 | 驗證方式（只在測試或本機開發 DB） |
| --- | --- |
| 回填挑錯 owner | fixtures 建三種團體（只有一位團主、沒有團主、兩位團主互相矛盾）：前兩種回填正確，第三種讓 migration 失敗且沒有部分變更 |
| 歷史 FK 遺失 | migration 前後比對團體、需求、課程的筆數與 `organizationId` 對應 |
| 越權 | 他人的團體、邀請、課程 ID 一律回 not-found；client 傳入的 owner 被忽略 |
| double-book | 兩位團主同時讓同一位老師確認重疊時段，只有一筆成功；確認與既有建課同時進行，也不會重複排課 |
| 舊版本被接受 | 老師開著舊頁面時團主修改了內容，老師按確認會得到 `proposal_version_stale` |
| 開放重試 | 連按兩次開放只產生一堂課；中途失敗時邀請仍是 confirmed，沒有半成品課程 |
| 匿名洩漏 | 不存在、草稿、私有三種 ID 的匿名回應內容完全相同 |

Migration 一律不碰 production，不 `db push`，不 `migrate reset`。實際對哪個資料庫執行，依 `docs/harness/risk-based-workflow.md` 第 11 節，在該票執行前記錄目標。

### 13.10 票號對照

- 01：本節與正式文件同步（docs-only）。
- 02：13.1 的 expand、backfill 與相容讀寫。
- 03／04：團體 service 與 bootstrap；需求選團體與草稿返回（13.4、13.8）。
- 05–08：邀請 schema、送出、確認／婉拒、修改／撤回、本人授課（13.2–13.5）。
- 09：`organizer_direct`、原子開放、CHECK 約束與老師端 origin guard（13.5、13.6）。
- 10、13：入口 intent、callback 與匿名登入引導（13.8）。
- 12：通知 schema（13.7，需先取得確認）。
- 15：legacy pointer 的 contract migration（需另外確認破壞性操作）。

<!-- codex-peer-reviewed: 2026-10-04T00:19:52Z rounds=4 verdict=approved -->
