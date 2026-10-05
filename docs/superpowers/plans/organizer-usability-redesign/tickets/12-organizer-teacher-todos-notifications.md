# 12: 全站待辦與通知直達單筆

**What to build:** 團主與老師在總覽、列表及站內通知能辨識目前輪到誰，直接前往該邀請或課程繼續處理。

**Blocked by:** 07：修改、撤回與重新邀請；08：團主本人授課；09：直接開放報名與來源權限

**Status:** done（2026-10-05）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK、LOW_PRESSURE_UX_RISK

- [x] proposal 列表與課程列表分開辨識；總覽把待我處理與等待對方分開，主動作導向單筆詳情，未確認不偽裝成已排課。
- [x] 送邀請、確認、婉拒、撤回、內容異動與開放後的下一步文字與 server state／version 一致，expired 顯示修改時間、不新增 cron state。
- [x] 站內通知涵蓋核准事件；service 決定 owner／受邀老師與合法目標，不接受 client 自訂收件人、敏感文字或任意網址。
- [x] 通知重試不重複，失敗不破壞已確認的 domain transaction；相同 idempotency／事件識別的行為有明確證據。
- [x] 本人授課不發重複自邀請通知；通知直達確切 proposal／class，未登入回原單筆、越權／已無效安全處理。
- [x] 沿用既有通知資料與可推導連結；若查證需要新 notification schema，先補具體 migration 設計／Human Gate，不私自加已讀欄位。
- [x] 驗證收件人、事件重試、self-teaching、合法單筆、角色隔離、各等待／待辦狀態與 RWD；不接 Resend、不改 env、不啟用 email、不加未讀數。

## Notification schema 變更說明（Human Gate：產品主人 2026-10-05 確認方案 A）

### 為什麼需要

- 目前合作邀請的送出、確認、婉拒、撤回、修改**都沒有發任何通知**；只有團主「開放報名」時通知老師（`class_session_created`）。老師端也沒有邀請列表，受邀老師除非拿到網址，否則不會知道有邀請。
- `Notification` 只有 `type`、`title`、`body`，沒有記錄是哪一筆資料，所以 `src/domain/notification/link.ts` 只能連到列表頁；也沒有防重複的鍵，重試會產生重複通知。

### 方案 A（建議）：兩個只新增、不改舊資料的 migration

1. **新增 5 個通知類型**（`ALTER TYPE "NotificationType" ADD VALUE`，PostgreSQL 規定要獨立一個 migration）：`class_proposal_invited`、`class_proposal_confirmed`、`class_proposal_declined`、`class_proposal_withdrawn`、`class_proposal_revised`。
2. **`Notification` 新增 3 個可空欄位與 1 個新 enum**：
   - `targetType NotificationTargetType?`：白名單 enum，只有 `organizer_class_proposal`、`teacher_class_proposal`、`organizer_class_session`、`teacher_class_session` 四種，各自對應一個固定的單筆頁（`/organizer/class-proposals/[id]`、`/teacher/class-proposals/[id]`、`/organizer/classes/[id]`、`/teacher/classes/[id]`）。不存任何網址，連結由 server 依白名單推導；點進去的頁面照原本規則檢查權限（越權或已失效就 not-found）。
   - `targetId String?`：該筆邀請或課程的 id。
   - `eventKey String? @unique`：防重複的鍵，格式為「邀請 id＋`transitionSeq`＋收件人 userId」（spec 13.7）。同一次轉換重試時 key 相同，資料庫的唯一限制會擋下第二筆，程式把這種情況當成「已經發過」；不同步驟的 `transitionSeq` 不同，各自都會發。
- **對既有資料的影響**：開發資料庫現有 497 則通知，三個新欄位都是空值，不回填、不刪除、不改內容；舊通知照舊連到列表頁。PostgreSQL 允許多筆 NULL 同時存在於 unique 欄位，不會衝突。目前沒有正式環境。
- **Rollback**：欄位與新 enum 可以用 forward migration 刪除；新增的 `NotificationType` 值無法直接移除（要重建型別），沒用到時留著不影響。程式 revert 本票 commit。
- **不做**：已讀欄位、未讀數、email／Resend、env 變更。

