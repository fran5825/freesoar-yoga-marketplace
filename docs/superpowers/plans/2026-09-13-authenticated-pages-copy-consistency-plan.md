# 登入後頁面：中文用詞一致性整理計畫

## 0. 這份計畫在做什麼、不做什麼

**做的事**：兩件事，缺一不可：
1. 把「登入後才看得到」的操作頁面裡殘留的英文標籤、內部開發用語（`TeacherProfile`、`marketplace`、`demand response capability` 這類），換成跟 `/teachers/join`、首頁一致的繁體中文用詞。
2. 把目前分散、重複、甚至已經彼此不一致的「controlled vocabulary 顯示對照表」（`serviceType`、`targetLevel`、`frequency`、enrollment 狀態）收斂成單一共用來源，讓每個畫面顯示的中文一致（詳見第 3 節）。

純文字與用詞層級的整理，**不改任何邏輯、不改資料結構、不改頁面走向、不改資料庫儲存的值**（`serviceType` 等欄位在資料庫裡繼續存英文代碼，只改顯示層）。

**不做的事**（明確排除，避免範圍蔓延）：
- **不做視覺改版**。這些頁面目前用的是預設 Tailwind 灰色系（`bg-gray-900`、`border-gray-200`、`rounded`），跟首頁／`/teachers/join` 那套品牌色票（`#345343`、`#8a5c49`、`rounded-full` 按鈕）不一樣。要不要把這 30 頁也套上品牌視覺，是下一輪要另外決定的事，這份計畫只處理文字。
- **不改任何 UX 流程或欄位**。這是文案整理，不是功能改動。
- **不動 `/dev/auth`、`/dev/admin`**——這兩頁本來就是 production 隱藏的開發驗證頁（見 `docs/engineering/auth-entry-strategy.md`），不是使用者會看到的畫面。
- **不翻譯 `src/domain/demand-request/service-types.ts` 裡 `SERVICE_TYPES` 常數本身**——檔案裡明確註記「PO 已確認之最終定案（非範例），須逐字採用」，這是資料庫儲存值與受控字典的識別碼，不是待清除的英文殘留。要改的是「顯示層怎麼把這個代碼轉成中文」，不是代碼本身。

## 1. 背景：為什麼會有 30 頁需要整理

2026-09-13 手動測試時發現 `/teacher/dashboard` 混雜英文標籤（Display name、Experience、Account…）。往下盤點後發現這不是單一頁面的疏忽：

- 全站 36 個 `page.tsx` 裡，只有首頁、`/about`、`/faq`、`/organizers/request`、`/teachers/join` 這 5 個套用了品牌色票與完整中文文案。
- 其餘 **30 個頁面**用的是預設 Tailwind 灰色系樣式，其中至少 7 個（`/account`、`/teacher/dashboard`、`/organizer/dashboard`、`/member/dashboard`、`/member/enrollments`、`/admin/demands`、`/sign-in`）有明顯英文標籤混雜使用者畫面。

根本原因：這些頁面最初是為了驗證功能（登入邏輯、資料流、權限判斷）而寫的最小可用版本，8 月初的品牌視覺改版只涵蓋了行銷向的公開頁面，沒有往下處理這些「登入後才看得到」的操作頁。`/teachers/join` 今天修的問題，是同一類落差裡最先被踩到的一個角落。

## 2. 共用詞彙表（施工時直接採用，不要每頁各自重新翻譯）

已經在 `src/app/teachers/join/_lib/application-fields.ts`（欄位）與今天改完的 `/teacher/dashboard`（狀態）裡定案的用詞，後續頁面一律沿用，不要另創同義詞：

