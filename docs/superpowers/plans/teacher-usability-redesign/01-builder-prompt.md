# 老師 usability 票 01 Builder Prompt

狀態：`candidate-awaiting-approval`。八票文件已獲產品主人核准，全部 draft；整體 shared understanding 與票 01 source 執行尚待確認。此版本取代原三排程＋詳情＋列表入口的大切片 prompt，建立文件不等於批准。

對齊 `docs/harness/ai-runs-current-templates/03-approved-builder-prompt.md`。規格：`docs/specs/teacher-usability-redesign-spec.md`；計畫：`docs/superpowers/plans/2026-10-03-teacher-usability-redesign-plan.md`；票券：`docs/superpowers/plans/teacher-usability-redesign/tickets/01-single-class-creation.md`。

## 可複製執行 prompt

```text
我確認 docs/specs/teacher-usability-redesign-spec.md 的 Q1–Q20 整體設計已達共同理解，並核准票 01 單堂開課的下列執行範圍。

請依 docs/harness/ai-runs-current-templates/03-approved-builder-prompt.md 執行 Builder。

Approved task：老師 usability 票 01：單堂開課的單頁三區、即時摘要、送出失敗保留輸入與未完成離頁提醒，成功建立完整 draft 並導向既有詳情。以票 01 驗收條件為結果約定。

Automation level：Approved Builder（本 prompt 被產品主人明確採用後）。Workflow mode STANDARD，risk medium，standard slice；本 prompt 的採用是本票 Human Gate，不自動批准 02–08、commit／push 或部署。

Accepted decisions：
- Q1–Q20 與八票拆分已確認，不重問。只用既有 domain service，不改建課資格、輸入規則、DB write behavior、Auth、schema、permissions、state transitions 或通知。
- 共用三區與模式標籤可改，單堂預設；本票只完成單堂摘要與失敗回傳。另外兩模式仍可走既有建立流程、保留原核對與提交，完整改版留票 02。
- 單堂詳情操作留 03；列表入口、分類及返回留 04；系列管理留 05；申請留 06；暫停入口留 07；完整驗收留 08。

Allowed source files：
- src/app/teacher/classes/new/page.tsx
- src/app/teacher/classes/new/_components/ClassSessionCreateForm.tsx
- src/app/teacher/classes/new/actions.ts（單堂 adapter；失敗結果與 UI 銜接）
- src/app/teacher/classes/new/_components/ClassCreateSummary.tsx（可新增；本票只單堂摘要）
- src/app/teacher/classes/new/_lib/form-state.ts（可新增局部型別／pure UI helper）
- src/app/teacher/classes/new/_lib/use-unsaved-changes.ts（可新增局部提醒）

Allowed tests：
- tests/smoke/teacher-class-detail-page.spec.ts（只單堂建課與成功導向的舊勾選步驟，不改詳情排列／操作）
- tests/smoke/teacher-initiated-open-classes.spec.ts（只單堂建課相關步驟，不改取消流程）
- tests/smoke/class-yoga-styles.spec.ts（只老師單堂案例，保留缺類型不建立的驗證）
- tests/smoke/teacher-recurring-class-series.spec.ts（只三模式可見標籤必要調整；保留兩種重複建立核對與預期）
- tests/smoke/teacher-class-usability.spec.ts（可新增單堂 outcome cases）
- tests/smoke/_helpers/teacher-class-form.ts（可新增老師專用 helper）

Allowed docs：
- docs/specs/teacher-usability-redesign-spec.md（只本票實作狀態）
- docs/teacher-usability-plan.md（本票狀態，保留歷史與他人修改）
- docs/superpowers/plans/2026-10-03-teacher-usability-redesign-plan.md
- docs/superpowers/plans/teacher-usability-redesign/01-builder-prompt.md（記錄採用／完成狀態）
- docs/superpowers/plans/teacher-usability-redesign/01-builder-review-packet.md（可新增，完整 Common Handoff Schema）
- docs/superpowers/plans/teacher-usability-redesign/tickets/README.md（只本票進度）
- docs/superpowers/plans/teacher-usability-redesign/tickets/01-single-class-creation.md（本票進度與驗收記錄）
- docs/specs/class-session-and-enrollment-spec.md（只單堂建課核對 UI 的現況）
- docs/domain/state-transition-details.md（只單堂 confirmCreate 的純 UX 說明改成摘要；重複模式仍用舊核對，不改轉換規則）

Forbidden files / areas：
- prisma/**、migration、.env*、Auth／session／role／capability／permission 實作、package.json、lockfiles、部署與 CI。
- src/domain/** 的 business policy、service、狀態機與 validation：可讀取及呼叫，不改資格、ownership、寫入、時間規則、通知或排程算法。
- src/app/teacher/classes/new/recurring-actions.ts、單堂／系列詳情、老師課程列表與其 mutations、TeacherShell、teachers/join/**。
- admin、organizer、member/public UI 與其測試；不修改團主 confirmCreate、真正報名 consent 或共用角色殼層／helper。
- 未明列檔案、其他 task 的 dirty changes；不還原、不覆寫、不順帶整理。先重讀共享文件，僅局部 patch。
- 課程編輯、系列公開／批次發布、付款／退款、AI、native App、Wellness／Academy／Retreat。

Implementation requirements / completion criteria：
1. 單頁「課程內容／時間地點／報名設定」三區，選填說明預設收合；三模式清楚可見、單堂預設，切換保留各模式輸入。
2. 既有必填、24 小時制、名額、衝突與上次地點／名額／需確認報名預設不變；公開可見性與需確認報名分成兩組，非公開不稱私密。
3. 單堂摘要以實際值顯示名稱、日期時間、地點、名額與報名設定，取代單堂泛用 confirmCreate，提醒建立後不能修改；不加建立確認視窗。重複模式仍能用既有核對建立，不移除其 checkbox 直到 02。
4. 單堂 action 失敗可回傳序列化 form result，沿用既有 domain service 與驗證；成功按原 id 進詳情。不得 catch 吞 Next.js redirect、改 domain 結果、重試不明成功或改資料寫入規則。
5. service 驗證／衝突失敗保留輸入，具體錯誤可修正，pending 防重送；未知提交結果不得自動重建或冒稱確定未寫入。
6. 初始預填不誤判 dirty，修改後離頁提醒，取消離開留原頁；成功建立解除提醒。無 localStorage／sessionStorage 自動草稿或離頁續填承諾。
7. 成功只建立完整 draft；不提前開放、不改 isPublic、不增編輯或學員草稿預覽。詳情沿用既有頁面即可驗收。
8. 沿用品牌 tokens／老師頁寬；375px／768px／1440px、長名稱與地址、錯誤／摘要不溢出；鍵盤、錯誤關聯與至少 44px 操作目標可使用。

Checks to run：
- git diff --check（包含本票新增檔案的 whitespace 檢查）。
- npx tsc --noEmit
- npm run lint
- npm run build
- 先確認 build 鎖及獨立測試 port 3100 可用；用 PowerShell 設 $env:PORT='3100' 執行 npx playwright test tests/smoke/teacher-class-detail-page.spec.ts tests/smoke/teacher-initiated-open-classes.spec.ts tests/smoke/teacher-recurring-class-series.spec.ts tests/smoke/class-yoga-styles.spec.ts tests/smoke/teacher-class-detail-read.spec.ts，以及新增的 teacher-class-usability.spec.ts。port 已占用則用另一未使用 port，不停止他人程序，最後還原原 PORT。
- 新增有意義 outcome tests：單堂 service 驗證或衝突拒絕保留輸入與摘要、修正後成功建立一堂、摘要符合提交值、離頁取消保留原值、成功導向不誤報未存；回歸兩種重複排程及原建課守門。
- 只用既有本機 smoke fixture，不連 production、不向真實使用者發布或通知。保留其他角色測試與其他 task 的資料／程序。
- 三種寬度做單堂填寫／錯誤／摘要／成功導向與鍵盤 QA，檢查切換重複模式仍可建立；提供可檢視證據，不宣稱未檢查項目通過。
- 無獨立 unit script／Vitest，不新增套件；必要 pure helper 邊界用現有 Playwright runner 驗證。

Stop conditions：
- 需要 allowed files 外變更，或同檔其他 task 變更無法安全局部整合。
- 必須改 Auth、Prisma、role／permissions、domain validation、state machine、DB write behavior、通知、公開政策或 production；另提 HEAVY decision plan。
- 只能用泛用 catch／自動重試才可保留輸入，可能重複建立；先提安全回傳方案。
- checks 修復會擴 scope；區分其他 task 的失敗並回報，不修其程式／測試。
- 需要新套件、migration、commit、push、deploy 或真實課程發布。

Output Report Requirement：
完成後不要 commit／push，以繁體中文回報：
1. Changed files（只本票實際修改）。
2. Full git diff／新增檔內容（共享檔案只歸因本票修改）。
3. Checks result（命令、pass／fail、未執行原因與外部限制）。
4. Manual smoke／RWD／鍵盤結果及畫面證據。
5. Self review：V1、non-goals、角色／權限／狀態／資料／route、安全／品牌／RWD、產品決策、無關檔案、未 commit／push。
6. Scope drift：action 只改呈現與失敗回傳，寫入 policy 未變；未完成 02–08，不把本票稱為全部完成。
7. 將 Builder Review Packet 存到允許檔案，提供完整 Common Handoff Schema；下一票先列完整可核准範圍與 checks，不自動跨票。
```

## Recommended Next Step（Common Handoff Schema）

- Level：L3。
- Recommended next work mode：Product Owner Decision → 核准後 STANDARD Builder。
- Next smallest actionable slice：票 01 單堂開課。
- Why this should be next：先完成一條可建立、失敗可修正的路徑，供重複模式沿用。
- Can Codex execute directly：本 prompt 被產品主人明確採用後可；目前是候選文件。
- Suggested execution location：current task 優先，new task 亦可完整複製 prompt。
- Requires product owner decision：確認整體 shared understanding 與本票執行範圍。
- Suggested next prompt：上方「可複製執行 prompt」全文。
- Auto-continue allowed：本輪已授權 docs 可；source 不可。
- Auto-continue reason：八票文件已核准，01 source 尚未核准。
- Stop condition triggered：個票 Builder 授權邊界。
- Notify human：是。
- Notification reason：請檢視單堂第一票的具體執行範圍。
- Approval noise reduction applied：是，不重問已確認的設計與拆分。
- Approval boundary note：採用本 prompt 只核准 01，不核准其他票、commit／push、部署或真實課程發布。
