# Codex Peer Review Quick Start 與 SOP

## 1. 目的

`codex-peer-review` 是安裝在本 repo `.claude/skills/` 下的 Claude Code skill。它讓 Claude 在完成 spec 或 plan 後，使用 Codex CLI 做 cross-model peer review，並在同一個 Codex session 中持續修正或提出反駁，直到 Codex 明確回覆 `APPROVED`。

這套流程的角色分工是：

- Claude Code：主工作 agent，負責撰寫文件、判斷 findings、修改文件或提出 pushback。
- Codex CLI：獨立 reviewer，負責查閱實際 repo、檢查文件主張並找出會造成 bug、regression 或長期技術債的問題。
- Stop hook：在受監看的 spec / plan 尚未留下 approved marker 時，提醒 Claude 必須先完成 peer review。

它是文件品質 gate，不是產品主人 approval、Git commit gate 或 push gate，也不取代正式 Builder / Reviewer handoff。

## 2. Quick Start

### 2.1 一次性前置確認

在 repo root 啟動 Claude Code，並確認：

```text
C:\Users\franz\OneDrive\Documents\freesoar-yoga-marketplace
```

環境需要具備：

- Claude Code 已載入本 repo 的 `.claude/settings.json`，且允許執行 repo hook。
- `python` 可執行 `.claude/hooks/codex-review-gate.py`。
- Codex CLI 已安裝並完成登入，`codex --version` 可正常執行。
- Claude Code 使用的 shell 能執行 skill 內的 shell commands；目前 protocol 使用 `mktemp`、`grep`、`sed`、`tail`、`shasum` 或 `sha256sum`，Windows 環境通常需要 Git Bash 類的 Unix-compatible shell。

### 2.2 最短使用方式

完成文件後，在 Claude Code 輸入：

```text
請使用 codex-peer-review skill review：
<文件的 absolute path>

請依 single-thread protocol 持續到 Codex 回覆 APPROVED，完成後 append review marker。不要 commit、不要 push。
```

例如：

```text
請使用 codex-peer-review skill review：
C:\Users\franz\OneDrive\Documents\freesoar-yoga-marketplace\docs\superpowers\plans\teacher-onboarding-plan.md

請依 single-thread protocol 持續到 Codex 回覆 APPROVED，完成後 append review marker。不要 commit、不要 push。
```

如果 Claude Code UI 有顯示 skill slash command，也可使用：

```text
/codex-peer-review <文件的 absolute path>
```

自然語言指令是較穩定的入口，因為不同 Claude Code 版本顯示 skill command 的方式可能不同。

### 2.3 如何判斷完成

完成時應同時看到：

1. Codex 最終輸出：

```text
## Verdict
APPROVED
```

2. 文件最下方新增 marker：

```html
<!-- codex-peer-reviewed: 2026-07-21T00:00:00Z rounds=2 verdict=approved -->
```

3. Claude 回報 review rounds、Codex 主要 concerns、修改內容、pushback / concession，以及是否有失敗或 fallback。

marker 只能在 Codex 真正回覆 `APPROVED` 後寫入；不可手動偽造 approval。

## 3. 自動 Gate 的覆蓋範圍