| 英文 / 內部代稱 | 統一中文用詞 |
|---|---|
| Display name | 公開顯示名稱 |
| Experience / experienceYears | 教學年資 |
| Specialties | 擅長類型 |
| Service areas | 可服務區域 |
| Teaching formats | 授課形式 |
| Certifications | 證照或訓練背景 |
| Price range | 參考收費區間 |
| Profile photo URL | 老師照片連結 |
| Bio | 老師簡介 |
| Teaching style | 教學風格 |
| Account（頁尾/導覽連結） | 我的帳戶 |
| Signed in | 已登入 |
| Sign in / Sign out | 登入 / 登出 |
| Draft（TeacherProfile 狀態徽章，短標籤） | 草稿 |
| Submitted（TeacherProfile 狀態徽章，短標籤） | 已送出 |
| Submitted（DemandRequest 狀態，沿用 `organizer/demands/_components/status-labels.ts` 既有文案） | 已送出審核 |
| Rejected（TeacherProfile 狀態徽章） | 已退回 |
| Approved（TeacherProfile 狀態徽章） | 已核准 |
| Suspended（TeacherProfile 狀態徽章） | 已暫停 |
| No profile / 尚未建立 | 尚未申請 |
| TeacherProfile（內部代稱，不該外顯） | 老師申請資料 |
| marketplace（內部代稱） | 平台 |
| Admin review | 平台審核 |
| demand request / demand response | 團課需求 / 回應團課需求 |
| Last updated | 最後更新 |

**選字規則**：「Submitted」這類詞在不同 domain（TeacherProfile 狀態徽章 vs. DemandRequest 狀態）已經有不同、各自established 的既有中文——徽章類短標籤（`draft`/`submitted`/`rejected`/`approved`/`suspended`）一律用上表左欄標的短版本；描述句子裡沿用該 domain 既有的完整說法（例如 DemandRequest 的「已送出審核」，不要因為這份表而改短）。「Account」只有一個用詞，不留第二種說法。「TeacherProfile」對外只用「老師申請資料」這一種說法，不要在不同頁面切換用詞。

如果施工時遇到這份表沒收錄、但同一個概念在別的已完成頁面（`/teachers/join`、`/teacher/dashboard`）或既有共用模組（見第 3 節）已經有用詞，以那個既有用詞為準，不要另外發明。

## 3. Controlled vocabulary 顯示對照表：先收斂，再套用

盤點發現這不只是「漏翻譯」，是既有 label map 本身就重複維護、已經彼此不一致：

- `serviceTypeLabels`（`Hatha Yoga` → `哈達瑜伽` 等 7 項）目前**只存在於** `src/app/organizer/demands/_components/DemandRequestForm.tsx`。但 `serviceType` 這個欄位直接（未經翻譯）被 render 在至少 8 個其他檔案，包含公開頁面 `src/app/classes/page.tsx`、`src/app/classes/[classSessionId]/page.tsx`——訪客現在看到的課程篩選與詳情頁，顯示的是英文瑜伽風格名稱，不是中文。
- `targetLevelLabels`、`frequencyLabels` 分別在 `DemandRequestForm.tsx` 與 `src/app/admin/demands/page.tsx` **各自獨立宣告了一份**——已經是「同一份資料，兩處維護」的狀態。
- `enrollmentStatusLabels` 在 `src/app/admin/classes/[classSessionId]/page.tsx`、`src/app/member/dashboard/page.tsx`、`src/app/member/enrollments/page.tsx` **各自獨立宣告了三份**，而且已經產生真實落差：admin 那份有 5 個 key（含 `attended`／`no_show`），member 那兩份只有 3 個 key。

相對地，`classSessionStatusLabels`（`src/app/organizer/classes/_components/status-labels.ts`）與 `demandRequestStatusLabels`（`src/app/organizer/demands/_components/status-labels.ts`）已經是正確的「單一共用模組，各頁 import」模式（`teacher-initiated-open-classes` 的「unified list badges」那輪做的）——這份計畫要做的是把 `serviceType`／`targetLevel`／`frequency`／enrollment 狀態也整理成同一種模式，不是發明新做法。

**這一節必須在第 4 節逐頁施工「之前」先完成**，否則逐頁翻譯時會各自再發明一次映射，或漏掉沒套用的頁面。

### 3.1 建立共用模組

