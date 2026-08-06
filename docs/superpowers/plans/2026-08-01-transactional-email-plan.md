# Transactional Email with Resend — Draft Implementation Plan

> Status: DRAFT — 待 Codex peer review、產品主人 event/copy 決策與 Preview credential gate；未授權 Builder 施工或寄送真實郵件。
> Date: 2026-08-01

## 1. Outcome

在保留現有 `/notifications` 站內通知的前提下，為已接線的 V1 marketplace events 增加 Resend transactional email delivery，使外部 pilot 使用者不必持續回站查看才知道重要狀態變更。

這個 slice 不建立 cron/queue，也不實作 `class_reminder_basic`。它只處理「既有 business mutation 成功之後」的 event-driven email，並保證 email/Resend 失敗不會 rollback 或改寫 teacher application、demand、response、class session、enrollment 等主要結果。

## 2. Authority and Repo Reality

- `docs/product/PRD.md`、`docs/scope/v1-scope.md` 與 `docs/product/notification-spec.md` 將 basic email notification 列為 V1。
- 現況已有 `Notification` model，`NotificationChannel` 包含 `email`，`NotificationType` 包含 19 個值；預設不需要 Prisma migration。
- `src/domain/notification/create.ts` 的 `notifyUsers()` 目前硬編碼 `channel: "in_app"`；`NotificationSenderInput` 沒有 recipient email、channel、CTA 或 provider id。因此「只新增一個 Resend adapter」不足以完成需求，必須小幅重構 orchestration contract。
- `listOwnNotifications()` 只讀 `channel: "in_app"` 的 sent records；email row 不應造成站內列表重複。
- `.env.example` 已有 `RESEND_API_KEY`，但 `package.json` 尚未安裝 `resend`，也沒有 sender/from、base URL 或 delivery-mode 設定。
- 目前沒有 queue、cron、outbox、retry worker。Notification side effect 已刻意放在主要 transaction 成功之後並由 catch boundary 隔離；本 slice 必須維持這個 invariant。
- Resend 官方文件要求 API key 與已驗證 sending domain；Send Email API 可同時送 `html` 與 `text`，並支援 `Idempotency-Key`。Preview/provider smoke 應使用 Resend 的安全測試收件地址，而不是 `example.com`。
- Trigger 不全是 literal `notifyUsers()`：`class_session_cancelled`、`demand_request_cancelled`、`enrollment_confirmed`、`review_submitted`、`teacher_profile_suspended`、`teacher_profile_restored` 經各 core function 的 `notifyOverride: NotifyFn = notifyUsers` 間接接線。Audit 必須追 default-injected path，不能只用單一文字搜尋。
- 工作樹有其他未提交修改。Builder 只能處理本計畫 allowlist，不能清理、覆寫或提交其他變更。

## 3. Architectural Decisions

### E1 — Preserve both channels

每一個 recipient/event 在啟用 email 時產生兩筆獨立 `Notification` row：一筆 `in_app`、一筆 `email`。兩個 channel 各自從 `pending` 轉為 `sent` 或 `failed`，一個 channel/recipient 失敗不能阻止其他 channel/recipient。

### E2 — Server-only adapter and injected transport

- Resend client 只能存在 server/domain infrastructure，不得由 client component、browser API route 或未授權 public action直接呼叫。
- Production adapter 實作小型 `EmailTransport` interface；測試傳入 fake transport，不做真實網路請求。
- `notifyUsers()` 的 public contract 可保留 type/recipients/payload，內部改為 channel fan-out；測試 override 必須可以決定性地驗證 per-channel failure isolation。
- `EmailTransport.send()` 必須接受 deadline/AbortSignal 或自行保證 hard timeout。預設每次 provider request 最長 5 秒；timeout 必須終止底層 HTTP request（不只是 `Promise.race` 後讓 request 繼續執行），並正規化為 failed channel。Builder 必須先核對所選 Resend SDK pinned version 是否能傳遞 AbortSignal/custom fetch；若不能，改用 Resend 官方 HTTPS Send Email API + Node `fetch`/`AbortController`，並依官方要求帶 Authorization、Content-Type、User-Agent、Idempotency-Key，不為了形式強行使用 SDK。

