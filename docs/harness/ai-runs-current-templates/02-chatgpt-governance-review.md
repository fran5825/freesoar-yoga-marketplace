# ChatGPT Governance Review

## Purpose

本模板用來保存 ChatGPT 對 Codex planning report、triage 或 Builder prompt draft 的 governance review。此階段不實作，只檢查品牌、scope、風險、human gate 與 prompt 是否適合交給 Builder。

請不要在本檔放入 token、credential、production data、客戶敏感資料或 `.env` 內容。

## Review Input

- Source packet:
- Reviewer:
- Review date:

```txt
[貼上或摘要 Codex planning report / triage / Builder prompt draft]
```

## Verdict

- Verdict: `[APPROVE / APPROVE WITH MINOR NOTES / REQUEST CHANGES / BLOCKED]`
- Reason:

## Scope Review

- 是否符合 V1 scope：
- 是否避免 scope creep：
- 是否避免 Wellness / Academy / Retreat full modules：
- 是否避免 advanced AI matching、full payment/refund automation、native mobile app：

## Risk Review

- Auth / Prisma / DB / migration：
- Permission / role model：
- State machine：
- Package / env / deploy / CI：
- Public UX / brand / low-pressure UX：
- Other risk flags：

## Prompt Correction, If Needed

```txt
[若需要，貼上 corrected Builder prompt；若不需要，寫 No correction needed.]
```

## Human Decisions Accepted / Required

- Accepted decisions:
- Required decisions:

## Approved Next Step

- Next step: `[proceed to Builder / revise planning / ask human decision / stop]`
- Conditions:
