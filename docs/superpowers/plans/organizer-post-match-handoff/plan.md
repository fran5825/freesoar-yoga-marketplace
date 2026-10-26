# 選定老師之後的交接：實作計畫

建立日期：2026-10-26。來源：[spec](../../../specs/organizer-post-match-handoff-spec.md)（產品主人 2026-10-26 核准 D1＝A、D2＝A、D3＝A）；問題來自[團主第一次發起團課走查](../organizer-first-run-walkthrough/review.md)的 F1、F2。票券見 [ticket-breakdown](ticket-breakdown.md)。

這份計畫只寫「怎麼分批、每批動哪裡、怎麼驗證」。產品規則（誰看得到什麼、文案寫什麼）以 spec 為準，不在這裡重抄；兩邊不一致時以 spec 為準並回頭修這份。

## 目標

1. 團主選定老師後，雙方都在站內看得到對方可用的聯絡方式；缺聯絡方式時，畫面說清楚是誰要補。（F1）
2. 團主媒合建課後，還沒開放報名的課在總覽、列表、課程頁、通知都看得出來；開課時間已過的草稿不再顯示一定會失敗的「開放報名」按鈕。（F2）

## 不動的東西

- **不改 Prisma schema、不寫 migration**：聯絡方式用既有的 `TeacherProfile.contactInfo` 與 `Organization` 聯絡欄位；通知文字在發送當下存進 `Notification.title／body`，改文案只影響新通知。
- **不改 state machine**：草稿 → 開放報名仍只透過團主課程頁的「開放報名」；只是讓按鈕顯示條件跟 service（`startAt > now`）一致。
- **不改 Auth**。
- **會改權限**（票 04）：誰看得到哪些聯絡欄位。HEAVY，要產品主人放行才動工，並做安全檢查（own-scope 寫在查詢 WHERE、DTO 不帶多餘欄位）。
- **會改通知**（票 03、04）：依 `docs/harness/risk-based-workflow.md` 第 6 節，動 notification 要 Human Gate，這兩張都要產品主人放行才動工。
- 不新增 package、env，不 commit、不 push（除非產品主人另外要求）。

## 分批

### 第 1 批：開放報名提醒（F2，STANDARD）

01、02 不需要 Human Gate，可以先做（02 在 01 之後）。03 改通知，要產品主人放行。

| 票 | 動到的地方 | 重點 |
| --- | --- | --- |
| 01 草稿判斷與課程頁 | 新增 `src/domain/class-session/` 底下的純函式（判斷「可開放的草稿／已過期草稿／其他」）；`src/app/organizer/classes/[classSessionId]/page.tsx`；`src/app/organizer/demands/[demandRequestId]/actions.ts`（建課成功提示） | 已過期草稿從 `available` 拿掉 `open`；兩種草稿各自的說明句；過期時兩個連結 |
| 02 總覽待辦、課程列表、需求下一步 | `src/app/organizer/dashboard/page.tsx`；新增團主課程待辦組成函式（比照 `src/domain/organizer-class-proposal/todo.ts`）；`src/app/organizer/classes/page.tsx`；`src/domain/demand-request/next-step.ts` 與三個呼叫處（需求列表、總覽、詳情 `NextStepCard.tsx`）；`src/domain/demand-request/service.ts` | 只列「可開放的草稿」；`converted_to_class` 的 `kind` 維持 `info`。**資料來源要先補**：`ownDemandRequestSummarySelect` 的 `classSession` 目前只讀 `id`，要多讀 `status`、`startAt`，在 domain 層用票 01 的判斷函式算出草稿種類，放進 `OwnDemandRequestSummary`（需求詳情的讀取若用不同查詢，也要補同樣欄位），三處都從這個值傳給 `getDemandNextStep`。測試在三處各驗「可開放草稿／已過期草稿／已開放」三種結果，避免某處漏傳而靜默顯示舊文案 |
| 03 「課程已建立」通知依路線分文案 | `src/domain/notification/copy.ts` 的 `class_session_created`、`src/domain/notification/types.ts`（參數型別）；`src/domain/class-session/__internal__/create-class-session-core.ts` | 只有媒合建課傳新參數；`open-direct-class-core.ts`、`create-teacher-class-session-core.ts` 不動 |

### 第 2 批：聯絡方式（F1，HEAVY）

產品主人放行後才開始。團主端與老師端在**同一張票 04** 完成、一起 review、一起交付：團主畫面的「老師看得到你團體的聯絡窗口」要等老師端做好才是真的，老師設定頁的告知也要跟「團主開始看得到老師聯絡方式」同時上線。測試資料共用一組：一筆需求、三位老師回應、選定一位。