### E3 — Explicit delivery mode

使用單一明確設定 `EMAIL_DELIVERY_MODE`：

- `disabled`：default，local/CI/private Preview 可安全執行；只建立站內通知，不建立假裝已寄送的 email row。
- `allowlist`：Preview verification；只有 `EMAIL_ALLOWED_RECIPIENTS` 內的 email 可真正寄送，其他 recipient email 不建 row、不呼叫 provider，並以 structured log 記錄 skipped count，不輸出完整地址。
- `live`：外部 pilot/production；必須同時具備 API key、verified sender 與正確 `APP_BASE_URL`。任何 mode-level config invalid（缺 key/from/base URL、invalid URL；`allowlist` mode 另含空或 invalid allowlist）一律 fail closed：該次 email fan-out 不解析 recipient email、不建立 email row、不呼叫 provider，只記錄一次不含 secret/完整地址的 structured config error；主要流程與 in-app channel 照常成功。

環境解析必須集中、server-only、可測試。禁止僅以「有 API key 就自動 live」判斷。

只有 mode 有效、所有必要 config 有效且 recipient 通過 policy 時，才視為「email channel enabled」並套用 E1 的雙 row contract。`disabled`、invalid config 與 allowlist non-match 都不建立 email row；三者必須有不同的 deterministic diagnostic/test expectation。

### E4 — Exhaustive email event/role policy

- 最終 M1 不是只留在文件表格；Builder 必須新增 `src/domain/notification/email-policy.ts`，輸出 exhaustive `Readonly<Record<NotificationType, readonly NotificationRecipientRole[]>>`（或等價的 compile-time exhaustive 結構）。每個 type 明列允許寄 email 的 recipient roles；空陣列代表 in-app only / enum-only。
- `notifyUsers()` 在 recipient first-role dedupe 後，以 `shouldSendEmail(type, recipient.role)` 強制 policy，再進 config/allowlist 判斷。不得在 trigger call sites 各自決定，也不得以「有 copy 就寄」推論 policy。
- Test 必須逐一斷言目前 19 個 `NotificationType` 的核准 roles 與排除 roles；Prisma 新增 enum 而 policy 未更新時，TypeScript 應 fail。M1/M2 的 final table、`email-policy.ts` 與 tests 必須三方完全一致。

### E5 — Minimal safe CTA

本 slice 的 email CTA 統一導向 `${APP_BASE_URL}/notifications`，登入後再依 own-scoped notification 查看內容。不要在 email 放 raw IDs、一次性 token 或猜測 entity-specific route。事件專屬 deep links 是後續 slice；若未來新增，必須重新做 permission review。

### E6 — No schema expansion by default

不為 provider message id、retry count 或 webhook 狀態新增 schema。V1 以既有 `email` row 的 `sent/failed/sentAt` 作最小 audit。若 implementation audit 證明 schema 變更不可避免，立即停止並取得產品主人確認。

### E7 — Bounded request latency

- Provider HTTP request 使用 `AbortController` hard deadline，預設 5,000 ms；可透過有上下限驗證的 `EMAIL_TRANSPORT_TIMEOUT_MS` 調整，建議允許 1,000–10,000 ms。
- Timeout 後 abort underlying request，email row 標 `failed`，繼續其他 recipient/channel，並且不得 throw 回 business mutation。
- V1 recipient 數量預期很小；email sends 採明確、低上限的 concurrency（建議 3）或循序處理。若 recipient fan-out 使 request latency 不可接受，停止外部 pilot 並另案規劃 outbox/worker，不能拿掉 timeout 或把 provider call 放入 transaction。

### E8 — Idempotency and duplicate boundary

