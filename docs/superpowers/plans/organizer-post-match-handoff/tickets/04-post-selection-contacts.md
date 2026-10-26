# 04: 選定後雙方看到聯絡方式

來源：[spec](../../../../specs/organizer-post-match-handoff-spec.md)「聯絡方式」全節（含「雙方都沒有聯絡方式」）與 Further Notes；[plan](../plan.md) 第 2 批、「安全檢查」。對應 User Stories 1–8。

**What to build:** 團主選定老師後，在需求詳情的那位老師卡片看到老師的聯絡方式，建課區塊看得到老師的可配合時段；被選定的老師從選定通知直接到自己的回應頁，看到團體名稱與聯絡窗口和下一步說明；沒被選上的老師看不到團體聯絡窗口。雙方都缺聯絡方式時，畫面說清楚誰要補、去哪補。老師設定頁告知「被團主選定時，團主也看得到」。團主端與老師端同一張票交付，不能只做一半。

**Blocked by:** None (can start immediately)

**Status:** done

**Workflow mode:** HEAVY

**Human Gate:** yes（權限變更：誰看得到哪些聯絡欄位；另含 notification 文案與連結。產品主人 2026-10-26 已核准方向 D1＝A、D2＝A，執行仍需放行）

**Risk flags:** permission（團主可看被選定老師的 `contactInfo`；被選定老師可看團體聯絡窗口）、notification（`demand_response_selected` 文案與老師端連結）、個資揭露範圍擴大；不改 schema、不改 Auth、不改狀態機

團主端：

- [x] `src/domain/demand-response/organizer-read-service.ts`：只有 `status = selected` 的回應在 domain 層帶 `teacherProfile.contactInfo`，非 selected 的 DTO 不含這個欄位
- [x] `ResponseList.tsx` 的 selected 卡顯示「老師的聯絡方式」；`contactInfo` 為空時依團體聯絡資料是否完整（`isOrganizationContactComplete`），分別顯示 spec 的兩種說明；雙方都缺時連到 `/organizer/organizations/<團體 id>?returnTo=/organizer/demands/<需求 id>`，補完回到同一筆需求
- [x] 建課區塊時間欄上方顯示被選定老師的可配合時段與「請先跟老師確認時間再填」

老師端：

- [x] 新的 domain 讀取函式：條件「需求存在、這位老師在這筆需求有 selected 回應」寫在 WHERE，回傳團體名稱與 `contactName`、`contactEmail`、`contactPhone`；不含團主個人帳號 email
- [x] `src/app/teacher/demands/[demandRequestId]/page.tsx` 的 selected 分支顯示團體聯絡窗口；缺的欄位寫「團主尚未填寫」，三項都缺時加 spec 的提醒；「後續合作細節將另行安排」改成 spec 文案；老師沒填 `contactInfo` 時加提醒並連到 `/teacher/profile/payment`
- [x] `src/domain/class-session/teacher-next-step.ts`「等待團主建立課程」改成 spec 文案，`kind` 維持 `waiting`
- [x] `src/domain/notification/copy.ts` 的 `demand_response_selected` 老師（counterpart）與團主（self）文案改成 spec 版本
- [x] `src/domain/notification/link.ts` 的 `teacher_demand_request`：只有 `demand_response_selected` 連 `/teacher/demands/<id>`，`demand_request_cancelled` 仍連列表；動工前 `rg teacher_demand_request` 重查使用者
- [x] 老師收款與聯絡設定頁補上「被團主選定時，團主也看得到」的說明

文件：

- [x] `docs/domain/permissions.md`、`docs/domain/permissions-matrix.md` 新增兩條規則，寫清楚條件與不包含的欄位

安全與測試（smoke，一組資料：一筆需求、三位老師回應、選定一位）：

- [x] 團主只在 selected 卡看到聯絡方式；選定前任何卡都沒有；非 selected 回應的頁面 HTML 不含該老師的 `contactInfo` 字串
- [x] 另一位團主打開這筆需求 → not-found
- [x] 被選定老師看到團體聯絡窗口；另兩位沒被選上的老師、從沒回應的老師看不到
- [x] 需求取消後，原選定老師看不到團體聯絡窗口
- [x] 老師沒填 `contactInfo`：團主看到說明、老師看到提醒與連結
- [x] 需求送出後清空團體聯絡欄位：老師看到「團主尚未填寫」；老師也沒填時團主看到「雙方都沒有聯絡方式」與補資料連結，補完回到同一筆需求
- [x] 選定通知：老師連 `/teacher/demands/<id>`、團主連需求詳情；需求取消通知仍連列表
- [x] 老師總覽「等待團主建立課程」的待辦顯示新的聯絡指引文字，點擊仍到 `/teacher/demands/<id>`
- [x] 手機 390px：長 email、長電話不溢出
- [x] `tsc`、`eslint src tests`、相關 smoke 通過；完成後交獨立 review（security review）

## 進度紀錄

- 2026-10-26 完成（產品主人 2026-10-26 長任務確認單放行）：團主端 `organizer-read-service.ts` 另查 selected 那筆的 `contactInfo`（`teacherContact`，其他回應為 null）並新增 `getOwnDemandOrganizationContactStatus`；`ResponseList.tsx` 顯示老師聯絡方式與兩種缺漏說明；建課區塊加確認提醒與可配合時段。老師端 `getSelectedDemandContactForTeacher`（WHERE：這筆需求＋自己的老師資料＋selected）與回應頁的團體聯絡窗口、提醒；`teacher-next-step.ts`、`demand_response_selected` 文案、`link.ts` 的 `teacher_demand_request`（只有選定通知連單筆）；收款與聯絡設定頁補說明；`permissions.md`、`permissions-matrix.md` 新增兩條規則。smoke 新增 4 支（團主只看得到 selected、選定前看不到、他人團主 404、HTML 不含其他老師 contactInfo；老師端只有選定者看得到、取消後看不到、通知與總覽待辦連結；雙方缺聯絡方式與補資料返回），連同 `demand-response-selection`、`organizer-demand-responses`、`teacher-demand-response`、`teacher-dashboard-todo`、`notification-role-targets`、`organizer-organizations`、`demand-request-cancellation` 共 112 passed（`PORT=3300`，`freesoar_opmh_test`）。Security review（2026-10-26，獨立 sub-task）：沒有高信心問題。**待產品主人決定**：被選定後又被暫停的老師，依既有 D12（老師一律可看自己的回應）仍看得到團體聯絡窗口；要不要在暫停時隱藏，屬政策決定，本票沒有改。範圍差異：無。

<!-- codex-peer-reviewed: 2026-10-26T11:47:59Z rounds=2 verdict=approved -->
