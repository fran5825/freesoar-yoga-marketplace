# 07：暫停老師：找得到既有課程

**What to build:** 暫停中的老師能從老師專區找到已有查看資格的我的課程，理解限制，查看本人既有課程。

**Blocked by:** None（現有課程列表即可驗收；實作仍需本票 Human Gate）。

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

## 驗收條件

- [ ] 暫停者的老師專區顯示「我的課程」查看入口，可到本人列表與詳情，保留暫停原因與既有限制說明。
- [ ] 入口只補上原已允許的讀取能力；不修改 Auth、role、capability、service guard 或 permission policy，不增加建立新課／回應新需求能力。
- [ ] 未有老師資料、草稿、審核中及退回者不因這次導覽呈現取得課程能力；已通過者既有入口與操作不回歸。
- [ ] 直接進入建課或不具資格的 mutation 仍依原守門拒絕，跨老師讀取仍拒絕；不得為了讓測試通過而放寬資格。
- [ ] 手機與電腦均能找到入口，鍵盤可操作；文案不暗示已恢復審核或可繼續開課。
- [ ] outcome tests 以各 profile 狀態驗證入口與原讀寫邊界，附三種寬度的畫面檢查結果。

## 實作與驗證邊界

- 本票是既有權限下的導覽呈現，不是權限擴充，因此採 STANDARD；若實作發現原讀取權限不成立，停止改列 HEAVY decision plan。
- 不依賴新列表、申請或建課，可用既有頁面驗收；不改全站其他角色導覽。
- 執行 diff whitespace、TypeScript、ESLint、build、老師 profile 狀態導覽及直接 route／mutation 邊界 smoke。
- rollback 僅移除本票入口及相關測試／描述，不變更任何帳號狀態。
- 實作需本票範圍核准；不得擅改 rejected／approved／suspended policy。
