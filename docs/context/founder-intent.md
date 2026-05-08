# Founder Intent

## 1. 文件目的

本文件不是私人日記，也不是創辦人的個人生命故事紀錄。

本文件的目的，是讓 Codex / AI agent 在協助 Free Soar Yoga 進行規劃、實作、測試與 review 時，能理解產品背後較深層的方向、判斷原則與協作節奏。

當 AI 需要判斷一個功能、文案、流程或工程取捨是否適合 Free Soar Yoga 時，本文件可作為 context 之一，與 `brand-rules.md`、`voice-and-tone.md`、`visual-direction.md`、V1 scope、permissions、state machines 等文件一起參考。

## 2. 創辦初衷

Free Soar Yoga 不只是瑜伽 booking 工具，也不是冷冰冰的 marketplace。

它希望透過瑜伽、身心整合、社群與科技支持，建立一個更自由、更安住、更可信任的練習場域。這個產品的出發點不是單純追求更多交易，而是讓人更容易找到適合自己的身心練習，也讓老師、團主與成員能在清楚、安全、有品質的流程中共同成就一堂課。

Free Soar Yoga 是 Free Soar master brand 的第一階段產品入口。它從瑜伽團課 marketplace 開始，但要保留人的溫度、選擇的自由、練習的品質與社群共創的可能性。

## 3. Product Heart

Free Soar Yoga 的核心不是單純媒合供給與需求。

本產品要幫助 organizers、teachers、members 與 platform admins 共同建立高品質、可持續的身心練習社群：

- organizers / group leaders 能清楚表達團體需求，找到合適的老師與課程安排。
- teachers 能被專業地呈現與尊重，回應真正適合自己的教學機會。
- members / students 能在可信任的場域中參與練習，逐步建立穩定的身心照顧節奏。
- platform admins 能守住品質、安全、流程清楚度與平台信任。

因此，每一個功能都應服務「更清楚、更安心、更可持續的練習關係」，而不是只服務更快的操作或更多的轉換。

## 4. People First Principles

### Yoga teachers

Yoga teachers 不是可被價格排序與大量替換的商品。

平台應尊重老師的專業、教學風格、時間、界線與成長路徑。老師 profile、availability、demand response 與 admin review 都應幫助老師被正確理解，而不是被壓縮成單一價格或片面的排名。

### Organizers / group leaders

Organizers / group leaders 是團體練習的發起者與照顧者。

平台應幫助他們清楚整理需求、理解可行的課程形式，並在適合的流程中與老師建立信任。產品不應鼓勵模糊需求、低價競標或倉促成團。

### Members / students

Members / students 是實際進入練習的人。

平台應讓他們清楚知道課程內容、時間、地點、適合程度與報名狀態。會員體驗應降低不確定感，避免焦慮式推銷，也不應過度承諾身心轉變。

### Platform admins

Platform admins 是平台品質、安全與信任的守門人。

Admin tools 應支援審核、管理、例外處理與基本 reporting，但不應變成過度複雜的 enterprise system。Admin 權限與操作必須清楚、可審查，並符合 V1 scope。

## 5. What We Must Protect

Free Soar Yoga 在成長與實作過程中，必須守住以下原則：

- 不把老師商品化。
- 不用低價競標破壞信任。
- 不用焦慮式轉化文案推動報名或申請。
- 不用 AI 取代人的判斷、照顧、審核與關係建立。
- 不為了速度犧牲安全、權限、品質審核與資料邊界。
- 不為了工程完整而過度工程化，尤其不在 V1 提前建立不必要的複雜架構。

若某個功能會讓平台變得更快，但同時降低信任、尊重、清楚度或安全性，應先停下來提出 options and tradeoffs。

## 6. AI Collaboration Intent

Codex / AI 在本 repo 中的角色，是協助產品主人與開發流程更清楚、更穩定、更低耗能地前進。

AI 可以協助：

- 釐清需求與產品邊界。
- 整理 spec、plan、review checklist 與文件。
- 實作已確認範圍內的功能。
- 撰寫與執行適當的測試。
- 檢查 brand、security、RWD、permission、state machine 與 V1 scope 一致性。

AI 不應：

- 替產品主人做核心產品判斷。
- 自動擴大 scope。
- 把產品做成 generic SaaS、generic booking tool 或純交易平台。
- 在沒有說明影響與取得確認前，改動 Auth、Prisma schema、role / permission model、state machines 或核心 user flows。
- 為了展示能力而增加不必要的功能、抽象層或流程。

遇到價值衝突時，AI 應提出 options and tradeoffs，而不是默默選擇一個方向。AI 的工作應幫助降低認知負擔，而不是製造更多複雜度。

## 7. Decision Compass

Codex / AI 在進行 planning、implementation 或 review 時，可以自問：

- 這是否支持自由、覺醒、成長、身心整合與社群？
- 這是否尊重老師、團主與使用者？
- 這是否仍符合 V1 marketplace，而不是提前擴張成完整 Life Platform？
- 這是否讓流程更清楚、更安心，而不是更焦慮？
- 這是否符合 MVP-first、低耗能、可持續的開發節奏？

若答案不清楚，應先回到 docs、提出風險與選項，並請產品主人確認。
