# Builder Review Packet Template

本文件定義 Codex Builder 完成任務後，必須交給 ChatGPT review 的最小資料格式。

核心原則：

> No diff, no final approval.

如果沒有提供完整 diff，ChatGPT 不應給 final approval。

---

## 使用時機

每次 Codex Builder 完成實作後，都必須輸出 Builder Review Packet。

適用於：

- docs 修改
- UI 修改
- domain logic 修改
- server action / API route 修改
- auth / permission 修改
- database / migration 修改
- refactor
- bug fix
- test 補強

---

## Builder Review Packet

請 Codex Builder 使用以下格式回報。

````txt
# Builder Review Packet

## 1. Task Request

原始任務：

[貼上本次任務內容]

## 2. Approved Prompt

本次執行所依據的 approved Builder prompt：

[貼上 approved Builder prompt]

## 3. Scope Summary

本次實際完成的範圍：

- ...

本次明確沒有做的範圍：

- ...

## 4. Changed Files

列出所有變更檔案：

```txt
[貼上 git status --short]
```

檔案說明：

- `path/to/file`: 說明此檔案改了什麼，為什麼需要改

## 5. Git Diff

請提供完整 diff。

```diff
[貼上 git diff 或 git diff --cached]
```

若 diff 太長，請至少提供：

1. `git diff --stat`
2. 每個變更檔案的重點 diff
3. 說明哪些段落被省略，以及為什麼

注意：沒有 diff，不可要求 final approval。

## 6. Checks Result

請列出實際執行過的檢查。

格式：

```txt
Command:
Result:
Notes:
```

例如：

```txt
Command: npm run lint
Result: passed
Notes: no warnings
```

若沒有執行 checks，請明確寫：

```txt
No checks were run.
Reason:
- ...
```

## 7. Implementation Summary

用 3-10 點說明實作內容：

- ...

## 8. Risk Notes

請說明本次是否涉及：

- Auth / session
- Permission
- Database schema
- Migration
- Server action / API route
- Data mutation
- External integration
- Package files
- Global layout
- Brand / UX
- Performance
- Refactor boundary

格式：

```txt
Risk areas touched:
- ...

Risk areas not touched:
- ...
```

## 9. Unfinished Items

列出尚未完成、刻意不做、或需要 human decision 的項目。

若沒有，請寫：

```txt
None.
```

## 10. Self Review

請 Builder 自我檢查：

- 是否符合 approved prompt
- 是否有超出 scope
- 是否有修改 forbidden files
- 是否有未說明的變更
- 是否需要 human gate
- 是否可 rollback

## 11. Recommended Next Step

請選一個：

- Ready for ChatGPT final review
- Needs human decision
- Needs another Builder pass
- Needs smaller slice
- Stop here