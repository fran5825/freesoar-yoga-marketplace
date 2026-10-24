# 08: 總覽「開始使用」與通過通知

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 剛通過審核的老師，總覽最上方出現「開始使用」：填收款與聯絡、開第一堂課、公開我的老師頁（可跳過），每步依現有資料自動打勾，下方有「看看團體需求」。三步完成或按「先不用」就收起來。暫停中的老師不顯示。通過通知改成同時提到開自己的課與回應團體需求，點了到老師總覽。

**Blocked by:** 07（「公開我的老師頁」要連到新位置）

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 不新增 schema 欄位。切票時已查證：沒有適合存放這類介面偏好的既有欄位，所以採 spec 的替代規則：1、2 兩步完成就自動收起；「先不用」只記在這個瀏覽器（讀寫都要包 try/catch，讀不到就照常顯示）

- [x] approved 且未完成的老師在總覽看到開始使用三步，順序與完成判斷照 spec
- [x] suspended、未通過的老師看不到
- [x] 1、2 兩步完成後自動收起（不論第 3 步）；按先不用後，同一個瀏覽器重新整理仍收起
- [x] 完成判斷邏輯在 domain 層
- [x] 通過通知文案更新，連結到老師總覽
- [x] 375px 手機寬度無橫向溢出
- [x] smoke 測試通過（teacher-dashboard、notification）

## 進度紀錄

- 2026-10-24：domain `get-started.ts` 判斷三步與收起，總覽 `GetStartedCard` 只顯示；「先不用」存 localStorage（try/catch）；通過通知改文案並連到老師總覽；smoke teacher-dashboard 26（含 375px 無溢出）、teacher-dashboard-todo 4、notification 22 全數通過。