- 對每次 provider send 使用可重現且不含 PII 的 idempotency key，建議 `notification-{Notification.id}`；Resend 的 key 有時效，因此它只防止短時間重送，不等於永久 domain dedupe。
- 既有 mutation 若被業務層重複執行，仍由原 domain state/permission gate 防止重複；本 slice 不新增跨事件 unique constraint。
- Email row 必須先建立，再以該 row id 呼叫 provider，成功才標 `sent`。

## 4. Scope

### In scope

- 優先使用官方 `resend` Node SDK；只有 pinned version 能把 AbortSignal/custom fetch 傳到底層 request 時才安裝。若無法保證 hard abort，改用 Resend 官方 HTTPS Send Email API 與 Node 原生 `fetch`，不新增 SDK dependency。
- 擴充 notification orchestration 以支援 `in_app` + `email` channel fan-out。
- 以 User id server-side 解析收件 email；不把 email 放進 domain payload 或 client。
- 建立純函式 email subject/body/html/text renderer，沿用既有 notification copy，加入品牌 header、清楚 CTA 與「此信由系統事件觸發」說明。
- 增加 `disabled|allowlist|live` config 與 `.env.example` 說明。
- 為已核准的 event matrix 接通 email，並新增 fake-transport tests、failure isolation tests、Preview manual provider smoke runbook。
- 更新 notification architecture/spec/current functional architecture 與 launch checklist。

### Explicitly out of scope

- `class_reminder_basic`、cron、queue、worker、outbox、automatic retry、scheduled email。
- Marketing/newsletter、audience list、unsubscribe workflow；本 slice 僅為使用者主動參與 marketplace flow 產生的 transactional messages。
- Resend inbound email、webhook、open/click tracking、bounce automation、hosted templates。
- LINE/SMS、Google Calendar sync、native app push。
- Payment/refund email、自動帳務、AI recommendation。
- Auth、role model、marketplace state-machine 或 Prisma schema 改動。
- 自動建立 Resend account、修改 DNS、取得 API key、deploy、寄送非 allowlist 真實收件人、commit、push。

## 5. Product Owner and Operations Gates

| Gate | Recommended default | Blocking point |
|---|---|---|
| M1 Event/role matrix | Email 所有已接線且對收件角色有行動/結果意義的 events；`review_submitted` 寄給實際授課 Teacher (`counterpart`)，不是 Admin；`class_reminder_basic` 另案 | Builder 開始前確認最終 type × role 表，並編碼於 exhaustive policy |
| M2 Admin fan-out | private Preview 僅 allowlisted admin；live 時寄給所有 active admins 的既有 resolver 結果 | 啟用 live 前確認 admin 收件政策 |
| M3 Sender identity | `Free Soar Yoga <notifications@已驗證網域>`，reply-to 僅在有人管理時設定 | Provider smoke 前需產品主人提供網域/地址 |
| M4 Email copy | 繁中、plain text + minimal HTML、CTA 到 `/notifications` | 外部 pilot 前逐類型核稿 |
| M5 Delivery rollout | private Preview=`allowlist`；外部 pilot 才可=`live` | 每次環境切換需人工 approval |
| M6 Failure policy | mark email row failed、structured error log、不中斷主流程、不自動 retry | Builder 可依此施工 |

若 M1 尚未核准，Builder 只能完成 adapter/config/test foundation，不得啟用任何 production event email。若 M3/M4/M5 未核准，不得做真實 provider smoke 或 deploy。

## 6. Draft Event Matrix

Builder 必須先以 `NotificationType`、直接 `notifyUsers()`、所有 `NotifyFn` / `notifyOverride` default 與 invocation，以及 `docs/product/notification-spec.md` 做四方 audit。至少逐檔追查 `cancel-class-session-core.ts`、`cancel-demand-request-core.ts`、`create-enrollment-core.ts`、`submit-review-core.ts`、`suspend-restore-core.ts`，另含 admin enrollment cancellation core；下表是產品主人待核准的 draft，不可把「沒有 literal call」或 enum 存在誤當成未接線／已接線：

