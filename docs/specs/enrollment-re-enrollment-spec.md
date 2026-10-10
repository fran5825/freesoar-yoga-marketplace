# 重新報名與取消請假 Spec

建立日期：2026-10-10。來源：產品主人 `/grill-with-docs`（重新報名 Q1–Q11）與另一個 session「期班請假」補充的四項決定（名額釋出依期班模式、兩種模式的請假文案、老師名單分開標示、Admin 顯示取消原因）。兩個討論合併成這一份 spec。決策記錄見 [ADR 0006](../adr/0006-re-enrollment-after-self-cancel.md)。

## 1. 要解決的問題

目前學員在開課前取消報名後，同一堂課永遠不能再報（`enrollment` plan D8，資料庫 `@@unique([classSessionId, userId])` 不分狀態）。整期學員對某一堂「請假」後也一樣，畫面寫「這筆報名已取消，無法再次報名此課程」。產品主人認為這不夠彈性，尤其期班學員有時很難找到人代課或單買單堂，請假只是請假，應該可以反悔。

## 2. 名詞

沿用 `docs/context/glossary.md`：**重新報名**、**請假**、**取消報名**、**整期報名**。一般單堂叫「取消報名」，整期學員取消其中一堂叫「請假」，兩個詞不混用。

## 3. 決策（全部已確認）

| # | 決策 |
|---|------|
| R1 | 開課前自己取消（含請假）的報名，可以重新報名；課程開始後不能取消，也不能重新報名 |
| R2 | 只有「學員自己取消」的才能重新報名。老師婉拒、管理員取消、整期退出或被婉拒連帶取消、整堂課被取消，一律不能。舊的已取消紀錄沒有取消者資料，一律不能 |
| R3 | 需要老師確認的課，單堂重新報名視為新的申請，回到「等待老師確認」 |
| R4 | 重新報名次數不限，只要還沒開課、還有名額 |
| R5 | 整期學員請假後反悔（取消請假），回到原本的整期報名，不是變成單堂報名；狀態跟著整期報名目前的狀態（整期已確認回 `confirmed`，整期還在 `pending` 回 `pending`），不另外記請假前的狀態 |
| R6 | 想報整期、但曾自己取消過這期某一堂：維持擋住，提示先到那一堂重新報名，再回來報整期 |
| R7 | 通知沿用現有報名通知，不新增通知類型。取消請假不寄 email 或通知老師，也不加原因欄位 |
| R8 | 整期退出或被婉拒之後，那期中請假過的那一堂也不能再重新報名（整期報名終結，沒有地方可以回到） |
| R9 | 請假的名額依期班模式處理：`term_only` 保留給請假的人，到開課前都不算空位；`term_and_single` 釋出給單堂報名，被買滿就不能取消請假。請假與取消請假都沒有截止時間，一律到開課前為止 |
| R10 | 老師的整期學員名單把「請假」和「管理員取消」分開標示，不再用推測 |
| R11 | 管理員後台在已取消的報名旁顯示取消原因；不新增代學員取消請假的操作 |
| R12 | 取消與請假確認框依模式使用不同文案（見 4.6） |

## 4. 規則

### 4.1 資料：誰取消的

`Enrollment` 新增可為空的欄位 `cancelledBy`（enum `EnrollmentCancelledBy`：`member`、`teacher`、`admin`、`system`）。只新增、不改刪既有資料（additive migration）。

| 取消來源 | `cancelledBy` |
|----------|---------------|
| 學員自己取消單堂、整期學員請假 | `member` |
| 老師婉拒單堂 pending 報名 | `teacher` |
| 老師婉拒整期（連帶取消的逐場） | `teacher` |
| 老師婉拒整期時，脫離整期的「併入單堂」逐場（`merged_single`）若已是學員請假（`cancelled` 且 `member`） | 改為 `system`（整期已終結，不能再重新報名，R8；不改成 `teacher`，因為不是老師婉拒那一筆） |
| 管理員取消單筆報名 | `admin` |
| 整堂課被取消（團主／老師／管理員）、學員退出整期（連帶取消的逐場） | `system` |
| 舊資料（欄位新增前已取消的） | `NULL`，顯示「原因未記錄」，一律不能重新報名 |