- 新增 `src/domain/demand-request/service-type-labels.ts`，從 `DemandRequestForm.tsx` 搬出 `serviceTypeLabels`、`targetLevelLabels`、`frequencyLabels`（內容照搬，不改翻譯），三者都 `export`。`DemandRequestForm.tsx` 改成從這裡 import，刪掉自己原本的宣告。
- 新增 `src/app/member/enrollments/_components/status-labels.ts`（比照 `organizer/classes/_components/status-labels.ts` 的既有寫法），定義單一、完整的 `enrollmentStatusLabels`——以 admin 那份 5 個 key（`pending`／`confirmed`／`cancelled`／`attended`／`no_show`）為準，因為那是目前唯一涵蓋完整 `EnrollmentStatus` 列舉的版本；沒有 tone class 需求的話可以只匯出 labels。

**型別要求（不是選配）**：這四份 label map 一律宣告成 `Record<ServiceType, string>`、`Record<TargetLevel, string>`、`Record<Frequency, string>`（`ServiceType`／`TargetLevel`／`Frequency` 都已經從 `src/domain/demand-request/service-types.ts` export）、`Record<EnrollmentStatus, string>`（`EnrollmentStatus` 從 `@prisma/client` export）——比照 `src/app/organizer/classes/_components/status-labels.ts` 裡 `classSessionStatusLabels: Record<ClassSessionStatus, string>` 的既有寫法，**不要**沿用現有 `Record<string, string>` 的寫法。這樣以後受控清單增加新值時，TypeScript 會直接在編譯期報缺漏的 key，不用等到畫面漏翻譯才被人發現。

**Fallback 規則**：現有消費端普遍寫 `labels[value] ?? value`——查無對應時直接顯示原始英文代碼，等於讓這次整理白做。改成 exhaustive typed Record 之後，只要 `value` 型別是 `ServiceType`／`TargetLevel`／`Frequency`／`EnrollmentStatus`，`labels[value]` 本身就一定有值，不需要 `?? value` 這個 fallback；如果消費端拿到的是未經型別收斂的 `string`（例如來自 `searchParams` 或使用者輸入），才需要一個安全 fallback，且**不能**是原始代碼本身，應顯示一個中性字樣（例如「未分類」），並在該處加註解說明為什麼會走到這個分支。

### 3.2 套用到所有既有消費者

以下檔案裡任何直接 render `serviceType`／`targetLevel`／`frequency`／enrollment 狀態原始值（英文或代碼）的地方，改成透過 3.1 的共用模組轉換；`admin/demands/page.tsx` 裡重複宣告的 `targetLevelLabels`／`frequencyLabels`、以及三處重複宣告的 `enrollmentStatusLabels`，直接刪除改 import：

- `src/app/admin/classes/[classSessionId]/page.tsx`
- `src/app/admin/demands/page.tsx`
- `src/app/classes/page.tsx`
- `src/app/classes/[classSessionId]/page.tsx`
- `src/app/organizer/classes/[classSessionId]/page.tsx`
- `src/app/organizer/demands/[demandRequestId]/page.tsx`
- `src/app/teacher/classes/new/_components/ClassSessionCreateForm.tsx`
- `src/app/teacher/classes/page.tsx`
- `src/app/teacher/classes/series/[recurringClassSeriesId]/page.tsx`
- `src/app/teacher/demands/[demandRequestId]/page.tsx`
- `src/app/teacher/demands/page.tsx`
- `src/app/member/dashboard/page.tsx`
- `src/app/member/enrollments/page.tsx`

施工時先用 `grep -rn "serviceType\b\|targetLevel\b\|\.frequency\b" src/app --include="*.tsx"` 重新列一次當下的實際清單為準——上面這份是盤點當下的結果，程式碼可能在動手時已經有變動。

### 3.3 這一節的驗收

**靜態 `rg` 搜尋在這裡沒有用，不要拿來當驗收依據**：英文字樣（`Hatha Yoga` 等）的字面定義只存在 `src/domain/demand-request/service-types.ts`，消費端頁面寫的是 `{classSession.serviceType}` 這種變數插值，原始碼裡本來就搜不到 `"Hatha Yoga"` 這串文字——就算完全沒套用共用 label map，`rg -n "Hatha Yoga" src/app` 也會是零命中，看起來像通過，實際上什麼都沒驗到。