| Event family | Draft email policy | Notes |
|---|---|---|
| teacher application submitted/approved/rejected | Email | 申請者與既有 admin recipients；維持角色版本文案 |
| teacher profile suspended/restored | Email | 若現有 call site 已接線；屬重要帳號能力變更 |
| demand request submitted/published/rejected/cancelled | Email | 只寄既有 resolver recipients |
| demand response submitted/selected | Email | submitted 的 admin fan-out 依 M2 |
| class session created/changed/cancelled/completed | Email | 只有實際已接線 events；不可為了 email 新增 state transition |
| enrollment confirmed/cancelled | Email | 只寄既有 recipients；不擴充 payment copy |
| review submitted | Email to Teacher `counterpart`（recommended） | 實際 trigger 只通知授課 Teacher，不通知 Admin；屬老師收到課後回饋的 transactional event，待 M1 決定 |
| class reminder basic | Not in this plan | 需要獨立 scheduler/queue plan 與 PO scope decision |

同一 user 同時具備多角色時，沿用既有「first recipient role wins」dedupe，並在每一 channel 僅寄一份；不得因 email fan-out 改變既有文案角色選擇。

## 7. Proposed File Boundary

Expected allowlist（Builder 需先重新 audit）：

- `package.json`
- lockfile（依 package manager 實際檔案）
- `.env.example`
- `src/domain/notification/create.ts`
- `src/domain/notification/sender.ts`
- `src/domain/notification/types.ts`（只有 interface 必要調整；避免增加 entity identifiers）
- `src/domain/notification/email-config.ts` (new)
- `src/domain/notification/email-policy.ts` (new；M1/M2 的唯一 runtime source of truth)
- `src/domain/notification/email-transport.ts` (new)
- `src/domain/notification/email-copy.tsx` 或 `.ts` (new；由 Builder 依既有 TS/React server compatibility 查證)
- `tests/smoke/transactional-email.spec.ts` (new) 或既有 notification test 的最小擴充
- `docs/product/notification-spec.md`
- `docs/product/current-functional-architecture.md`
- `docs/engineering/notification-architecture.md`（若不存在，建立此 kebab-case 檔；若已有權威文件則更新既有文件，不重複）
- launch/readiness checklist 的實際權威檔案（Builder 先查證後回報）

所有現有 event trigger call sites 預期不需修改；若新 orchestration 不能透過既有 `notifyUsers()` contract 接通，Builder 必須先回報影響清單，不能直接大範圍修改 business services。

Forbidden without new approval: `prisma/schema.prisma`, migrations, Auth/session code, role/permission helpers, state transition implementation, payment code, background infrastructure。

## 8. Incremental Build Plan

### Slice A — Audit and contract tests first

1. 列出所有直接與間接 notification triggers：搜尋 `notifyUsers`、`NotifyFn`、`notifyOverride`、`NotificationType`，沿 default parameter 追到 production wrapper，記錄 type、recipient roles、payload、主要 mutation commit boundary 與測試 override。不能只列 literal `notifyUsers()` call sites。
2. 對照 Draft Event Matrix，產出 M1 final type × role table；任何 enum-only event 標為「未接線」。
3. 將產品主人核准的 M1/M2 table 寫成 exhaustive `email-policy.ts`；先新增 failing tests，逐一鎖定 19 types 的 allowed/excluded roles，以及 disabled 不寄信、allowlist 過濾、channel/recipient 去重、email fail 不影響 in-app、主 mutation 成功不受 email error 影響。

Acceptance:

- Test 不使用真實 Resend key/網路。
- 現有 in-app notification count、copy、own-scoped list 行為保持不變。
- Audit 證明所有 provider work 發生在主要 business transaction commit 後。

### Slice B — Configuration and email rendering