婉拒整期時的特別處理：現有流程會把所有 `merged_single` 逐場解除整期關聯、恢復成單堂。已經請假（`cancelled`、`cancelledBy = member`）的那幾筆在解除關聯的同一個動作裡把 `cancelledBy` 改為 `system`，否則它們會變成「學員取消的單堂」而符合 4.2 的重新報名條件，繞過 R8。其餘狀態的 `merged_single` 逐場維持現狀（恢復單堂並保留狀態）。

資料庫不變量（DB check）：`cancelledBy` 有值時 `status` 必為 `cancelled`；狀態離開 `cancelled` 時 `cancelledBy` 必須同時清為 `NULL`。

「請假」不另外開值：`cancelledBy = member` 且 `seriesEnrollmentId` 不為空，就是請假。

顯示用的取消原因（不另存）：

| 條件 | 顯示 |
|------|------|
| `member` 且屬於整期 | 學員請假 |
| `member` 且不屬於整期 | 學員取消 |
| `teacher` | 老師婉拒 |
| `admin` | 管理員取消 |
| `system` 且課程已取消 | 老師停課／課程取消 |
| `system` 且整期報名為 `withdrawn` | 學員退出整期 |
| `system` 其他 | 系統取消 |
| `NULL` | 原因未記錄 |

### 4.2 單堂重新報名

函式：延伸 `createEnrollmentForUser`，不另開新入口。鎖定順序不變：`ClassSession` → `TeacherProfile` → 該學員在這堂的報名。

在既有檢查（開放報名、未開始、`term_only` 期班不收單堂、老師 `approved`、名額）都通過之後，若這位學員在這堂已有一筆報名：

- 該筆為 `cancelled` 且 `cancelledBy = member` 且不屬於整期：把同一筆更新為新狀態（`requiresApproval` 為真則 `pending`，否則 `confirmed`），`notes` 與 `consentedAt` 用這次送出的值，`cancelledBy` 清為 `NULL`。更新條件寫進 `WHERE`（`status = 'cancelled' AND "cancelledBy" = 'member'`），避免併發時重複動作。
- 其他情況（有效報名、不能重新報名的取消）：維持 `already_enrolled`，並依原因回傳不同文案（見 4.6）。
- 屬於整期的取消，不走這條路（見 4.3）。

名額檢查維持 `pending + confirmed < capacity`；名額已被別人佔滿時回傳 `class_session_full`，與新報名一致。重新報名需要重新勾選基本同意，因為 `consentedAt` 是新的紀錄。

### 4.3 取消請假（整期逐場）

新增 `restoreLeaveForUser`（`__internal__` 核心，由 `service.ts` 的外層解析使用者）。鎖定順序與整期報名一致：`RecurringClassSeries` → `ClassSession`（`FOR UPDATE`）→ `TeacherProfile` → 該筆報名。

允許條件（全部成立）：

1. 該筆是本人的，`status = cancelled`，`cancelledBy = member`，`seriesEnrollmentId` 不為空。
2. 對應整期報名 `status` 為 `pending` 或 `confirmed`（R8：`withdrawn`／`declined` 一律拒絕）。
3. 課程尚未開始，`ClassSession.status = open_for_enrollment`，老師 `approved`。
4. `term_and_single`：目前 `pending + confirmed < capacity`，否則回傳「這一堂名額已被報滿」。`term_only`：不需要名額檢查，因為名額已保留（R9）。

結果：把該筆狀態改為跟整期報名一致（整期 `confirmed` → `confirmed`，整期 `pending` → `pending`），`cancelledBy` 清為 `NULL`，保留 `seriesEnrollmentId` 與 `seriesEnrollmentSource`、`consentedAt`。不要求重新勾選同意（整期報名時已同意），不寄通知。

