# Approved Builder Prompt

## Purpose

本模板用來保存人類或 ChatGPT governance review 已核准的 Builder prompt。Builder 必須只依本檔授權執行，完成後用 `04-builder-review-packet.md` 回報。

請不要在本檔放入 token、credential、production data、客戶敏感資料或 `.env` 內容。

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

## Output Requirements

- Provide changed files.
- Provide full git diff or patch.
- Provide checks result or not-run reason.
- Provide Builder Review Packet.
- Report any scope issue before continuing.

## No Commit / No Push Reminder

- Do not commit.
- Do not push.
- Do not modify forbidden files.
- Do not expand scope beyond this approved prompt.
