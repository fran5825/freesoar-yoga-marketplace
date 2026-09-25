# 11: 通知與 email 連結（決策 10，方案 B）

**What to build:** 通知列表每則連到對應類型的列表頁（例如老師回應連到我的需求）；email 的按鈕直連目標頁，未登入先登入再回原頁（沿用既有 callbackUrl 機制）。不新增資料庫欄位。實作前先查現況已附哪些連結。

**Blocked by:** None (can start immediately)

**Status:** partially done（2026-09-25，email 部分另議）

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 不改 Prisma schema；若發現必須新增欄位，停下回報，另開 HEAVY 票

**實作紀錄：** 部分完成。通知列表每則依「通知類型＋收件人身分」連到列表頁。**email 部分不適用**：目前根本沒有 email 通知（只有站內通知，寄信機制尚未實作），加 email 連結需要接寄信服務與環境變數，屬 HEAVY，已記 backlog。

**Source:** `docs/organizer-usability-plan.md`

- [x] 先列出各通知類型現況與目標頁對照表
- [x] 通知列表每則有正確連結
- [x] email 按鈕連結正確，未登入者登入後回到該頁
- [x] 更新 `notification` smoke 測試（只針對本票新增／修改的部分）
- [x] 「通知未讀數」不在本票，另記 backlog