### 方案 B：不改 schema

- 新事件沿用現有欄位，通知只能連到列表頁（老師端要另外新增「收到的邀請」列表）；重試沒有資料庫層級的防重複，只能靠程式盡量避免。不符合票券「直達單筆」與「重試不重複有明確證據」兩項驗收，需要把這兩項改成後續工作。

### 收件人規則（兩案相同，spec 13.7）

- 送出（含重送）→ 受邀老師；本人授課不發。確認／婉拒 → 團主。撤回 → 曾看到邀請的老師（修改前是 pending 或 confirmed，且不是團主本人）。pending 中修改內容 → 受邀老師（`class_proposal_revised`）。換老師依修改前後兩組資料決定：原老師收到撤回、新老師在邀請處於 pending 時才收到邀請。
- 收件人一律由 service 從資料庫解析，不接受 client 指定收件人、文字或網址。通知在 domain transaction commit 之後發；發送失敗只記 log，不回滾已完成的確認／開放。

## 進度紀錄

- 2026-10-05 Migration：`20261005210000_notification_proposal_types`、`20261005210100_notification_target`，`migrate deploy` 套用到 `freesoar_yoga_marketplace_dev`；diff 只剩學員流程票 03 分支（`C:/Users/franz/fsy-03`）已套用到共用開發資料庫、尚未合併的 `ClassSession.suitableFor／preparationNotes` 兩欄，與本票無關。原本取的時間戳和該分支的 migration 相同，已改成 `20261005210000` 起避免排序混淆。
- 通知寫入：`notifyUsers` 可帶每位收件人的 `target` 與 `options.eventKeyBase`；eventKey unique 衝突（P2002）視為已發送，不再呼叫 sender。`link.ts` 有 target 時依白名單直達單筆。
- 轉換資料：確認、婉拒、本人確認、修改、撤回的核心在同一個 transaction 內回傳 `event`（`transitionSeq`＋修改前後的狀態與老師，`__internal__/transition-event.ts`）；送出改用 transaction 讀回 `transitionSeq`。收件人規則在 `notifications.ts`（`notifyProposalTransition`），service 在 commit 後呼叫；直接開團的 `class_session_created` 也帶老師端課程 target 與 eventKey。
- 總覽：`todo.ts` 推導合作邀請待辦。老師總覽「待你處理」最前面列出待你確認（待辦）、已確認等團主開放與時間已過（等待中）；團主總覽「待你處理」加上已確認可開放、被婉拒、草稿、時間已過，新增「等待對方回覆」列出等待老師確認。我的課程上方的直接開團進度（票 10）維持與正式課程分開。
- 已知取捨：已確認的邀請改內容但不換老師時回到草稿、確認失效，這一刻不發通知，團主重新送出時老師收到新的邀請（已記入 spec 13.7）。
- 驗證：tsc、eslint、build 通過；新增 `tests/smoke/organizer-proposal-notifications.spec.ts`（UI 送出 → 老師總覽與通知直達 → 確認 → 團主通知與總覽；重試不重複與送出→婉拒→重送→婉拒四步；同一老師兩次修改各一則；等待確認中換老師；確認後換老師；撤回附說明；草稿撤回不通知；本人授課不寄自己；其他老師 0 則且單筆 404；時間已過的待辦文案）10 passed。既有合作邀請三個 spec 的成功斷言改為 `toMatchObject`（核心多回傳 event）。回歸 16 檔（合作邀請、直接開團、本人授課、通知、總覽、入口、分享、建課、報名、老師改課）桌機＋手機無失敗（port 3200）。
- Codex 第 1 輪修正：(1) 轉換快照加上交易內取得的 `title`，換老師時原老師的「已取消」用修改前的課名，不會看到新草稿內容；(2) 老師端已確認但時間已過的邀請顯示「時間已過，等待團主修改」而不是等待開放；(3) 老師端課程詳情未登入時帶 `callbackUrl` 回同一堂課（通知直達的頁面）。補三條回歸測試；相關 6 個 spec 84 passed。

<!-- codex-peer-reviewed: 2026-10-05T20:47:33Z rounds=2 verdict=approved -->
