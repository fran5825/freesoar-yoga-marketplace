# 06: 老師被暫停時不顯示團體聯絡窗口

來源：產品主人 2026-10-26 決定（backlog 第 32 項）：「老師被暫停時，就不要再顯示團體聯絡窗口。」範圍確認單：「兩條路線都套用」「團主端照舊看得到老師聯絡方式」。

**What to build:** 老師資格不是 approved（例如被管理員暫停）時，老師端兩個會顯示團體聯絡窗口的地方都改成不顯示，並說明原因：(1) 找老師路線，被選定老師的需求回應頁（票 04 新增）；(2) 直接開團路線，受邀老師的合作邀請頁（`ProposalSummary` 的「團體聯絡窗口」）。恢復資格後自動再顯示。團主端看被選定老師的聯絡方式不變。

**Blocked by:** 04

**Status:** done

**Workflow mode:** HEAVY

**Human Gate:** yes（產品主人 2026-10-26 已在對話中明確要求實作，視為放行）

**Risk flags:** permission（縮小老師可讀的團體聯絡欄位）；不改 schema、不改 Auth、不改狀態機

範圍盤點（2026-10-26，`rg contactName|contactEmail|contactPhone` 於 `src/app/teacher`、`src/domain`）：老師端讀得到團體聯絡欄位的只有上述兩處。老師的單堂課詳情本來就只有團體名稱（`permissions.md`），不受影響。管理員、團主讀取不變。

- [x] `getSelectedDemandContactForTeacher`：老師 `status` 不是 approved 時不回傳聯絡欄位，改回傳「因資格暫停而隱藏」；判斷在 domain 層
- [x] 老師需求回應頁：隱藏時顯示「你的老師資格目前暫停，暫停期間看不到團體聯絡窗口。」，不顯示「請填聯絡方式」之類提醒
- [x] `getProposalForTeacher`：老師不是 approved 時，回傳的團體聯絡欄位清空並標記隱藏；`ProposalSummary` 的「團體聯絡窗口」改顯示「老師資格暫停期間不顯示」（團主看同一個元件時不受影響）
- [x] `docs/domain/permissions.md`、`permissions-matrix.md` 補上條件
- [x] smoke：找老師路線被選定後暫停 → 回應頁 HTML 不含團體聯絡資料、看到說明；恢復 approved → 再看到
- [x] smoke：直接開團受邀老師暫停 → 合作邀請頁 HTML 不含團體聯絡資料、看到說明；團主看同一份邀請仍看得到自己的團體聯絡窗口
- [x] 既有 `organizer-class-proposal-respond`、`organizer-class-proposals`、`teacher-profile-suspension`、`organizer-post-match-handoff` smoke 通過

## 進度紀錄

- 2026-10-26 完成：`getSelectedDemandContactForTeacher` 老師不是 approved 時回 `{ hidden: "teacher_not_approved" }`；老師回應頁改顯示暫停說明。`getProposalForTeacher` 另查老師自己的資格，不是 approved 時清空團體聯絡欄位並標 `contactHiddenForTeacher`，`ProposalSummary` 顯示「老師資格暫停期間不顯示」（團主端不變）。範圍差異：盤點時發現暫停老師的總覽待辦「等待團主建立課程」仍寫「團體聯絡窗口在回應頁」，一併改成暫停時不提聯絡窗口（`buildTeacherTodoItems` 新增 `organizationContactHidden`）。smoke 新增 3 支（找老師路線暫停隱藏／恢復再顯示／團主仍看得到、直接開團暫停隱藏且團主不變、總覽待辦文字），連同 `organizer-class-proposal-respond`、`organizer-class-proposals`、`organizer-class-proposal-revise`、`organizer-self-teaching`、`teacher-profile-suspension`、`teacher-demand-response`、`teacher-dashboard`、`teacher-dashboard-todo`：126 passed、92 passed 兩輪（`PORT=3300`，`freesoar_opmh_test`）。

<!-- codex-peer-reviewed: 2026-10-26T13:40:15Z rounds=1 verdict=approved -->