正確做法：對第 3.2 節列出的每一個消費端頁面，各建一筆帶有 `serviceType: "Hatha Yoga"`（或至少一個已知會撞到 fallback 的邊界值）的測試資料，**用 Playwright 開實際頁面（不是對 HTTP 回應做原始字串比對），斷言可見文字／accessible name 顯示「哈達瑜伽」**（`targetLevel`／`frequency`／enrollment 狀態同理，各挑一個代表值）。

**不要對原始 HTML 回應字串做「不得出現 `Hatha Yoga`」這種全域負向比對**：`<select>` 表單（例如 `/teacher/classes/new`、`/organizer/demands/new`）正確的實作本來就需要保留 `<option value="Hatha Yoga">哈達瑜伽</option>`——`value` 屬性必須是英文代碼（那是送出表單時實際提交的值，不能改），只有 option 的可見文字要翻成中文。對整份原始 HTML 做英文負向比對，會把這種正確實作誤判成失敗，也可能命中 CSS class 名稱或 Next.js 序列化資料。用 Playwright 的 `page.getByText(...)`／`locator.textContent()`／`getByRole("option", { name: "..." })` 這類只看渲染後可見內容的 API，才不會誤判。如果該頁面已經有涵蓋這條路徑的 smoke test，就直接在那支測試裡新增這個中文顯示斷言，不要另外重複寫；如果既有測試目前完全沒有斷言過這個欄位的顯示文字，先補上這個斷言，不能只靠「既有測試還是綠的」當作證據——既有測試大多沒斷言過這些欄位的顯示文字，綠燈不代表對。

## 4. 待整理頁面清單（依手動測試地圖的角色順序排列）

已完成：
- [x] `src/app/teachers/join/` 全部（2026-09-13，teacher-join-gated-application）
- [x] `src/app/teacher/dashboard/page.tsx`（2026-09-13）

共用（優先，因為每個角色都會一直用到）：
- [ ] `src/app/account/page.tsx`
- [ ] `src/app/sign-in/page.tsx`
- [ ] `src/app/notifications/page.tsx`

老師角色（對應手動測試地圖 Phase 3–5、9）：
- [ ] `src/app/teacher/profile/page.tsx`
- [ ] `src/app/teacher/availability/page.tsx`
- [ ] `src/app/teacher/classes/page.tsx`
- [ ] `src/app/teacher/classes/new/page.tsx`
- [ ] `src/app/teacher/classes/series/[recurringClassSeriesId]/page.tsx`
- [ ] `src/app/teacher/demands/page.tsx`
- [ ] `src/app/teacher/demands/[demandRequestId]/page.tsx`

團主角色（對應 Phase 6）：
- [ ] `src/app/organizer/profile/page.tsx`
- [ ] `src/app/organizer/dashboard/page.tsx`
- [ ] `src/app/organizer/demands/page.tsx`
- [ ] `src/app/organizer/demands/new/page.tsx`
- [ ] `src/app/organizer/demands/[demandRequestId]/page.tsx`
- [ ] `src/app/organizer/demands/[demandRequestId]/edit/page.tsx`
- [ ] `src/app/organizer/classes/page.tsx`
- [ ] `src/app/organizer/classes/[classSessionId]/page.tsx`

會員與公開瀏覽（對應 Phase 7–8、10）：
- [ ] `src/app/classes/page.tsx`
- [ ] `src/app/classes/[classSessionId]/page.tsx`
- [ ] `src/app/member/dashboard/page.tsx`
- [ ] `src/app/member/enrollments/page.tsx`

Admin（對應 Phase 13）：
- [ ] `src/app/admin/dashboard/page.tsx`
- [ ] `src/app/admin/teachers/page.tsx`
- [ ] `src/app/admin/demands/page.tsx`
- [ ] `src/app/admin/classes/page.tsx`
- [ ] `src/app/admin/classes/[classSessionId]/page.tsx`
- [ ] `src/app/admin/organizations/page.tsx`

明確排除：
- `src/app/dev/auth/page.tsx`、`src/app/dev/admin/page.tsx`（production 隱藏，非使用者畫面）

## 5. 怎麼施工

**先完成第 3 節（controlled vocabulary 收斂），再開始這裡的逐頁工作**——不然逐頁翻譯時會踩到還沒套用共用模組的頁面，白工一次。

每頁流程比照今天 `/teacher/dashboard` 的做法：

