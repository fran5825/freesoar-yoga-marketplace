# 06: 老師確認／婉拒與共用排課保護

**What to build:** 受邀老師能確認或附原因婉拒；確認成功才保留時段，所有既有建課方式都能防止與此安排衝突。

**Blocked by:** 05：建立合作邀請並送給老師

**Status:** done（2026-10-05）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK、LARGE_REFACTOR_RISK

- [x] 老師只能處理自己的 pending 邀請；confirm 驗 latest version、approved、future、課程完整性；decline 要有有界原因，結果雙端可見。
- [x] 共用 TeacherProfile lock 與 conflict 判斷，同時涵蓋非 cancelled 課程（包含 draft）與 confirmed／未轉課 proposal；pending／declined 不占時段。
- [x] 既有 organizer_matched、teacher_initiated、老師 recurring 的建立路徑採相容擴充，不繞過 confirmed 預留，保留既有介面與 test hooks。
- [x] 確認寫入 accepted version／actor／time；舊頁面不能接受新版，老師資格或時間變動會得到可理解的錯誤。
- [x] 同老師重疊的並發確認只有一筆成功；確認與既有建課競態不能 double-book；統一鎖順序並在鎖內重驗 teacher ID／version。
- [x] 老師確認不授予團主的開放、取消、完成或名單管理能力；未確認、婉拒與衝突各有明確下一步。
- [x] 驗證角色／version／資格／過期、跨來源及 recurring 衝突、並發與不重複確認；更新 state／permission／排課文件。


## 開工前必須處理（2026-10-04 發現）

- **跨任務鎖順序衝突**：老師排課工作（`docs/specs/teacher-class-scheduling-spec.md` 第 6 節、`docs/domain/state-machines.md` 2026-10-04 新增段落）規定「系列 → 場次 → 老師」；團主 contract（spec 13.5）規定「TeacherProfile 最先」。目前團主路徑不會鎖 `RecurringClassSeries`，所以還不會形成互相等待；但只要有任何路徑「先鎖老師、再鎖系列」就會 deadlock。本票開始前要以兩份文件的最新內容統一規則（建議：系列鎖可以排在老師之前，但任何路徑都不得在鎖老師之後再鎖系列），並確認老師排課的實作；需要改動對方規格時先請產品主人確認。

## 鎖順序統一（2026-10-05）

- 老師排課規格（`docs/specs/teacher-class-scheduling-spec.md` 第 6 節）已定為「系列 → 場次（依 id）→ 老師」。團主的邀請流程不會先鎖既有的課程（開放報名是新建一堂課），因此全站順序統一為 **系列 → 場次 → 老師 → 合作邀請 → 需求**，只需調整團主 spec 13.5 的寫法，不改對方規格，不需要產品主人決策。
- `conflict-check.ts` 另有老師排課工作未 commit 的註解修改；本票只加查詢區塊與參數，commit 時只 stage 本票的 hunk。

## 開工前核對（2026-10-05）

- **Allowed files**：`src/domain/class-session/conflict-check.ts`（加已確認邀請的重疊查詢與 `excludeProposalId`，既有參數與 hooks 不變）、`src/domain/class-session/__internal__/create-class-session-core.ts`（團主媒合建課改成先鎖老師再鎖需求，hooks 改套在第一把鎖）、`src/domain/organizer-class-proposal/`（`__internal__/respond-core.ts`、`submit-issues.ts`、service wrapper）、`src/app/teacher/class-proposals/[id]/`（確認／婉拒 UI 與 actions）、`src/app/organizer/class-proposals/[id]/page.tsx`（確認／婉拒後的下一步）、新 smoke spec、spec 13.5 與 state／permission／data-model／route-map 文件、本票。
- **不動**：老師自建課、系列與報名的程式（它們都經過 `lockTeacherScheduleAndCheckConflict`，自動被已確認邀請擋下；且這些檔案有老師排課工作的未 commit 修改）。
- **沒有 schema 變更**；rollback 為 revert 本票 commit。
- **驗證**：確認寫入 confirmedVersion／confirmedAt／確認者、舊版本被拒、非 approved／過去時間被拒、婉拒原因必填、確認後占時段（擋團主媒合建課）、pending／declined 不占、兩筆重疊邀請同時確認只有一筆成功（hooks 決定性測試）、確認與既有建課同時進行不會重複排課、他人老師 not found、既有建課併發測試回歸。

## 進度（2026-10-05，中斷點：用量上限）

- [x] `conflict-check.ts` 加入已確認邀請的重疊查詢與 `excludeProposalId`；`create-class-session-core.ts` 改成先鎖老師再鎖需求（hooks 套在第一把鎖）。
- [x] `__internal__/respond-core.ts`（確認／婉拒）、`submit-issues.ts`、service wrapper、老師頁確認／婉拒 UI、團主詳情的下一步文字。
- [x] 新 spec `organizer-class-proposal-respond.spec.ts` 12 passed（含兩個 hooks 決定性併發測試）；tsc、eslint、build 通過。
- [x] 已解決：`demand-request-cancellation` 的兩個競態測試失敗，是因為 hook 改套在老師鎖上，暫停時還沒拿到需求鎖，雙方在暫停點沒有真正互斥（業務結果仍正確）。改成 `onBeforeLock` 在取第一把鎖之前、`onLockAcquired` 在老師與需求的鎖都到手之後；四個相關併發測試（取消贏、建課贏、同需求重複建課、確認與建課競態）都能證明真正互斥。重跑 demand-request-cancellation、class-session-creation、organizer-class-proposal-respond 56 passed；先前的其他回歸（媒合、邀請、老師開課、報名）110 passed。
- [x] 文件：spec 13.5 改寫為全站鎖順序「系列 → 場次 → 老師 → 合作邀請 → 需求」並標記媒合建課調整已落地；state-transition-details、permissions-matrix、data-model、route-map 標記確認／婉拒已落地。
- [x] Codex 第 1 輪修正：確認時鎖到邀請後，若時間和鎖外預讀的不同（等待老師鎖期間被修改），用鎖內最新時間再做一次撞課檢查（測試：暫停在老師鎖時把邀請改到已有課的時段，結果是 `schedule_conflict`）。補上跨路徑證據：已確認的邀請擋下老師自己開的單堂課（不重疊的時段正常建立）、系列生成跳過撞到的那一天、系列已生成的場次擋下同時段的確認。
- [x] 重跑 organizer-class-proposal-respond 16 passed；tsc、eslint、build 通過。
- [x] 獨立 review（Codex，2 輪後 APPROVED）。
- [x] 本機 commit（未 push）。

<!-- codex-peer-reviewed: 2026-10-05T02:44:44Z rounds=2 verdict=approved -->
