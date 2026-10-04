# Organizer Usability Redesign Implementation Plan

日期：2026-10-03。狀態：**Q1–Q19 與 15 張切票已核准。01 docs contract 已完成（2026-10-04，見 spec 第 13 節）；程式票依相依分批進行中。**

規格：[Organizer Usability Redesign Spec](../../specs/organizer-usability-redesign-spec.md)。[訪談決策](../../organizer-usability-plan.md)與[名詞表](../../context/glossary.md)保留產品主人已確認內容。

已核准的可執行拆分：[15 張票券與前置關係](organizer-usability-redesign/ticket-breakdown.md)。下方批次為功能分組，實際 Builder 每次只做一張可驗收票，不將整批當成一輪巨大修改。多堂安排記在 [backlog 第 18 項](../../backlog.md#18-團主一次安排多堂課2026-10-03)，建議在單堂完整流程驗收後另做系列規劃。

## 1. Repo-aware Triage

- 使用者目標：團主註冊、建團、開團與全站連動順暢，資訊容易找到、下一步一目了然。
- 本輪模式：docs-only ticket preparation，已完成切票確認與建立；下一步等級 L3 docs Builder。程式票依各票分級，13 張 HEAVY、2 張 STANDARD，不以整個 feature 取代逐票風險判斷。
- Risk flags：PRISMA_RISK、MIGRATION_RISK、PERMISSION_RISK、STATE_MACHINE_RISK、AUTH_RISK（callback 與登入引導）、BRAND_RISK、LOW_PRESSURE_UX_RISK、LARGE_REFACTOR_RISK。
- 已讀：AGENTS、團主兩份歷史計畫、glossary、signed-in-navigation、data-model、state-machines、permissions-matrix、route-map、class-session-and-enrollment spec、相關 domain／UI／tests、harness templates。
- 目前 branch：main；本地 tracking 顯示 origin/main，未執行 fetch，不能聲稱已驗證遠端最新狀態。
- Working tree 有其他管理員、老師、學員工作中的 docs、source、tests。保留所有他人變更，規劃與修改只針對團主範圍；本計畫不授權混入其他工作或替其 commit。
- 尚未驗證：真實 UI／手機、migration 真實資料回填、TypeScript／ESLint／build／E2E。source 查證僅是目前行為的證據。
- Can auto-enter Builder：本次 to-tickets 不自動開始程式；產品主人已核准 Q18：A、Q19：A 與 15 張切法，可在要求執行後進 01 docs-only Builder。已核准內容不重複索取相同批准；各票未涵蓋的 migration 細節／新決策仍須 Human Gate。

## 2. 現有 Contract 與不得破壞的邊界

既有 organizer_matched 從自己的 matched demand 與 selected response 建課；teacher_initiated 不帶 demand／organizer／organization。角色為同 User 的 capabilities。Member 報名仍用基本能力，不以團主或老師權限代報。

既有課程 draft 占時段；新增未確認邀請不占，但 confirmed proposal 要與所有課程來源共用排課鎖。既有取消／名額／報名／完成／老師 recurring 流程保留。新增 direct 不可破壞三種 origin 的清楚不變量。

不更換 Auth provider、不重設資料庫、不處理 production data、不讀或改 env、不新增付款，不 commit／push／deploy。需要這些變更時停止並說明，不將其視為本規格附帶授權。

## 3. 分批順序與完成條件

每批使用 spec → plan → build → test → self review → review → local delivery。每批提供可檢查的結果，尚未具備服務支持的 CTA 不提前曝光。計畫中的 ship 為本地交付與驗收，commit、push、正式部署另需明確要求。

### 批次 0：正式 Contract 文件與 Migration 設計

Q18／Q19 已確認；01 將核准方案同步到 `docs/domain/data-model.md`、`permissions-matrix.md`、`permissions.md`、`state-machines.md`、`state-transition-details.md`、`docs/product/route-map.md` 與 `form-field-spec.md`。更新 historical 計畫連結與已核准範圍，不宣稱尚未完成的功能已出貨。

補足 migration expand／backfill／contract 順序、FK delete 行為、Prisma relation names、proposal schema 與三種 origin 不變量、DTO／service contract。新 routes 與 teacher／admin 的窄 integration 列清楚。涉及共享文件要先讀最新 diff，再作區域性增補。

完成條件：每個新動作的 actor、scope、guard、來源、不變量、排課資源與 side effect 可追溯；方案 A 是已核准決策，方案 B 只保留為歷史選項。

### 批次 1：多團體基礎與資料安全

Additive owner migration、明確 relation name、回填一致性檢查、own-scoped organization service、一次性 bootstrap transaction、新團體表單與列表、profile 分工。先保留 legacy pointer 做相容 default，授權改以 owner 關聯判斷。

Demand input 支援明確選 organization；只允許 own draft 改團體，已送出需求維持原歸屬。同步 organizer DTO、現有 admin owner 顯示的窄查詢與 fixtures／清理順序，與當前後台工作協調後再動共享檔。

驗證：兩個團體可各自提出需求；他人 ID 被拒；舊單一團體流與歷史 demand／class FK 保留；migration ambiguous owner fail／report，不能挑第一人。資料回填測試使用測試資料，不寫 production。

### 批次 2：合作邀請、本人授課與排課核心

Proposal schema／version、draft／submit／confirm／decline／withdraw／edit、受邀老師 own-read、最小 approved teacher 名片 lookup。先完整驗證 domain，再 expose UI。

共用 conflict tool 相容擴充：保留舊 positional arguments 與 test hooks，加入 confirmed proposal query 與只排除自身 proposal 的參數。所有 confirm、confirmed edit、withdraw、convert 與既有建課採一致 TeacherProfile 先鎖順序；讀 proposal 候選 teacher ID 後，鎖內再驗 version／teacher ID，避免改老師時的競態。課程／邀請若涉及兩位老師，規格固定鎖排序並驗證並發，不由各 core 隨意取得。

驗證：待確認不占時段；confirmed 阻擋既有老師／團主建課與另筆 proposal；舊頁面不能接受新版本；撤回／修改釋放；本人授課仍符合 approved／future／conflict guards。拒絕原因有有界驗證，不自動發 email。

### 批次 3：原子直接開團與來源相容性

新增 organizer_direct origin、唯一 proposal→ClassSession 關聯、原子開放與 idempotency。不能在交易外分兩次建立／開放。確認→轉換在同一 teacher lock 下移交排課資源；轉換失敗保留原 confirmed proposal，不提前釋放。

同步 public、teacher、organizer、admin origin labels 與窄 DTO。老師 open／cancel／complete server guards 清楚限制來源；老師接受團主邀請不因此得到團主管理權。

驗證：兩次開放回同一課程；rollback 不留下半成品；三種來源顯示與角色權限正確；existing matched／teacher series／enrollment／取消回歸。

### 批次 4：兩種入口與單頁表單

`/organizers/request`、總覽、列表首屏入口、首次 signup intent、profile／organizations 分工、兩張情境卡與三區表單。單筆草稿 URL、儲存並補資料、safe return、validation 不清空、unload／internal navigation 保護。

缺項能定位、已儲存團體摘要直接帶入、老師名片可辨識、本人授課明確確認。送出後到單筆詳情，不留鎖住的新表單或回列表。

驗證：訪客／已登入未建資料／已有團主／老師兼團主四種狀態；callback／intent 原目的地；儲存失敗不跳頁、返回同筆不增草稿；公開 header 與 role shell 行為維持已核准 navigation。

### 批次 5：待辦、通知、報名分享與手機驗收

實際 response count 推導待選老師，Proposal 另有雙端列表／DTO；總覽、列表、詳情共用下一步文字，等待與待我處理分開。站內通知直達單筆；本人授課不產生重複自邀請通知。

報名連結完整 URL 可 copy／open；非公開匿名入口提供不洩漏存在性的登入引導並保留 callback。已登入能用既有 Member 路徑查看與報名；不增加公司資格驗證。需求轉課預填可確定的欄位，不猜偏好時段或整期安排。

完成手機／桌機 manual smoke、鍵盤與 aria-live、brand consistency、角色／state review。最後一輪回歸只在新增修改／失敗／未解風險需要時擴大，不無限重跑。

## 4. Checks 與 Evidence

- 本輪文件：`git diff --check`、新文件 read-back、Markdown 相對連結存在、accepted／proposed 標示一致。
- 程式批次：`npx tsc --noEmit`、`npm run lint`、`npm run build`。變更的 domain 邏輯與 concurrency 使用目前可用 test harness；repo 沒有 Vitest script，不能宣稱已跑 unit tests，也不為本任務任意新增 package。
- Playwright 使用測試 DB、獨立預覽 port、repo 的 workers=1，涵蓋桌機與手機；避免誤連其他工作中的 dev server。需要獨立 build 與 fixture 支持時先做，完整 suite 只在 shared 變更／來源兼容風險需要時跑。
- UI：390px、1280px 完成關鍵旅程；320px 溢出與 sticky 遮擋檢查。保存必要 screenshots／test output 路徑，不將 screenshot 猜測當成通過。
- Migration：檢查保留 ID／FK、ownership ambiguities、fixtures owner 與 cleanup 次序、雙寫過渡；不對 production 執行 migration。
- Self review：列本輪檔案、V1／排除功能、role／permission／state／model／routes、security／RWD／brand、未取得決策、他人變更與 no commit／push。

## 5. 第一個 Builder Prompt（Q18／Q19 已核准，僅 01／批次 0）

```text
請依 docs/harness/ai-runs-current-templates/03-approved-builder-prompt.md 執行 docs Builder。
核准依據：產品主人已回答 Q18：A、Q19：A，並確認「同意這份切票，建立一票一檔」；不得重問相同產品方向。
任務：只執行 docs/superpowers/plans/organizer-usability-redesign/tickets/01-approved-domain-contracts.md，完成 docs/specs/organizer-usability-redesign-spec.md 的批次 0，將已核准 owner、OrganizerClassProposal、organizer_direct、邀請／排課轉換、角色權限與 routes 同步正式文件，產出可審查的 migration／service contract；仍不修改程式或 schema，不自動開始下一票。
Allowed files：docs/domain/data-model.md、docs/domain/permissions.md、docs/domain/permissions-matrix.md、docs/domain/state-machines.md、docs/domain/state-transition-details.md、docs/product/route-map.md、docs/product/form-field-spec.md、docs/specs/organizer-usability-redesign-spec.md、docs/organizer-usability-plan.md、docs/organizer-flow-redesign-plan.md、docs/context/glossary.md、docs/superpowers/plans/2026-10-03-organizer-usability-redesign-plan.md、docs/superpowers/plans/organizer-usability-redesign/ticket-breakdown.md、docs/superpowers/plans/organizer-usability-redesign/tickets/01-approved-domain-contracts.md（僅進度／驗收 evidence）。
Forbidden areas：所有 source、prisma、tests、package、env、Auth config、他人 admin／teacher／member 規格；共享文件只修改本任務相關段落並保留所有既有 diff。
Completion criteria：actor／own scope／守衛／來源不變量／invite states／時段占用／migration 回填與相容順序／routes／通知收件人均可追溯；沒有把未實作功能寫成已出貨。
Checks：git diff --check、文件 read-back、相對連結存在、data／permission／state／route 一致性；docs-only 不跑 build 或 E2E，須說明原因。
Stop conditions：超出 allowed files；需更改已核准產品選擇；發現多 owner 回填未決；共享文件存在無法安全保留的重疊變更；需要新增付款、production mutation、commit／push／deploy。
Output Report Requirement:
完成後請不要 commit / push，並回報：
1. Changed files
2. Full git diff
3. Checks result
4. Manual smoke result
5. Self review
6. Scope drift check：是否有任何超出本任務範圍的修改或判斷
7. Recommended Next Step，含 Common Handoff Schema、下一批 allowed files／checks 與目前或新 task 建議。
```

## 6. 決策狀態與 Self Review

- Q18：A 已核准，採獨立 proposal 與 owner／direct origin；B 未採用。
- Q19：A 已核准，完整 spec、單堂先行、既有團主報名規則、團體不刪除、目前聯絡資料引用語意、過期只作 guard 等細則已達成共同理解；15 張票券與前置關係也已核准。
- 多堂課需求已列 backlog；系列確認／報名／部分衝突／取消等仍待後續決策，未加入本輪實作。
- 本輪新增 spec／plan 與 15 張票券／拆分入口、更新團主決策紀錄／必要名詞與 backlog。未改 domain 現況文件、schema 或程式；未新增 V1 排除功能，也未實作任何模型／permission／state mutation。
- Security review 已在規格列出必要 own／origin／approved／version／callback 邊界；並未完成 runtime security、brand／RWD 或 E2E 驗證。
- 既有其他角色工作均保留；本輪無 commit／push。完整 git diff 含他人工作，後續 packet 必須附本任務差異與 baseline 說明，不能把他人變更當成本任務結果。

## 7. Recommended Next Step — Common Handoff Schema

- Level：L3。
- Recommended next work mode：HEAVY docs Builder，只執行 01。
- Next smallest actionable slice：同步已核准正式 contract 與 migration／service 設計，不修改 schema／source。
- Why this should be next：共同理解與切票均已核准，正式文件是各程式票的依據。
- Can Codex execute directly：yes，01 的核准 docs-only 範圍；本次建立票券不自動開始程式。
- Suggested execution location：current task；既有對話脈絡完整，不需新 task。
- Requires product owner decision：no，相同產品方向已核准；未涵蓋細節與 commit／push 仍是獨立 gate。
- Suggested next prompt：第 5 節完整 01 docs Builder prompt。
- Auto-continue allowed：本次 to-tickets no further Builder；若要求執行 01，只允許該票的文件範圍。
- Auto-continue reason：切票完成不等於自動執行所有 HEAVY mutation，已核准 Q1–Q19 不重複詢問。
- Stop condition triggered：no，票券已建立；未涵蓋決策或超出 01 範圍才停止。
- Notify human：yes。
- Notification reason：回報票券交付與單堂先行／多堂 backlog，說明 code 尚未實作。
- Approval noise reduction applied：yes，Q1–Q19 與切法已核准，後續不重問相同決策。
- Approval boundary note：本輪 docs-only 切票已完成；01 可按核准內容執行，其他票依範圍與 Human Gate，不授權 production migration、commit、push 或 deploy。