1. 新增 server-only environment parser，驗證 mode、API key、sender、base URL、allowlist。
2. `disabled` 為缺省；invalid/missing live config fail closed，且 error 不得印 API key 或完整 recipient list。
3. 建立 deterministic renderer：subject、HTML、plain text、CTA；所有插值預設 escaped，不允許 raw user HTML。
4. 新增 unit-style tests：長中文、reason/user-provided text escaping、absolute HTTPS production CTA、invalid URL/config。

Acceptance:

- Client bundle 無 Resend SDK/API key。
- Email 不含其他使用者 email/phone、內部 IDs、stack traces 或敏感 admin reason 以外的新資訊。
- Preview base URL 可使用實際 HTTPS Preview host；live 禁止 localhost。

### Slice C — Resend transport

1. Audit official `resend` pinned version 的 request customization/abort support。若能證明 hard abort，安裝並記錄版本；若不能，記錄決策並使用官方 HTTPS endpoint + Node `fetch`，不安裝 package。
2. 實作 `EmailTransport.send()`，傳入 from/to/subject/html/text/idempotency key 與 deadline/AbortSignal；測試必須證明 timeout 會觸發 abort。
3. 將 Resend `{data,error}` 兩種結果都正規化；只有 provider 接受成功才回 success。
4. 不在 adapter 建立 public API route；由既有 server-side notification path 呼叫。

Acceptance:

- Fake transport 可完全取代 Resend transport。
- Provider error 被縮減為安全的 structured diagnostic，不把 secrets/完整 email 寫入 log 或 Notification body。
- `Notification.id` 對應 idempotency key，沒有在 send 前標 `sent`。
- Never-resolving fake transport 在 5 秒內被 abort/settled 為 failure；使用 fake timer 時不能讓測試真的等待 5 秒。

### Slice D — Per-channel orchestration

1. 保留既有 recipient first-role dedupe。
2. Always 執行 in-app channel；完成 first-role recipient dedupe 後，必須由 `shouldSendEmail(type, role)` 的 exhaustive policy 判斷，再檢查 mode/config/allowlist；只有全部允許時才解析 User email 並建立 email rows。
3. 每個 row 獨立 try/catch 和 status update；任何 sender/update error 都不 throw 到 business trigger。
4. Email 與 in-app 可並行或循序，但不能讓 provider latency 延長既有 database lock；不得在主要 transaction 內執行。
5. 對 email 缺失的 user 安全 skip 並記 aggregate diagnostic；不把缺 email 當 business failure。

Acceptance:

- one recipient × one event × two enabled channels = exactly two channel rows。
- email failed + in_app sent 可同時存在；`/notifications` 仍只顯示一筆 in-app。
- 一位 recipient/provider failure 不阻止後續 recipients。
- representative core mutation test 證明 email throw 後 mutation 結果仍成功。

### Slice E — Verification and controlled Preview smoke

Automated checks:

```text
npx playwright test tests/smoke/transactional-email.spec.ts
npx tsc --noEmit
npm run lint
npm run build
npm run test:smoke
```

Manual provider smoke（需要 M3/M4/M5 與 explicit approval）：

1. 在 Preview 設 `EMAIL_DELIVERY_MODE=allowlist`，allowlist 只含產品主人指定測試信箱，或先使用 Resend 官方 `delivered+label@resend.dev`。
2. 觸發一個低風險 event，確認 Resend 接受、email row=`sent`、in-app row=`sent`、subject/from/CTA/手機版 rendering 正確。
3. 使用官方 bounce 測試地址驗證 provider failure/accepted-event 的實際邊界；不要用 `example.com` 製造 bounce。
4. 確認非 allowlist user 不會收到信；log 不洩漏 email/API key。
5. Smoke 後保留 Preview=`allowlist`；不得自動切 `live`。

### Slice F — Docs and rollout

- 更新通知規格，清楚區分 implemented in-app、implemented email、enum-only、separate reminder plan。
- 記錄 Preview/production env 設定、sender domain verification、key rotation、failure inspection 與 rollback。
- 外部 pilot 前由產品主人核准 event matrix/copy/sender 並手動把 production 切到 `live`。
- `class_reminder_basic` 維持獨立 L3 planning item，不在此 plan 假裝完成。