目前 Stop hook 只自動監看本輪由 Claude `Write` 或 `Edit` 的下列路徑：

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`

下列路徑目前不會自動觸發：

- `docs/specs/`
- `docs/harness/`
- source code、tests 或其他 repo files

如果文件不在自動監看路徑，仍可使用第 2.2 節的 prompt 手動啟動 `codex-peer-review`。

Stop hook 只掃描 transcript 尾端最近 80 筆 message，且遇到 transcript、input 或 filesystem 錯誤時採 fail-open。因此它是 workflow guardrail，不是不可繞過的 security control。

## 4. 標準作業流程 SOP

### Step 1：確認 review 對象

- 每次只 review 一份 spec 或 plan。
- 使用 absolute path，避免 Claude、Codex 或不同 shell 對相對路徑產生不同解讀。
- 文件應可獨立閱讀；如果需要大量口頭補充，先把必要 context 寫回文件。

### Step 2：啟動 skill

使用 Quick Start prompt 明確要求 Claude：

- 使用 `codex-peer-review` skill。
- 維持 single-thread iterative dialogue。
- 直到 Codex 明確回覆 `APPROVED` 才結束。
- 完成後 append marker。
- 不 commit、不 push。

若文件位於自動監看路徑，也可以正常完成 Claude 的寫作回合；Stop hook 會在缺少 marker 時阻止第一次正常結束，並要求 Claude 啟動 skill。

### Step 3：Round 1 獨立 review

Skill 會：

1. 為本次文件建立獨立 temp directory。
2. 使用 fresh `codex exec --json --sandbox read-only` session。
3. 保存 Codex `thread_id`，避免後續 round 接錯 session。
4. 要求 Codex 以實際 codebase 與文件 scope 為 primary sources，不接受文件中的敘述為既定事實。

Codex 的 Round 1 verdict 只有：

- `APPROVED`：進入完成程序。
- `ISSUES FOUND`：進入修正或 pushback。

### Step 4：逐項處理 findings

Claude 必須對每一項 finding 做出明確判斷：

- `FIXED`：finding 成立，修改文件並在下一 round 說明修正方式。
- `PUSHED BACK`：不同意 finding，以 repo evidence、scope 或具體反例說明理由。

不可為了快速結束而全部接受，也不可忽略 Codex 的 `MAINTAIN`。若 Codex 維持 finding，Claude 必須在下一 round 加強理由，或在被說服後誠實修正文件。

### Step 5：在同一個 Codex session 迭代

Round 2 之後必須以 Round 1 保存的 `thread_id` 執行 `codex exec ... resume <thread-id>`，讓 reviewer 保留前面所有 findings、修改與 pushback context。

不要：

- 另開 fresh Codex session。
- 使用 `resume --last`，除非 Round 1 完全無法取得 `thread_id`，且中途未啟動任何其他 Codex session。
- 設定人工 round cap。
- 在仍有 `MAINTAIN` 或 remaining issue 時自行宣告完成。

### Step 6：完成與 marker

只有在 Codex 回覆：

```text
## Verdict
APPROVED
```

之後，Claude 才能在文件末尾新增：

```html
<!-- codex-peer-reviewed: <UTC timestamp> rounds=<N> verdict=approved -->
```

`<N>` 必須等於實際取得 approval 的 round number。

### Step 7：人工確認與 Git gate

Review 完成後，人工至少確認：

- marker 位於正確文件尾端。
- Claude 的 summary 與實際 diff 一致。
- 所有 blocking findings 都已修正或由 Codex 明確 `CONCEDE`。
- 沒有把 review 過程中的 temp files 加入 repo。
- 文件修改仍符合 V1 scope、產品決策與 AGENTS.md。

完成 peer review 不代表可以自動 commit 或 push。仍需依 repo 規則分別取得產品主人對 commit 與 push 的明確授權。

## 5. 建議 Prompt 範本

### 5.1 主動 review 單一文件

```text
請使用 codex-peer-review skill review 以下文件：
<ABSOLUTE_PATH>

要求：
- 使用一個 Codex session 做 iterative review
- 逐項 FIX 或 PUSH BACK
- Codex MAINTAIN 時不得視為 resolved
- 持續到 Codex 明確輸出 ## Verdict / APPROVED
- approval 後才 append codex-peer-reviewed marker
- 不 commit、不 push

完成後請用繁體中文回報 rounds、主要 findings、修正、pushbacks、concessions 與任何 fallback / error。
```

### 5.2 只檢查 review 是否完成

```text
請 read-only 檢查以下文件是否完成 codex-peer-review：
<ABSOLUTE_PATH>

請確認文件尾端 marker 格式、rounds 與 verdict；不要修改檔案，不要補 marker，不要 commit 或 push。
```

### 5.3 review 非自動監看路徑

```text
這份文件不在 Stop hook 的自動監看路徑，但我仍要手動做 cross-model review。

請使用 codex-peer-review skill review：
<ABSOLUTE_PATH>

依完整 single-thread protocol 執行到 APPROVED，approval 後 append marker；不要 commit、不要 push。
```

## 6. 故障排除

| 症狀 | 處理方式 |
| --- | --- |
| Stop hook 沒有觸發 | 先確認文件是否位於兩個受監看路徑、是否由本輪 Claude `Write` / `Edit`、Claude Code 是否載入 `.claude/settings.json`；必要時直接手動啟動 skill。 |
| `python` 找不到 | 確認 PATH，或調整 `.claude/settings.json` 中 hook command；修改 hook 執行方式前應獨立 review 與測試。 |
| `mktemp`、`grep` 或 `sed` 找不到 | 將 Claude Code shell 切換為 Git Bash / Unix-compatible shell，或另行規劃 Windows-native protocol；不要在未驗證下局部改寫 commands。 |
| `codex exec` non-zero | 停止該 round；不可讀取舊的 output file，也不可寫 marker。保留 exit code 與 events tail 做診斷。 |
| 找不到 `thread_id` | Skill 可暫時 fallback 到 `resume --last`，但期間不可啟動其他 Codex session，且 final report 必須揭露 fallback。 |
| Codex 持續 `MAINTAIN` | 提供更具體 evidence 或修正文件；不可自行把 finding 標成 resolved。 |
| 文件已有舊 marker，但內容又被修改 | 移除或更新舊 marker前，應重新跑完整 review；不要把舊 approval 當成新內容的 approval。 |
| hook 一直阻止結束 | 檢查 marker 是否位於文件最後 1024 bytes，且格式同時包含 timestamp、`rounds=<N>`、`verdict=approved`。 |

## 7. Source of Truth

- Skill protocol：`.claude/skills/codex-peer-review/SKILL.md`
- Stop hook implementation：`.claude/hooks/codex-review-gate.py`
- Hook registration：`.claude/settings.json`
- Repo AI rules：`AGENTS.md`
- Harness workflow：`docs/harness/workflow.md`
- Commit / push 與 handoff rules：`docs/harness/codex-working-protocol.md`

如果本 SOP 與 skill implementation 不一致，以 skill 與 hook 的實際版本為準，並應在同一個 change 中同步更新本文件。