| 票 | 動到的地方 | 重點 |
| --- | --- | --- |
| 04 選定後雙方看到聯絡方式 | 團主端：`src/domain/demand-response/organizer-read-service.ts`；`src/app/organizer/demands/[demandRequestId]/_components/ResponseList.tsx`；需求詳情頁建課區塊（可配合時段）。老師端：`src/app/teacher/demands/[demandRequestId]/page.tsx`（selected 分支）＋新的 domain 讀取函式；`src/domain/class-session/teacher-next-step.ts`；`src/domain/notification/copy.ts` 的 `demand_response_selected`；`src/domain/notification/link.ts` 的 `teacher_demand_request`；老師收款與聯絡設定頁的說明。文件：`docs/domain/permissions.md`、`permissions-matrix.md` | 團主端只有 selected 那筆在 domain 層帶 `contactInfo`；老師端條件「這位老師在這筆需求有 selected 回應」寫在 WHERE，需求取消後自然看不到；雙方都沒有聯絡方式的提醒與補資料連結（returnTo 回這筆需求）；只有 `demand_response_selected` 連單筆，`demand_request_cancelled` 仍連列表 |

### 第 3 批：驗收與文件（STANDARD）

| 票 | 重點 |
| --- | --- |
| 05 驗收與文件同步 | 手機 390px／桌機 1280px 走一次「選定 → 看到聯絡方式 → 建課 → 總覽提醒 → 開放報名 → 提醒消失」；長 email、長電話不溢出；走查報告 F1、F2 標註對應本 spec；backlog 視需要補記沒做的項目 |

## 共用規則

- **業務邏輯放 domain 層**：判斷草稿種類、組待辦、決定誰看得到聯絡方式都在 `src/domain/`，頁面只顯示（AGENTS.md 架構原則）。
- **既有測試會跟著改的文案**：2026-10-26 查過，只有 `tests/smoke/class-session-creation.spec.ts` 第 111 行斷言「課程已建立。」，票 01 改提示時要一起更新，並在進度紀錄寫明是文案變更。`teacher-initiated-open-classes.spec.ts`、`teacher-series-rollup.spec.ts` 斷言的是老師自建課的文字與通知標題「課程已建立」，本計畫不改這些，**不要動**；如果改完它們失敗，代表誤改到老師路線。動工前再用 `rg` 重查一次。
- **測試資料**：照既有 `tests/smoke/organizer-demand-responses.spec.ts`、`demand-response-selection.spec.ts`、`organizer-dashboard.spec.ts`、`notification-role-targets.spec.ts` 的建資料方式；已過期草稿直接用 Prisma 在測試資料庫建立，不寫進開發資料庫。
- **跑測試**：`npm run build` 後 `PORT=3100 npx playwright test <spec>`；有其他工作階段在跑時改用 3200 等空埠，判讀失敗前先換空埠重跑。`organizer-journeys.spec.ts` 目前是 `test.fixme`（backlog 第 27 項），新測試不依賴它。
- **每張票完成前**：`npx tsc --noEmit -p .`、`npx eslint src tests`、變更邏輯的 smoke；第 3 批再跑一次相關 smoke 全組與 build。

## 安全檢查（票 04）

- 團主端：另一位團主打開這筆需求 → not-found；非 selected 回應的 DTO 不含 `contactInfo`（測試直接檢查回傳資料或頁面 HTML 不含該字串）。
- 老師端：沒被選上的老師、從沒回應的老師、需求取消後的原選定老師，都看不到團體聯絡窗口；不顯示團主個人帳號 email。
- 通知連結仍只從 `link.ts` 白名單推導，目標頁照原規則檢查權限。

## Rollback

- 沒有 schema 與資料變更，revert 程式即可，但要照相依順序：02 用到 01 的判斷函式，撤回 01 前先撤回 02；03 可單獨撤回；04 只能整張撤回（不能只留團主端或老師端）。
- 已送出的新文案通知不會因 revert 改回（文字存在通知裡），影響只是文字，不影響連結與權限。

## 風險

- 票 04 改 `teacher_demand_request` 連結時，若漏看其他使用這個 target 的通知類型，會把老師帶到看不到內容的頁面。目前使用者只有 `select-and-submit-core.ts`（選定）與 `cancel-demand-request-core.ts`（取消）；動工前用 `rg teacher_demand_request` 重查。
- 老師的 `contactInfo` 原本只給已報名學員看，票 04 要在設定頁說明「被團主選定時，團主也看得到」，避免老師不知情。

<!-- codex-peer-reviewed: 2026-10-26T11:11:56Z rounds=2 verdict=approved -->
