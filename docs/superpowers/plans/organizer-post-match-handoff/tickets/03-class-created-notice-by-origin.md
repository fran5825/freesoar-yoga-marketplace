# 03: 「課程已建立」通知依路線分文案

來源：[spec](../../../../specs/organizer-post-match-handoff-spec.md)「開放報名提醒」的「通知文案」；[plan](../plan.md) 第 1 批。對應 User Stories 12、13、14。

**What to build:** 團主媒合建課後，團主收到的「課程已建立」寫明還沒開放報名、到課程頁按「開放報名」；授課老師收到的寫明團主開放報名後學員才能報名。直接開團與老師自建課的「課程已建立」通知文字不變。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** yes（改 notification 文案，依 `docs/harness/risk-based-workflow.md` 第 6 節需要產品主人放行）

**Risk flags:** notification：共用的 `class_session_created` 通知類型被三條建課路線使用，只能改媒合建課這一條的內容

- [ ] `src/domain/notification/copy.ts` 的 `class_session_created` 新增選填參數（例如 `notYetOpen`），有傳時用 spec 的團主與老師文案；`src/domain/notification/types.ts` 的參數型別同步
- [ ] 只有 `src/domain/class-session/__internal__/create-class-session-core.ts` 傳這個參數
- [ ] `open-direct-class-core.ts`、`create-teacher-class-session-core.ts` 不改；`teacher-initiated-open-classes.spec.ts`、`teacher-series-rollup.spec.ts` 不改且仍通過
- [ ] email 文字跟站內一致（email 沿用同一份 copy 時自動一致；若 `email-copy.ts` 另有文字，一併處理）
- [ ] 舊通知不回填
- [ ] smoke：用 `notifyOverride` 攔截或讀通知資料，驗媒合建課的團主、老師文案；直接開團、老師自建課各驗一次文字不變
- [ ] `tsc`、`eslint src tests`、相關 smoke 通過

## 進度紀錄

<!-- codex-peer-reviewed: 2026-10-26T11:47:59Z rounds=2 verdict=approved -->
