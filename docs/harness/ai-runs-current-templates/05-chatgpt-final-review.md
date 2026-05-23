# ChatGPT Final Review

## Purpose

本模板用來保存 ChatGPT final review。Final review 必須根據 Builder Review Packet、changed files、full diff 與 checks result 進行；沒有 diff 就不能 final approve。

請不要在本檔放入 token、credential、production data、客戶敏感資料或 `.env` 內容。

## Final Review Input

- Task request:
- Approved Builder prompt:
- Builder Review Packet:
- Diff source:
- Checks source:

## Verdict

- Verdict: `[APPROVE / APPROVE WITH MINOR NOTES / REQUEST CHANGES / BLOCKED / REQUEST MORE MATERIALS]`
- Reason:

## Diff Review Notes

- Changed files reviewed:
- Diff completeness:
- Scope compliance:
- Forbidden files check:
- Concerns:

## Checks Review

- Checks run:
- Checks not run:
- Failed checks:
- Not-run reason accepted:

## Risk Notes

- Auth / Prisma / DB / migration:
- Permission / role model:
- State machine:
- Public UX / brand / low-pressure UX:
- Package / env / deploy / CI:
- Security / sensitive data:

## Commit / Push Recommendation

- Commit readiness: `[ready / not ready / human decision required]`
- Push readiness: `[ready / not ready / human decision required]`
- Reminder: Codex must not commit or push unless explicitly asked by product owner.

## Follow-up Slice Suggestion

- `[列出建議下一個 micro slice；若無，寫 None.]`
