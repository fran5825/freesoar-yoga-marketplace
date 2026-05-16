# `.ai-runs/current/` Minimal Run Folder Spec

本文件定義 Free Soar Yoga marketplace 專案中 `.ai-runs/current/` 的最小資料夾規格。

此資料夾是 local-only，用於穩定手動 ChatGPT ↔ Codex App 協作流程。

目前不接 automation、不接 Hermes、不接 Telegram、不要求機器讀寫。

---

## 目標

`.ai-runs/current/` 的目標是：

1. 保存本次任務的原始需求
2. 保存 Codex triage 結果
3. 保存 ChatGPT governance review
4. 保存 approved Builder prompt
5. 保存 Builder review packet
6. 保存 ChatGPT final review
7. 讓人類可以回看一次 AI 協作任務是如何被判斷、執行與審核的

---

## 原則

- local-only
- MVP first
- low overhead
- manual friendly
- 不作為正式產品文件
- 不取代 `docs/`
- 不要求每次都永久保存
- 不放秘密資訊
- 不放 `.env`
- 不放 token / key / credential
- 不放個資或客戶敏感資料
- 不放大型 build output

---

## 建議 `.gitignore`

建議在 `.gitignore` 加入：

```txt
.ai-runs/
```

若未來要保存某次重要 run，請人工整理後移到正式 docs，例如：

```txt
docs/work-notes/
docs/harness/cases/
```

---

## Minimal Folder Structure

```txt
.ai-runs/current/
  00-task-request.md
  01-codex-triage.md
  02-chatgpt-governance-review.md
  03-approved-builder-prompt.md
  04-builder-review-packet.md
  05-chatgpt-final-review.md
  06-human-decision-record.md
```

---

## File Purpose

### `00-task-request.md`

保存原始任務。

建議格式：

```md
# Task Request

## Date

YYYY-MM-DD

## Repo State

- Repo:
- Branch:
- Remote sync:
- Working tree:

## Task

[貼上原始任務]

## Human Constraints

- ...
```

---

### `01-codex-triage.md`

保存 Codex repo-aware triage 結果。

來源：

```txt
docs/prompts/codex-repo-aware-triage-prompt.md
```

---

### `02-chatgpt-governance-review.md`

保存 ChatGPT 對 Codex triage / planning draft 的 governance review。

來源：

```txt
docs/prompts/chatgpt-governance-review-prompt.md
```

---

### `03-approved-builder-prompt.md`

保存最後核准給 Codex Builder 執行的 prompt。

此檔案很重要，因為 Builder Review Packet 必須對照它檢查是否超出 scope。

---

### `04-builder-review-packet.md`

保存 Codex Builder 完成後的回報。

來源：

```txt
docs/harness/builder-review-packet-template.md
```

必須包含：

- task request
- approved prompt
- changed files
- git diff
- checks result
- implementation summary
- risk notes
- unfinished items

---

### `05-chatgpt-final-review.md`

保存 ChatGPT final review。

必須包含：

```txt
Verdict:
- APPROVE
- APPROVE WITH MINOR NOTES
- REQUEST CHANGES
- BLOCKED
```

也必須檢查：

- diff
- changed files
- checks result
- scope
- risk
- forbidden files
- human gate
- unfinished items

---

### `06-human-decision-record.md`

保存人類決策。

例如：

```md
# Human Decision Record

## Decision

- Approved
- Rejected
- Needs changes
- Deferred

## Reason

- ...

## Next Action

- commit
- push
- ask Codex to revise
- split next slice
- stop
```

---

## Recommended Manual Flow

```txt
1. 人類寫任務
   -> .ai-runs/current/00-task-request.md

2. Codex 做 repo-aware triage
   -> .ai-runs/current/01-codex-triage.md

3. ChatGPT 做 governance review
   -> .ai-runs/current/02-chatgpt-governance-review.md

4. 人類確認 approved Builder prompt
   -> .ai-runs/current/03-approved-builder-prompt.md

5. Codex Builder 執行
   -> .ai-runs/current/04-builder-review-packet.md

6. ChatGPT final review
   -> .ai-runs/current/05-chatgpt-final-review.md

7. 人類決定 commit / push / revise / stop
   -> .ai-runs/current/06-human-decision-record.md
```

---

## What Should Not Go Here

不要放：

- `.env`
- API key
- token
- password
- private credential
- 客戶資料
- production secret
- node_modules
- build output
- `.next`
- large logs
- unrelated screenshots
- unreviewed AI dumps

---

## When to Promote to Official Docs

只有在某次 run 產生可重用規則時，才整理進正式 docs。

適合沉澱的內容：

- 新 workflow rule
- 新 risk pattern
- 新 review checklist
- 新 prompt pattern
- 新 agent role
- 新 MVP slicing principle
- 新 human gate rule

不適合沉澱的內容：

- 一次性的任務記錄
- 某次 Codex 回答全文
- 只對單一 bug 有用的資訊
- 未驗證的 AI 建議
