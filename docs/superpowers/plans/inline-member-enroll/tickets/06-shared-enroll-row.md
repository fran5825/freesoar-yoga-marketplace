# 06: 共用「報名列」元件、列狀態、返回與價格規則

來源：[spec 2.1、2.2、2.3、Q3、Q5、Q6、Q7](../../../specs/member-inline-enroll-spec-draft.md)。

**What to build:** 一個三處列表共用的「場次列」。service layer 依「使用者在這一堂的報名紀錄＋這一堂目前能不能報」算出列狀態與要顯示的動作；元件只顯示。按「報名」或「重新報名」後在列下方就地展開：這一場的價格與繳費規則（唯讀）、同意勾選、「加備註」（預設收起）、確認按鈕。送出與登入後都回到來源頁並捲到該列。

**Blocked by:** `inline-member-actions` 合併進 `main`

**Status:** 待開始

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 改報名入口與返回路徑白名單（要維持只接受站內路徑）；不改驗證與資料。

- [ ] 列狀態由 service layer 計算，涵蓋 spec 2.1 全部情況（可報名、額滿／不開放／已開始／老師非 approved、單堂 `pending`／`confirmed`、整期列沿用 `TermRowControl`、自己取消可重新報名、老師婉拒／管理員取消／退出整期不可重報只顯示原因）
- [ ] 列表用的 read service 補讀每一場的使用者報名紀錄、`priceNote`、`paymentRulesText`（期班頁與系列頁原本沒有）
- [ ] 元件：列、就地展開表單、「加備註」（沿用 `OptionalNotes`）、訪客展開登入選項
- [ ] 穩定列 ID `session-row-<classSessionId>`；返回路徑白名單擴充到系列頁、單堂頁、期班頁（維持站內路徑限制）；redirect 帶 `result`、`message`、`focus`，失敗帶 `open`（以重新讀取後仍可報名才保持展開，否則顯示原因並把失敗訊息放在該列上方）
- [ ] 共用回饋呈現：頁面頂部成功／失敗訊息區塊（讀 `result`、`message`）、`focus`／`open` 的處理（捲到該列、依最新狀態決定是否保持展開）做成各頁都能直接掛上的共用部分，三個頁面票只負責掛上與驗收
- [ ] 登入 action 帶來源頁與 `open=<列 ID>`，回來自動展開、仍需本人勾選同意才送出
- [ ] 需老師確認的課程，展開後按鈕文字為「送出報名申請」、一般課程為「確認報名」（Q3 文案驗收）
- [ ] 單元測試：列狀態每一種情況；返回路徑白名單（站內接受、外部網址與其他來源拒絕）

<!-- 驗收測試放在票 07、08、09 各自的頁面測試 -->

<!-- codex-peer-reviewed: 2026-10-10T04:28:50Z rounds=2 verdict=approved -->
