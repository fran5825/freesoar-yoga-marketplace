# 03: 單堂頁第一張卡（狀態與動作）、同系列列表按鈕、持續開課連結

來源：[spec 3.4、I4、I6、I7、I8](../../../../specs/member-inline-actions-and-card-cleanup-spec.md)。

**What to build:** 已報名的學員在單堂頁，狀態標籤與原因文字直接在第一張課程資訊卡，單堂課的取消報名、重新報名與整期的請假、取消請假都是那張卡裡的按鈕、就地展開；「你的報名狀態」卡整張消失。沒報名的人看到的「報名這堂課程」卡不變。「同系列的其他場次」：整期學員自己的列有狀態與請假按鈕；持續開課且系列頁看得到時（條件與系列頁 `getPublicSeriesDetail` 相同：有未來、公開、狀態符合、老師 approved 的場次），整張卡改成第一張卡裡一行「查看這個課程的所有日期」連結。

**Blocked by:** 01

**Status:** 完成（2026-10-10，測試通過）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無（改動範圍最大，需更新較多舊測試）。

- [x] 移除「你的報名狀態」卡；狀態標籤與原因進第一張卡標題列；取消報名、重新報名（備註、同意勾選、「重新送出報名申請」）、請假、取消請假做成卡內按鈕；不能時只顯示原因
- [x] 「同系列的其他場次」：期班整期學員自己的列用票 01 的共用元件；持續開課且系列頁看得到時改為第一張卡的連結（用與系列頁相同的可見性判斷，不只看 `isPublic`），看不到時維持列日期；**混合系列**（這位使用者看得到的其他場次含非公開場次）也維持列日期，只有全部都是公開場次、且場次總數未超過系列頁上限（`SERIES_SHOW_MAX`＝200）時才用連結；連結對訪客與非整期學員同樣適用；**期班**的列表中，訪客與非整期學員維持日期列表（沒有狀態與按鈕）
- [x] 沒報名、訪客登入引導、期班報名區（`TermClassEnrollPanel`）與固定在底部的「前往報名」列不變
- [x] 更新依賴「你的報名狀態」卡與舊文字的測試（`single-re-enrollment`、`term-leave-restore`、`re-enrollment-acceptance`、`member-journey-acceptance`、`enrollment` 等），覆蓋不減
- [x] 測試：單堂取消與重新報名各種狀態（可、名額已滿、老師婉拒、管理員取消、舊資料、老師非 approved）、整期請假與取消請假（兩種模式）、持續開課連結出現，以及系列不公開、所有場次已開始、老師非 approved、混合系列（已登入學員看得到非公開場次）、場次總數超過系列頁上限時退回列日期，訪客在混合系列仍是連結、手機 375px 無橫向溢出

## 進度紀錄（2026-10-10）

- 單堂頁：新增 `ClassOwnEnrollment.tsx`（第一張卡的狀態與動作）、`ClassSummary` 加狀態與動作插槽、`ClassEnrollmentPanel` 只剩沒報名的情況；整期請假與取消請假沿用票 01 的共用元件與 action。`getClassSessionForMember` 帶 `rowControl`；`listVisibleSiblingSessions` 帶 `isPublic` 與整期學員自己的列（`own`）；新增 `isPublicSeriesPageAvailable`（與系列頁同一個可見性條件）。持續開課連結條件：其他可見場次全部公開、連同這一堂不超過 `SERIES_SHOW_MAX`、系列頁看得到，否則維持列日期。
- 舊的 `restoreLeaveFromClassAction` 移除（改用共用 action）。
- 新增 `inline-class-page.spec.ts`（桌面＋手機 14 項）；更新 8 個舊 spec 的卡片名稱（「你的報名狀態」→「課程重點」）、請假按鈕文字與重新報名需先展開。相關 spec 近 400 項通過；手機版在長批次中有 5 項不穩定失敗，單獨重跑全部通過。

<!-- codex-peer-reviewed: 2026-10-09T23:48:40Z rounds=6 verdict=approved -->
