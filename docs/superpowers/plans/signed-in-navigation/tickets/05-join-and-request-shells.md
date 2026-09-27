# 05: 老師合作、發起團課：登入後用專區導覽列（決策 1、2）

**What to build:** 已登入的人開 /teachers/join：有老師資料（草稿、審核中、退回）用老師專區導覽列、沒有老師資料用學員專區；已通過或已暫停照舊導到老師總覽。開 /organizers/request：已是團主照舊導到發起新需求，還不是用學員專區。頁面內容不變。

**Blocked by:** 03

**Status:** done（2026-09-27）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 老師、團主 session 的頁面，只改外框；保留原本的 redirect。

**Source:** `docs/signed-in-navigation-plan.md`

- [x] 審核中老師開 /teachers/join 看到老師專區導覽列與角色切換
- [x] 沒有老師資料的學員開 /teachers/join、/organizers/request 看到學員專區導覽列
- [x] 訪客照舊公開 header；原本的導向不變
- [x] teacher-join、organizers-request 等既有測試通過

**實作紀錄：** `/teachers/join` 已有老師資料用 `TeacherShell`（審核中老師看得到角色切換），沒有用學員；approved/suspended 導向保留。`/organizers/request` 登入用學員；已是團主的導向保留。頁面內容未動。

驗證：build、tsc、eslint 通過；整套 smoke 測試 590 支中 587 通過，3 支失敗已處理（團主通知測試依決策 3 改為先進團主專區，重跑通過；老師申請頁一支在整套負載下載入逾時，單獨重跑 3 輪全過）；新增 `tests/smoke/signed-in-navigation.spec.ts` 桌機＋手機 10 支全過。
