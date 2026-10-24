# 10: 驗收與文件同步

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 全部票完成後跑完整 smoke，更新被取代的舊決定與相關文件，整理給產品主人的畫面驗收清單。

**Blocked by:** 01–09

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無

- [x] npx tsc --noEmit、npm run lint、npm run test:smoke 結果記錄
- [x] teacher-class-scheduling-spec 加註系列預設公開；teacher-usability-plan 加註 Q6 被取代
- [x] data-model、state-machines（若受影響）、route 或通知相關文件同步
- [x] 走查報告的發現標記本輪處理狀態
- [x] 列出產品主人要親自看的畫面清單（開始使用、建課預設、收款提醒、老師通知、團體需求）

## 進度紀錄

### 2026-10-24：smoke 失敗分類（整合分支完整 smoke：1576 passed、20 failed、14 skipped）

做法：在未修改的 main（3d2785f）基準 worktree `C:\Users\franz\fsy-tfr-base`（DB `freesoar_tfr_base`、埠 3350）跑同一批測試；基準也失敗＝既有問題，基準通過、分支失敗＝回歸。

| # | 測試（desktop／mobile） | 基準 main | 分類 | 說明 |
| --- | --- | --- | --- | --- |
| 1 | `member-journey-acceptance.spec.ts:73` organizer class（desktop） | 失敗（同一行 overflow） | 既有 | 200% 字級時頁面橫向溢出 |
| 2 | `member-journey-acceptance.spec.ts:73` teacher class（desktop） | 第一次通過、`--repeat-each=2` 重跑失敗（同一行） | 既有（flaky） | 同上；分支重跑仍失敗 |
| 3 | `member-journey-acceptance.spec.ts:142`（mobile） | 失敗（desktop、mobile 都失敗） | 既有 | 找不到 pending 報名；分支的 desktop 這次反而通過，屬不穩定 |
| 4–5 | `organizer-class-sharing.spec.ts:158`（兩種） | 失敗（同一步驟逾時） | 既有 | 等不到「我要報名」 |
| 6–9 | `organizer-journeys.spec.ts:84`、`:157`（兩種） | 失敗（同一步驟逾時） | 既有 | 等不到同意勾選框 |
| 10–11 | `teacher-calendar.spec.ts:214`（兩種） | 失敗 | 既有 | 月份標題「2031 年 2 月」找不到 |
| 12 | `teacher-join.spec.ts:586`（desktop） | 通過（基準行號 566） | flaky，非回歸 | 分支重跑一次就通過 |
| 13–14 | `teacher-series-class-edit.spec.ts:304`（兩種） | 失敗（transaction 逾時） | 既有 | 併發鎖測試 |
| 15 | `teacher-series-class-edit.spec.ts:343`（mobile） | 失敗 | 既有 | 等不到「修改課程」 |
| 16–17 | `term-enrollment.spec.ts:229`（兩種） | 失敗（`create_failed`） | 既有 | 併發名額測試 |
| 18 | `transactional-email.spec.ts:56`（desktop） | 失敗，但只差 `teacher_photo_removed` | **回歸（部分）** | 分支多了 `demand_request_available` 這一筆差異 |
| 19 | `teacher-class-usability.spec.ts:234`（mobile） | 失敗（基準行號 232） | 既有 | 手機版找不到可見的總覽連結 |
| 20 | `teacher-initiated-open-classes.spec.ts:454`（mobile） | 失敗（基準行號 368） | 既有 | 手機版「取消課程」按鈕不可見 |

回歸修正：`transactional-email.spec.ts` 的 EMAIL_POLICY 對照表補上 `demand_request_available: []`（票 06 的預期行為：只發站內，改測試、不改程式）；順手補上 main 就已存在、測試漏列的 `teacher_photo_removed: []`，這條測試因此在分支上整條通過。其餘 19 筆在 main 上同樣失敗，本輪不處理。

### 2026-10-24：review 修正（範圍內，不動 schema、權限）