## 9. Test Matrix

Minimum deterministic coverage:

- default/explicit disabled: zero provider calls、no email rows、in-app unchanged；
- allowlist match/non-match、case normalization、whitespace、empty list fail closed；
- live missing key/from/base URL，以及 allowlist mode 的 empty/invalid allowlist：no provider call、no email rows、one redacted config diagnostic；
- never-resolving transport 在 deadline abort，email row=`failed`，in-app/business result 仍成功；
- HTML escaping and plain-text readability；
- per-role copy preserved after user dedupe；
- exhaustive policy 精確涵蓋 19 個 types，逐 type × valid role 驗證 allowed/excluded，且 `review_submitted/counterpart` 依 M1 final decision；
- duplicate user receives one row per channel；
- provider returns error and provider throws；
- email status-update failure does not break remaining delivery/business outcome；
- user missing email is skipped safely；
- `/notifications` excludes email rows；
- representative teacher/demand/enrollment mutation still succeeds when email transport fails；
- no real network request in CI/full smoke。

## 10. Security, Privacy, Reliability, and Brand Review

- Email address is personal data: resolve only server-side, never add to notification payload, URL or client response。
- Secrets remain environment-only; `.env.example` contains names/placeholders, never values。
- CTA points to authenticated own-scoped page; no object ID or privileged action in email link。
- User-controlled labels/reasons are escaped; subject/header injection characters must be normalized or rejected。
- Transactional mail must describe real state only; email cannot be sent before the database mutation is committed。
- Failure logging uses notification id/type/channel and redacted recipient identifier, not body or full email。
- Copy follows gentle/clear/professional tone and avoids marketing urgency, medical claims or unapproved payment language。
- Synchronous provider latency is accepted only for low-volume V1 and outside database locks; if observed latency harms request UX, stop and plan an outbox/worker separately rather than silently adding infrastructure。

## 11. Rollout, Rollback, and Observability

Rollout: `disabled` → Preview `allowlist` → product-owner acceptance → external pilot `live`。每一階段先完成 targeted smoke。

Rollback: immediately set `EMAIL_DELIVERY_MODE=disabled`; existing in-app notifications and business mutations continue. Code rollback must not delete historical Notification rows. No migration rollback is expected.

V1 observability: structured server logs plus `Notification(channel=email,status=failed)` inspection. Automatic retry/dashboard/webhook monitoring are explicitly deferred; recurring failures block external pilot and require a separate reliability slice。

## 12. Stop Conditions

Stop and request direction if:

- M1/M3/M4/M5 未決但工作即將寄出真實郵件或 deploy；
- implementation 需要 Prisma migration、Auth/permission/state-machine change；
- provider call 必須進入主要 transaction 才能運作；
- email content needs sensitive data or event-specific deep links not covered here；
- Resend SDK/version behavior differs from verified official docs，或無法保證底層 HTTP hard abort；此時依 E2/Slice C 改走官方 fetch adapter 並記錄，不得留下無界 request；
- concurrent changes overlap notification core/package/config files and cannot be safely preserved；
- full smoke reveals existing business flow regression；
- external pilot 需要 reminders/retry/queue 才可接受。

## 13. Definition of Done

- M1–M6 已記錄產品主人決策；sender domain/API key 由 owner/ops 提供並安全設定。
- In-app remains intact; approved events produce isolated email rows and Resend sends only under explicit mode。
- Targeted tests、TypeScript、ESLint、build、full smoke 全部通過，CI 無真實 network send。
- Preview allowlist smoke 通過 desktop/mobile email client sanity review；production 仍不會未經 approval 自動切 live。
- Notification/docs/launch readiness accurately distinguish email completion from deferred reminder/retry work。
- Required security/self review 完成；no unrelated files、schema change、commit、push 或 deploy。

<!-- codex-peer-reviewed: 2026-08-02T01:45:54Z rounds=3 verdict=approved -->