1. 讀完整個 `page.tsx`（含它 import 的子元件），用 `grep -nE "[A-Za-z]{3,}"` 抓出所有英文字樣。
2. **對每一處命中分類**，不是看到英文就翻：
   - UI 標籤、內部開發用語殘留（`Display name`、`TeacherProfile` 這類）→ 對照第 2 節詞彙表直接替換。
   - `serviceType`／`targetLevel`／`frequency`／enrollment 狀態這類 controlled vocabulary 的原始值 → 確認這一頁是否已經在第 3.2 節套用共用 label map；如果還沒套用，先做，不要在這裡另外寫一次翻譯。
   - `<input>`／`<select>` 的 `value`、`name`、`id` 這類程式碼識別字 → 不動，那不是使用者看到的文字。
   - 遇到分類不確定的英文（不在第 2 節詞彙表，也不是第 3 節列出的 controlled vocabulary）→ 先去 `src/domain/` 對應的 service/type 定義確認這是不是資料庫儲存值或受控清單，不要憑頁面本身的上下文猜。
3. `npx tsc --noEmit` 與 `npm run lint` 確認沒有型別或語法問題。
4. **用實際渲染後的可見文字驗證，不只是靜態 grep，也不要對原始 HTML 字串做全域負向比對**：對該頁面的每一種主要狀態分支（例如老師頁的 draft／submitted／rejected／approved／suspended，或至少「有資料」與「無資料」兩種），建一個測試帳號（Prisma 直接建 `User`＋`Session`，比照 `tests/smoke/` 既有 smoke test 的建帳號手法），帶著 session cookie 打開頁面。檢查有沒有殘留英文使用者可見文字時，只能檢查渲染後的可見文字或 accessible name（例如 Playwright 的 `getByText`／`textContent()`／`getByRole`），不能對整份 HTTP 回應字串做「不得出現某個英文字」這種比對——`value`／`class`／`id` 這類屬性、Next.js 序列化資料本來就合法含有英文，全域字串比對會把正確實作誤判成失敗（第 3.3 節的 `<option value="Hatha Yoga">哈達瑜伽</option>` 就是典型例子）。這是一個可以重複執行的檢查手法，不是依賴某支特定腳本檔案；如果是用臨時腳本驗證，驗證完把腳本刪掉即可，不需要留在 repo 裡。
   - 如果該頁已有涵蓋這個狀態的既有 smoke test，**只有在那支測試裡已經對這裡翻譯的文字有明確斷言時**才能取代上述 HTTP 檢查；既有測試「維持全綠」本身不是證據——多數既有測試從未斷言過這些欄位的顯示文字（第 3.3 節就是實例），沒有斷言就代表沒驗到，需要另外補上再跑。
   - 同時確認翻譯沒有動到任何既有測試斷言用的文字——很多既有測試用 `getByRole("button", { name: "..." })` 精準比對按鈕文字，翻譯時要同步檢查有沒有測試在對照舊文字，一併更新。
5. 每處理完一批（建議每次 3–5 頁），跑一次 `npm run test:smoke` 確認沒有連帶弄壞任何既有測試。

## 6. Definition of Done

- 第 3 節（controlled vocabulary 收斂）全部完成：四份共用 label map 都是 exhaustive typed `Record`（不是 `Record<string, string>`），沒有任何 `?? rawValue` 這種會外洩原始代碼的 fallback；3.3 節要求的「用真實資料跑一次、斷言中文顯示」對每個消費端都做過，不是只靠靜態 `rg`。
- 第 4 節清單裡所有勾選項目完成，且 `rg -n "[A-Za-z]{4,}" src/app/<對應路徑>` 人工複查後，剩下的都是程式碼識別字（含 controlled vocabulary 的原始值放在 `value`／`data-*` 這類非文字節點屬性裡），沒有使用者會看到的英文標籤、內部代稱，或未經共用 label map 轉換的英文顯示值。
- 全套 `npm run test:smoke` 通過。
- 第 2 節詞彙表如有新增詞條，反映在這份文件裡，供之後其他頁面沿用。

<!-- codex-peer-reviewed: 2026-09-13T08:23:46Z rounds=4 verdict=approved -->