- 通知合併：`grouping.ts` 分組條件加上標題，老師收到的「有學員退出整期」「有學員請假」「有學員取消報名」不再被合成最新一則的標題；ADR 0008 補註。新增 smoke：同系列同一天 2 則退出整期＋1 則請假 → 兩張卡（退出整期「共 2 則」、請假單獨一張）。
- 分享文案：公開的課改寫「（看課程內容不用登入；報名時用 Google 登入飛索帳號）」；僅透過連結招募維持原句。
- 「開始使用」第 2 步只算老師自己開的課（`origin = teacher_initiated`，任何狀態）；新增 smoke：只有團主開的課（`organizer_direct`）時第 2 步不打勾。
- 新團體需求通知帶 `eventKeyBase: demand-published:<需求 id>`，重試不重複發。
- 收款提醒移到按鈕之前：單堂課頁在按鈕列上方；「生成更多」的提醒在「生成」按鈕上方（按鈕移到勾選框與說明之後）；系列頁有可快速「開放報名」的草稿時，場次清單上方也提醒。smoke 加上文件順序檢查。
- glossary「開始使用」改成實際規則（前兩步完成就收起；「先不用」只記在這個瀏覽器）。
- 用詞：`demand_request_cancelled` 與 `demand_response_selected` 給老師的按鈕都改「前往團體需求」（後者是同一頁、同一個舊詞，一併改）；老師單堂課頁「公開列表」欄位的不公開值改為「僅透過連結招募」。
- 小整理：`PaymentInfoReminder` 移除沒用到的 `missingAccount`／`missingRules`；建課結果改成 discriminated union，`openOutcome: "failed"` 一定帶 `openFailureMessage`，移除 `??` 後備文字。

### 範圍差異（相對 spec／票券）

- 「需求池」改名「團體需求」時，團主端、管理員端與 FAQ 的用詞也一起改了（`src/app/admin/demands/[demandRequestId]/page.tsx`、`src/app/faq/page.tsx`、`src/domain/demand-request/next-step.ts`、`demand_request_published` 文案），不只老師導覽列。
- 老師單堂課頁「複製報名連結」旁的說明，「學員需要先登入」只在課程是僅透過連結招募時出現（跟著公開設定），與分享文案一致。

### 產品主人畫面驗收清單

1. **開始使用（老師總覽）**：用剛通過審核、沒有課的老師帳號看總覽最上方的三步、各自的按鈕與「看看團體需求」；填收款帳號、建第一堂課後自動打勾。注意：第 1、2 步完成就整張收起，所以第 3 步「公開我的老師頁」的入口也跟著不見（之後要到「老師資料 › 個人資料」開）；「先不用」只記在這個瀏覽器，換瀏覽器會再出現。
2. **建課預設公開與直接開放**：第一次開單堂課時「公開列表」預設列在公開列表、「建立後直接開放報名」預設選取；建好後看到「已開放報名。下一步：把報名連結傳給學員」與複製連結按鈕。再開一堂確認沿用上一堂的公開選擇；系列也比照。
3. **收款提醒**：收款帳號或規則沒填時，單堂課頁「開放報名」、建課表單直接開放、系列「全部開放」、系列場次清單（快速開放）、「生成更多」勾選直接開放、期班補課直接開放之前都看到提醒，而且提醒在按鈕上方；不填照樣能開放。
4. **老師通知（含請假）**：學員報名（報名即成立）、自己取消、整期報名、退出整期、整期學員單堂請假時，老師的通知頁各出現對應文案，點了到那堂課或系列頁；同系列同一天的同一種說法合併，不同說法（退出整期 vs 請假）分開列。
5. **團體需求頁**：老師導覽列與頁面標題都叫「團體需求」；空畫面說明需要平台審核、大新竹數量還不多、有新需求會通知；管理員公開一筆需求後，已通過的老師收到「有新的團體需求」。

### 2026-10-24：驗證結果（修正後）

- `npx tsc --noEmit`：通過。`npm run lint`：通過。`npm run build`：通過。
- 受影響的 smoke（整合 worktree、DB `freesoar_tfr_int`、埠 3340）：原本失敗的 20 筆所在檔案，加上這次改到或涵蓋改動程式的 48 個 smoke 檔，共 676 筆：644 passed、19 failed、13 skipped（33.6 分鐘）。19 筆失敗全部是上表在 main 上同樣失敗的既有問題；`transactional-email.spec.ts:56` 與 `teacher-join.spec.ts:586` 這次都通過。
- 另外單獨跑過 `share-templates`、`teacher-payment-reminder`、`teacher-dashboard`、`teacher-enrollment-notifications`：68 passed。
- 沒有重跑全部 smoke（`npm run test:smoke`）；本輪沒改到的 smoke 檔沿用合併後完整 smoke 的結果。
- 其他文件同步：`teacher-class-scheduling-spec.md`（系列預設改為第一堂公開＋沿用上一堂）、`teacher-usability-plan.md`（Q6 被 2026-10-24 Q4 取代）、`teacher-showcase-photos-spec.md`（開關搬到個人資料分頁）、`notification-spec.md`（通過／退回／需求公開文案，新增 `enrollment_pending_review` 列）、`state-machines.md`（單堂建立後直接開放是兩步、不是同一個 transaction）、`adr/0008`（標題不同不合併）、glossary「開始使用」、走查報告「本輪處理狀態」。`data-model.md` 已在票 05、06 同步，本票不再改。