### 4.4 名額占用規則（`term_only` 保留請假名額）

一堂課的「占用名額」定義為：

```
占用 = pending + confirmed 的報名數
     + （課程屬於 term_only 期班時）請假中的報名數
```

「請假中」＝ `status = cancelled` 且 `cancelledBy = member` 且 `seriesEnrollmentId` 不為空，且對應整期報名為 `pending` 或 `confirmed`。`term_and_single` 與其他課程不加這一項（請假名額釋出）。

這個定義集中成一個共用函式，並套用在所有「用名額做判斷」的地方：

- 整期報名的名額檢查（`term_session_full`）。
- 老師改課的人數上限下限檢查（單場改課與「從這場以後」改課）。
- 補課追加的名額檢查（只看整期學員人數，補課沿用整期名額；確認不受影響並以測試保護）。
- 畫面顯示的剩餘名額與期班「可報名」判斷（`read-service`、`term-read-service`、公開列表的期班卡）。

學員請假後，老師名單（`confirmed` 列表）不顯示這位學員的這一堂；請假另列在整期學員區（4.5）。

### 4.5 老師與管理員看到的

老師的期班頁整期學員列：把原本的 `leaveDates` 拆成兩組。

- **請假**：整期仍有效、課程沒取消、`cancelledBy = member` 的場次日期。
- **管理員取消**：`cancelledBy = admin` 的場次日期。
- `cancelledBy` 為 `NULL` 的舊紀錄：列為「已取消（原因未記錄）」，不歸入請假。

老師停課（整堂取消）、學員退出整期、老師婉拒整期造成的取消，沿用現狀不列。

管理員的課程詳情頁完整名單，在已取消的報名旁顯示 4.1 的取消原因文字。不新增代學員取消請假或重新報名的操作。

### 4.6 畫面與文案

> 操作入口的位置後來改為就地操作（我的報名、期班頁、單堂頁第一張卡與同系列列表），見 [就地請假與精簡卡片 spec](./member-inline-actions-and-card-cleanup-spec.md)；本節的顯示條件與文案規則不變。

單堂頁「你的報名狀態」區（`ClassEnrollmentPanel`）。可否重新報名由 service layer 的讀取函式（`getClassSessionForMember`）一併算好回傳，頁面只依結果顯示，不自己判斷；顯示表單的條件與 `createEnrollmentForUser` 的檢查一致，避免出現送出後必然失敗的表單：

| 情況 | 畫面 |
|------|------|
| 已取消、可重新報名（單堂），且課程開放、未開始、還有名額、老師 `approved` | 說明「你之前取消了這堂課，開課前、名額還在時可以重新報名」，並顯示備註欄、基本同意勾選與「重新報名」按鈕（需老師確認的課按鈕為「重新送出報名申請」） |
| 已取消、單堂、但名額已滿 | 「這堂課名額已滿，暫時不能重新報名」，沒有表單 |
| 已取消、單堂、但老師目前無法接受新報名（非 `approved`） | 「這位老師目前無法接受新報名」，沒有表單 |
| 已取消、整期請假、可取消請假 | 「取消請假」按鈕與確認文字（見下），不需要同意勾選 |
| 已取消、整期請假、`term_and_single` 且名額已被報滿 | 「這一堂名額已被報滿，請聯絡老師」，沒有按鈕 |
| 已取消、不能重新報名 | 依原因：老師婉拒「老師婉拒了這次報名，無法重新報名」；管理員取消「這筆報名已由管理員取消，無法重新報名」；整期已退出（`withdrawn`）「你已退出這一期，這一堂無法再報名」；整期被婉拒（`declined`）「老師婉拒了你的整期報名，這一堂無法再報名」；舊紀錄與其他「這筆報名已取消，無法再次報名此課程」 |
| 課程已開始 | 一律沒有按鈕，沿用現有「無法報名」文案 |

