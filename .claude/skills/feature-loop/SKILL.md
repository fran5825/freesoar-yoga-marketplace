---
name: feature-loop
description: "一次跑完 Free Soar 功能閉環：grill → spec → tickets → implement → code-review／spec-review → 畫面驗收 → retro。只在需要產品主人的關卡停下來，其餘自動接下一步。用法：/feature-loop <功能的一句話描述或 feature-slug>"
disable-model-invocation: true
---

# Feature Loop（功能閉環總指揮）

產品主人只打一次指令，你就照順序走完整個閉環。各階段的做法寫在各自的 skill 裡，**你負責接力和守關卡，不要自己另外發明做法**。

## 怎麼執行每個階段

下面幾個 skill 設了 `disable-model-invocation`，不能用 Skill tool 呼叫。輪到它們時，用 Read 讀它的 `SKILL.md`（同資料夾的參考檔要用到再讀），然後照內容做；開頭的「Free Soar Yoga 專案覆寫」一樣優先：

- `.claude/skills/grill-with-docs/SKILL.md`（它會叫你用 Skill tool 呼叫 `grilling` 和 `domain-modeling`，這兩個可以直接呼叫）
- `.claude/skills/to-spec/SKILL.md`
- `.claude/skills/to-tickets/SKILL.md`
- `.claude/skills/implement/SKILL.md`
- `.claude/skills/implement-spec/SKILL.md`
- `.claude/skills/retro/SKILL.md`

`tdd`、`spec-review` 和內建的 `code-review` 照各 skill 的指示用 Skill tool 呼叫。

## 進度檔（中斷後可以接續）

切票之後，在 `docs/superpowers/plans/<feature-slug>/loop-status.md` 記錄目前走到哪一階段、哪些關卡已放行（附日期和產品主人的原話）、下一步要做什麼。每過一個階段或關卡就更新。

開始時先找有沒有這份檔案，或已經存在的 `docs/specs/<feature-slug>-spec.md`、`tickets/`。有的話，跟產品主人說「上次走到哪裡、接下來從哪一步開始」，確認後從那一步繼續，不要重做已完成的階段。

## 階段與關卡

每到 🛑 關卡就停下來，用白話寫一小段摘要問產品主人，等明確回答才繼續。沒有 🛑 的轉場不要停，直接接下一步，同一則訊息裡用一句話說「已完成 X，接著做 Y」。

1. **想清楚**：照 `grill-with-docs` 做。
   - 🛑 問題本身就是關卡：每一輪都等產品主人回答。
   - 所有決定都清楚後，用一句話總結，直接進下一步。
2. **寫 spec**：照 `to-spec` 做。
   - 🛑 寫完後列出 spec 路徑和 3～5 行重點（做什麼、不做什麼、標「需產品主人確認」的項目），問「範圍對嗎？」。
3. **切票**：照 `to-tickets` 做，並建立進度檔。
   - 🛑 列出票的清單、每張的 Workflow mode／Human Gate，HEAVY 的票另外集中列出，再一次問兩件事：票切得對不對、哪些 HEAVY 票放行。
   - 產品主人說「全部放行」或「一次放行」，就把所有票視為已放行，寫進進度檔；之後不用逐票再問。
4. **實作**：
   - 票少於 4 張，或彼此都要排隊做：照 `implement` 一張一張做。
   - 票 4 張以上而且有幾張能同時做：照 `implement-spec` 做。
   - 每張票完成就更新票的 Status 和進度檔，直接接下一張；沒放行的 HEAVY 票先跳過，最後一起問。
   - 審查（內建 `code-review` 再 `spec-review`）由 `implement` 負責。審查結果屬於產品決定的，累積起來到下一關一起問，不要每張票停一次。
   - 🛑 只有這些情況要中途停下來：驗證失敗而且試兩次修不好、需要改 spec 範圍、遇到沒放行的 HEAVY 票、要碰正式環境或刪除資料。
5. **收尾**：
   - 🛑 全部票做完後，一次回報：改了哪些檔案、驗證結果（typecheck／lint／smoke test 哪些過、哪些沒跑）、兩種審查的重點、累積的產品決定。接著問要不要 commit。產品主人說要才 commit，不要 push。
6. **畫面驗收**（有畫面改動才做；純後端或文件可跳過，在進度檔寫明原因）：
   - 收尾時整理驗收清單：每一項寫出要看的畫面、預期結果，以及**需要的帳號身分與測試資料**（例如「學員帳號」「待審的團體需求」「剛通過審核、沒有課的老師」）。
   - 照 `docs/harness/visual-acceptance-runbook.md` 準備環境，缺的帳號或資料開始前一次跟產品主人講。
   - 開始看第一個畫面前，先跟產品主人說：「看到想改的地方直接講，我先記成發現，全部看完再一起決定這輪修還是記進 backlog」。
   - 🛑 產品主人親自看，一個畫面回報一次；結果寫進驗收票（通過、發現、未驗）。全部看完後，列出發現請產品主人決定：這輪修，或記進 `docs/backlog.md`。這輪要修的照 `implement` 的驗證與審查做，修完問要不要 commit。
7. **回顧**：照 `retro` 做。
   - 🛑 依嚴重度列出建議，請產品主人挑要採用哪幾條。挑完照著改（改 checklist、AGENTS.md 等），改完再問一次要不要 commit。
   - 在進度檔標記「閉環完成」。

## 硬規則

- 關卡不能自己跳過，也不能用「應該沒問題」代替產品主人的回答。之前階段的放行不等於後面階段的放行。
- AGENTS.md 的 commit／push gate、Human Gate、V1 scope 都照舊，這個 skill 不放寬任何一條。
- 對話太長、需要換新對話時，先把進度檔更新好，再告訴產品主人：「開新對話打 `/feature-loop <feature-slug>` 就會從這裡接續」。
