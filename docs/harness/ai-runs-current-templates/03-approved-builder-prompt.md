# Approved Builder Prompt

## Purpose

本模板用來保存人類或 ChatGPT governance review 已核准的 Builder prompt。Builder 必須只依本檔授權執行，完成後用 `04-builder-review-packet.md` 回報。

請不要在本檔放入 token、credential、production data、客戶敏感資料或 `.env` 內容。

本模板只保存已批准的 Builder prompt，不取代 `Planning / Orchestrator`。若尚未取得 product owner 或 ChatGPT governance review 的明確批准，Codex 不得使用本模板直接進入 Builder。

## Builder Prompt Checklist

每份 approved Builder prompt 至少必須包含：

- approved goal
- allowed files
- forbidden files
- completion criteria
- stop conditions
- checks
- final report requirement
- no commit / push
- Recommended Next Step

若上述任一項不清楚，Builder 不得開始實作，應回到 `Planning / Orchestrator` 或 `Product Owner Decision`。

## STANDARD 精簡版本

已核准 STANDARD 任務可用以下六項取代展開全部欄位。這是同一模板的精簡填法，不產生新授權；依 `../risk-based-workflow.md` 的「STANDARD 精簡執行」，引用必須可讀、範圍與 checks 必須明確。沒有核准的 source 清單仍須先落實，不能只引用功能票冒充 allowed files。

```text
任務：[核准目標、單票或明確核准的多票順序與接續邊界]
依據：[AGENTS.md、spec、plan／索引、當前票；以 acceptance criteria 為準，不重抄]
範圍：[具體 allowed files 或已核准清單的引用；禁止事項與不得 commit／push]
驗證：[必要 checks 與畫面檢查；引用已核准安排，production smoke 必須測最新 build]
停止：[越界、未核准 policy、衝突或無法在範圍內修復的失敗，回報具體證據]
交付：[每票短紀錄；任務完成、移交或阻塞時依本模板 Output Requirements
       提供完整結果，正式 packet 包含 review-packet-spec.md 的 Common Handoff Schema]
```

每票紀錄與最後正式報告的差異依 `../review-packet-spec.md`；HEAVY 仍用完整 planning／decision／Builder 欄位。以下完整欄位與 Output Requirements 保留作為正式交付依據。

已核准 HEAVY 多票可依 `../risk-based-workflow.md` 的「已核准 HEAVY 多票紀錄」引用原批准並累積完整證據；正式 gate／review／交接提供以下完整材料，不逐票重抄同一報告。接續須核對當票核准、範圍、依賴、checks 與 review，不由此模板新增授權。

## Approved Task

```txt
[貼上本輪 approved task]
```

## Automation Level

- Level:
- Risk level:
- Human gate status:

## Allowed Files

```txt
[列出本輪唯一允許新增或修改的檔案]
```

## Forbidden Files

```txt
[列出本輪禁止修改的檔案、資料夾、系統區域與高風險範圍]
```

## Accepted Decisions

- `[列出 governance review 或 human decision 已接受的決策]`

## Implementation Requirements

- `[列出 Builder 必須完成的具體要求]`

## Checks

```txt
[列出 Builder 完成後必須執行的 checks；若不需 lint/typecheck/build/test，請寫明原因]
```

## Baseline / Patch Evidence

依 `../risk-based-workflow.md` 的「未 commit 的 Baseline 與 Patch」填寫，不要求 commit，也不改 index。

```text
Run／manifest／快照位置：[獨立 local-only 目錄，不覆寫其他 run]
比較起點：[task-start；多票另列 ticket-start]
涵蓋範圍：[allowed files、既有 dirty／untracked 與新增／刪除／改名]
完整 patch／checks 位置：[Reviewer 可讀；排除其他任務 diff]
同檔外部修改：[如何核對預期版本；無法歸因則停止]
```

## Database Operation Authorization

只在涉及 migration／DB 操作時填寫；其他任務寫「不適用／未授權」。規則依 `../risk-based-workflow.md` 的「Migration 操作授權」。以下空白與 placeholder 不構成放行；不要記錄 `.env`、credentials 或完整連線字串。

```text
Authorization status：[未授權／已明確核准；批准者與 decision 引用]
Target DB：[非敏感 identifier；disposable fixture／含真實資料 dev／preview／production]
Isolation／target verification：[實際目標符合批准的證據；不能只填 port]
Shadow DB：[不使用／核准目標、隔離與允許操作；未知則停止]
Generate migration：[未授權／確切命令、參數、SQL 範圍與前置]
Apply migration：[未授權／確切命令、參數、目標與前置]
Backfill／seed：[未授權／確切命令、資料範圍與完整性檢查]
Rollback／data protection：[可回復方式、限制、必要備份／重建安排]
Checks：[SQL review、資料／權限／並發等適用驗證與 evidence]
Stop conditions：[目標不符／不明、drift、reset／資料損失提示、歧義或越界]
Excluded actions：[未批准的 production／破壞性 contract／db push／reset 等]
```

## Output Requirements

Output Report Requirement:
完成後請不要 commit / push，並回報：
1. Changed files
2. Full git diff
3. Checks result
4. Manual smoke result
5. Self review
6. Scope drift check：是否有任何超出本任務範圍的修改或判斷

## No Commit / No Push Reminder

- Do not commit.
- Do not push.
- Do not modify forbidden files.
- Do not expand scope beyond this approved prompt.
