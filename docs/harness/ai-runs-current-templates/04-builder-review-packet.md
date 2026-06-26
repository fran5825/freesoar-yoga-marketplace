# Builder Review Packet

## Purpose

本模板用來保存 Codex Builder 完成 approved prompt 後的回報。此 packet 必須讓 ChatGPT final review 或產品主人能看見 changed files、diff、checks、scope compliance 與風險。

請不要在本檔放入 token、credential、production data、客戶敏感資料或 `.env` 內容。

## 1. Task Request

- 原始任務：

```txt
[貼上或摘要 task request]
```

## 2. Approved Prompt Summary

- 本輪明確授權：
- Automation level:
- Allowed files:
- Forbidden files:

## 3. Changed Files

```txt
[貼上 git status --short]
```

- `path/to/file`: `[說明此檔案改了什麼，為什麼需要改]`

## 4. Full Git Diff

```diff
[貼上完整 git diff；新檔可用 git diff --no-index -- /dev/null path/to/new-file.md]
```

## 5. Implementation Summary

- `[列出實作內容]`

## 6. Checks Run

```txt
Command:
Result:
Notes:
```

若未執行 checks：

```txt
Not run:
Reason:
```

## 7. Manual Test Notes, If Relevant

- `[若有手動檢查，列出檢查項目與結果；若無，寫 Not applicable.]`

## 8. Scope Compliance

- 是否只做 approved prompt 內的事：
- 是否修改 forbidden files：
- 是否有 scope expansion：

## 9. Risk Notes

- Auth / Prisma / DB / migration:
- Permission / role model:
- State machine:
- Public UX / brand / low-pressure UX:
- Package / env / deploy / CI:
- Security / sensitive data:

## 10. Docs Impact

- 是否需要同步其他 docs：
- 是否已同步：
- 是否有文件仍需 human decision：

## 11. Known Limitations

- `[列出未完成、刻意不做、或需下一輪處理的事項；若無，寫 None.]`

## 12. Builder Self-review

- V1 scope:
- Non-goals:
- Role / permissions / state machines / data model / route map:
- Security / RWD / brand concerns:
- Product owner decision required:
- Unrelated files modified:
- Commit / push:

## 13. Recommended Next Step / Handoff

- Recommended next work mode:
- Next smallest actionable slice:
- Why this should be next:
- Can Codex execute directly:
- Requires product owner decision:
- Suggested next prompt:

如果沒有下一步，請寫 `None`，並說明為什麼可以停止。
