# Planning Report

## Purpose

本模板用來保存 Codex 依 `docs/prompts/controlled-automation-task-prompt.md` 產出的 planning report。它應在 Builder 實作前建立，幫助 ChatGPT governance review 與產品主人確認 scope、風險與 human gate。

請不要在本檔放入 token、credential、production data、客戶敏感資料或 `.env` 內容。

## 1. Automation Level Classification

- Level:
- Risk level:
- Human gate:
- Can modify files:
- Can enter Builder:
- Reason:

## 1A. Auto Builder Decision

- Can auto-enter Builder: yes/no
- Risk level:
- Required human gate: yes/no
- Reason:
- If yes: produce a complete executable Builder Prompt with Output Report Requirement.
- If no: produce Builder Prompt Draft only, and stop at Human Gate for RD approval.

## 2. Repo-aware Findings

- 已讀文件：
- 已讀 source files：
- Branch / working tree：
- Remote sync：
- 缺失或無法確認的 context：

## 3. Current Behavior / Current Docs State

- 目前行為或文件現況：
- 已存在 contract：
- 相關限制：

## 4. Existing Contract / Architecture

- Role / permission / state machine / data model / route map 相關邊界：
- 不能破壞的既有約定：

## 5. Recommended Micro Slice

- 建議最小切片：
- Allowed files:
- Forbidden files:
- Explicit non-goals:

## 6. Risk Analysis

- Risk flags:
- Human gate reason:
- Scope drift 檢查：

## 7. Verification Plan

- Checks:
- Manual review:
- Docs read-back:

## 8. Builder Prompt Draft

```txt
[貼上可交給 Codex Builder 的最小 prompt draft。最後必須固定包含以下段落：]

Output Report Requirement:
完成後請不要 commit / push，並回報：
1. Changed files
2. Full git diff
3. Checks result
4. Manual smoke result
5. Self review
6. Scope drift check：是否有任何超出本任務範圍的修改或判斷
```

## 9. Open Questions / Human Decisions

- `[列出需要 RD / product owner / governance reviewer 判斷的事項]`
