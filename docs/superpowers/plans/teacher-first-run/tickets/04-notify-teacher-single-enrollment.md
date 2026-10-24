# 04: 單堂報名與取消時通知老師

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 「報名送出即成立」的單堂課有人報名，老師收到站內通知「『課名』有新的報名」；學員自己取消單堂報名，老師也收到站內通知。單則通知點了直達該堂課的老師頁；同一系列同一天合併後，照 ADR 0008 連到老師的系列頁。學員收到的通知完全不變。

**Blocked by:** None (can start immediately)

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 通知收件人增加（不改權限、不寄 email）

- [x] 報名即成立的單堂報名：老師收到一則站內通知、帶老師單堂 target；學員通知文案與連結不變
- [x] 需要確認的課維持既有待確認通知，不多發
- [x] 學員自己取消單堂報名：老師收到站內通知；老師或管理員自己婉拒或取消時不通知老師本人
- [x] 老師不會因為自己操作收到自己的通知
- [x] 合併後的老師通知連到老師系列頁，不是最新一堂
- [x] 同時是老師與學員的帳號，以學員身分收到的通知目的地不變
- [x] EMAIL_POLICY 不加老師
- [x] smoke 測試涵蓋單則、合併、雙重身分

## 進度紀錄

- 2026-10-24 程式與 smoke 測試（`tests/smoke/teacher-enrollment-notifications.spec.ts`）已寫好，tsc／lint 通過；本機 Postgres（Docker）沒有啟動，smoke 尚未執行。範圍差異：整期學員的單堂請假也走 `cancelOwnEnrollment`，依 teacher-class-scheduling 推導規則 10 不通知老師（待產品主人確認）。
- 2026-10-24 完成：migration 套用到 `freesoar_tfr_b`，`teacher-enrollment-notifications.spec.ts` 等相關 smoke 通過；請假是否通知老師已由產品主人決定（見票 05）。
