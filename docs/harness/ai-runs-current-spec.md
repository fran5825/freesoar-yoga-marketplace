# `.ai-runs/current/` Minimal Run Folder Spec

本文件定義 Free Soar Yoga marketplace 專案中 `.ai-runs/current/` 的最小資料夾規格。

此資料夾是 local-only，用於穩定手動 ChatGPT ↔ Codex App 協作流程。

目前不接 automation、不接 Hermes、不接 Telegram、不要求機器讀寫。

Reusable templates 的正式來源是：

```txt
docs/harness/ai-runs-current-templates/
```

每次任務可以手動複製 templates 到 `.ai-runs/current/` 後填寫；`.ai-runs/current/` 本身不應 commit。

---

## 目標

`.ai-runs/current/` 的目標是：

1. 保存本次任務的原始需求
2. 保存 Codex planning report
3. 保存 ChatGPT governance review
4. 保存 approved Builder prompt
5. 保存 Builder review packet
6. 保存 ChatGPT final review
7. 保存 human decision record
8. 讓人類可以回看一次 AI 協作任務是如何被判斷、執行與審核的

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
- 不 commit `.ai-runs/current/`

---

## 建議 `.gitignore`

`.ai-runs/current/` 必須維持 local-only。Repo 應在 `.gitignore` 保留：

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
  01-planning-report.md
  02-chatgpt-governance-review.md
  03-approved-builder-prompt.md
  04-builder-review-packet.md
  05-chatgpt-final-review.md
  06-human-decision-record.md
```

---

## Reusable Template Source

正式可 commit 的模板檔放在：

```txt
docs/harness/ai-runs-current-templates/
  00-task-request.md
  01-planning-report.md
  02-chatgpt-governance-review.md
  03-approved-builder-prompt.md
  04-builder-review-packet.md
  05-chatgpt-final-review.md
  06-human-decision-record.md
```

單一任務可沿用上述 flat 結構；有其他 task 或需保存 baseline 時，使用獨立 `.ai-runs/current/<run-id>/`，在自己的 run 內複製模板。不要清空或覆寫共享 current／其他 run；清理與封存仍須另有明確授權。

---

## Baseline 與多任務證據

共用操作規則見 [risk-based workflow](risk-based-workflow.md#10-未-commit-的-baseline-與-patch)，此處只定義保存位置，不新增 capture 工具、commit 或資料庫授權。

```txt
.ai-runs/current/<run-id>/
  baseline-manifest.json
  initial-status.txt
  initial-head.txt
  baseline/task-start/<allowed-relative-path>
  baseline/ticket-<id>-start/<allowed-relative-path>
  snapshots/ticket-<id>-end/<allowed-relative-path>
  patches/ticket-<id>.patch
  patches/task.patch
  checks/
  04-builder-review-packet.md
```

- run-id 使用不碰撞的任務／日期／識別值；baseline 保存原有檔案位元組，manifest 包含路徑、存在與否、checksum、各比較起點。新增檔用不存在的起點紀錄，改名／刪除保留映射，不事後補造 baseline。
- 只保存已允許修改的必要檔案與證據，不遞迴複製 workspace、讀取／保存 `.env`、credentials、個資、DB dump 或無關資料。檔案不適合保存時停止並提出安全證據方式，不以備份名義讀取秘密。
- 逐票與累積完整 patch 分開保存；正式 packet 引用 Reviewer 可取得的位置。換機／跨 session 移交須確認證據仍可讀，不能只有失效的本機路徑。
- 同檔外部修改無法歸因時停止受影響寫入；快照不等於 worktree／DB 隔離，不自動回復 baseline 或覆寫他人工作。
- 長任務進度仍寫在既有 plan／ticket；累積 review 材料可放本 run。不要把本機證據誤寫成已核准 decision、通過的 review 或正式產品文件。

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

### `01-planning-report.md`

保存 Codex 依 controlled automation 流程產出的 Planning Report。

來源：

```txt
docs/prompts/controlled-automation-task-prompt.md
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

2. Codex 做 Planning Report
   -> .ai-runs/current/01-planning-report.md

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
