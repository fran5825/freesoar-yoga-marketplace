# 09: 審核中畫面的三件事、退回通知改成可修正語氣

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 審核中的申請狀態畫面加「通過後你會先做的三件事」（與開始使用三步一致，只是說明）。退回通知改成「需要補充」與「修改後可以重新送出」的語氣，原因照舊附上。審核中的權限不變。

**Blocked by:** 08（三件事的內容要和開始使用一致；同改通知文案）

**Status:** done

**Workflow mode:** LIGHT

**Human Gate:** no

**Risk flags:** 無

- [x] 審核中畫面列出三件事，內容與開始使用一致
- [x] 審核中仍不能編輯老師資料各分頁
- [x] 退回通知新文案含原因與可重新送出
- [x] 相關 smoke 測試通過（teacher-join、notification）

## 進度紀錄

- 2026-10-24：審核中摘要加「通過後你會先做的三件事」（與開始使用共用 `get-started-steps.ts`），退回通知改成需要補充、修改後可重新送出；smoke teacher-join 26、notification 22 全數通過。
