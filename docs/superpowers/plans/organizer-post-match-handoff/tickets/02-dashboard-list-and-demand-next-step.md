# 02: 總覽待辦、課程列表、需求下一步

來源：[spec](../../../../specs/organizer-post-match-handoff-spec.md)「開放報名提醒」的「總覽「待你處理」」「入口完整性」「課程列表」「需求下一步」；[plan](../plan.md) 第 1 批。對應 User Stories 9、10、15。

**What to build:** 團主建完課離開後，總覽「待你處理」會出現還沒開放報名的課，點了直達那堂課，開放後自動消失；「我的課程」列表的草稿卡片寫明學員看不到或已過期；需求的下一步說法跟課程實際狀態一致（需求列表、總覽、需求詳情三處說法相同）。

**Blocked by:** 01：草稿判斷與課程頁說明

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** Prisma read（不改 schema）：需求摘要查詢多讀關聯課程的 `status`、`startAt`

- [x] 新增團主課程待辦組成函式（domain 層，比照 `src/domain/organizer-class-proposal/todo.ts`），只列自己的「可開放的草稿」（用票 01 的判斷函式）；已過期草稿不列
- [x] `src/app/organizer/dashboard/page.tsx` 的「待你處理」顯示這些項目，文字與連結照 spec；有這類項目時整張卡要出現（目前只有需求或邀請待辦時才出現）
- [x] 按「開放報名」成功後，該項目不再出現
- [x] `src/app/organizer/classes/page.tsx` 草稿卡片多一行：可開放「還沒開放報名，學員看不到」、已過期「開課時間已過，沒有開放報名」
- [x] `src/domain/demand-request/service.ts` 的 `ownDemandRequestSummarySelect` 讓 `classSession` 多讀 `status`、`startAt`，在 domain 層算出草稿種類放進 `OwnDemandRequestSummary`；需求詳情若用不同查詢，同樣補上
- [x] `src/domain/demand-request/next-step.ts` 的 `converted_to_class` 依草稿種類給 spec 的文案（`message` 與列表用的 `shortMessage` 都要分種類），`kind` 維持 `info`；沒傳時維持現有文案
- [x] 需求列表、總覽、需求詳情（`NextStepCard.tsx`）三處都傳同一個值
- [x] 總覽的呈現位置：「待你處理」維持只收 `kind === "action"` 的需求（不改過濾，避免需求與課程待辦重複）；`converted_to_class` 的說法改顯示在總覽下方「我的需求」卡片（目前只有名稱、狀態、更新時間），加一行 `shortMessage`
- [x] smoke：三處各驗「可開放草稿／已過期草稿／已開放」三種結果；總覽待辦出現、點擊直達、開放後消失
- [x] smoke：已過期草稿**不出現**在總覽「待你處理」
- [x] smoke：「我的課程」列表的可開放草稿、已過期草稿、已開放課程三種卡片，各自出現或不出現說明行
- [x] `tsc`、`eslint src tests`、相關 smoke 通過

## 進度紀錄

- 2026-10-26 完成：需求摘要查詢多讀課程 `status`、`startAt`，在 domain 層算出 `classDraftKind`（`OwnDemandRequestSummary`）；`getDemandNextStep` 依它分兩種說法，需求列表、總覽、詳情三處都傳；總覽「待你處理」加課程待辦（`src/domain/class-session/organizer-class-todo.ts`，只列可開放的草稿），「我的需求」卡片加下一步短句；課程列表草稿卡片加說明行。smoke 新增 4 支（三種狀態 × 三處＋待辦點擊與開放後消失），連同 `organizer-dashboard`、`organizer-demand-next-steps`、`organizer-demand` 共 52 passed（`PORT=3300`，`freesoar_opmh_test`）。範圍差異：無。

<!-- codex-peer-reviewed: 2026-10-26T11:47:59Z rounds=2 verdict=approved -->