取消與請假的確認框文字：

- 單堂取消：「取消後，開課前可以重新報名；名額被報滿則不能。」
- `term_only` 請假：「請假後，這一堂會標示為請假；整期的其他堂照常。開課前可以取消請假。」
- `term_and_single` 請假：「請假後，這一堂的名額會開放給單堂報名；整期的其他堂照常。開課前、名額還在時可以取消請假。」

期班頁（尚未報整期的學員）原本的提示「你曾取消…這一期無法再報整期」，改為「你曾取消 X 的報名，請先到那一堂重新報名，再回來報整期」（R6）。只適用於「還沒報整期、因先前自己取消單堂而被擋住」的情況；若該筆不能重新報名（例如老師婉拒、管理員取消），仍顯示原本的無法報整期文案。已經退出或被婉拒的整期（R8）不適用這句，也不會有任何「恢復」的提示；整期退出的確認框文字不變。

「我的報名」列表不新增按鈕；已取消的卡片仍連到單堂頁，在那裡操作。

### 4.7 通知

- 單堂重新報名：沿用 `enrollment_confirmed`（直接成立）或 `enrollment_pending_review`（老師與學員都收到，需確認的課）。
- 取消請假：不通知。

## 5. 錯誤碼

| 情境 | 回傳 |
|------|------|
| 單堂重新報名但取消者不是學員 | `already_enrolled`，訊息依原因（4.6） |
| 取消請假但名額已被報滿 | `leave_restore_session_full`，「這一堂名額已被報滿，請聯絡老師」 |
| 取消請假但整期報名已終結 | `series_enrollment_not_active` |
| 取消請假但課程已開始 | `class_session_already_started` |
| 取消請假但不是請假（單堂取消、老師婉拒等） | `leave_not_restorable` |

## 6. 實作切片（見 `docs/superpowers/plans/enrollment-re-enrollment/ticket-breakdown.md`）

1. Schema 與取消者記錄：新增欄位與 enum、DB check，所有取消寫入處填 `cancelledBy`。
2. 單堂重新報名：service、`ClassEnrollmentPanel`、文案。
3. 取消請假與名額占用規則：`restoreLeaveForUser`、共用占用函式、套用各處、畫面與文案。
4. 老師名單與管理員顯示取消原因。
5. 驗收與文件同步。

## 7. 不在範圍

候補、重新報名次數限制、管理員代學員取消請假、請假原因欄位、請假通知老師、補課規則變更、付款。

## 8. 風險

| 風險 | 處理 |
|------|------|
| 有取消寫入處漏填 `cancelledBy` | DB check 只擋「有值卻不是 cancelled」，擋不到漏填；實作時列舉所有寫入處（共 8 處，含兩個 raw SQL），並以測試涵蓋每一種來源 |
| `term_only` 名額占用規則漏掉某處導致超收或名額顯示不一致 | 集中成單一共用函式，所有名額判斷改走它，並以併發與顯示測試保護 |
| 整期婉拒時併入單堂的請假報名脫離整期後繞過 R8 | 婉拒時同一動作把這些報名的 `cancelledBy` 改為 `system`，並以測試涵蓋「單堂→併入整期→請假→整期被婉拒→不能重新報名」 |
| 重新報名與取消、整期報名併發 | 沿用既有鎖順序；重新報名更新條件寫進 `WHERE`；加併發測試 |
| 文件仍寫「取消後不可重新報名（D8）」造成誤判成 bug | 同一次變更更新 `state-machines.md`、`state-transition-details.md`、`data-model.md`，並新增 ADR 0006 |
| 舊紀錄全部不能重新報名，使用者覺得規則不一致 | 目前只有本機開發環境；畫面顯示明確原因文字 |

<!-- codex-peer-reviewed: 2026-10-09T16:22:17Z rounds=3 verdict=approved -->
