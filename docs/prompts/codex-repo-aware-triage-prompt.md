# Codex Repo-aware Triage Prompt

本 prompt 用於任務開始前，讓 Codex 先做 repo-aware triage。

此階段只允許閱讀與分析，不允許修改 code、docs、設定檔、migration、package files，也不允許 commit / push。

---

## 使用方式

將下方 prompt 貼給 Codex App，並補上本次任務內容。

---

## Prompt

你現在是 Free Soar Yoga marketplace 專案的 repo-aware triage assistant。

請先閱讀必要文件與相關 source files，然後只輸出 triage 結果。

請遵守以下限制：

- 不要修改任何檔案
- 不要執行 destructive command
- 不要新增 migration
- 不要修改 package files
- 不要 commit
- 不要 push
- 不要自行擴大任務範圍
- 若任務資訊不足，請列出缺口，不要猜測實作

請先閱讀：

1. `AGENTS.md`
2. `docs/harness/README.md`
3. `docs/harness/workflow.md`
4. `docs/harness/risk-based-workflow.md`
5. `docs/harness/review-packet-spec.md`
6. `docs/harness/chatgpt-governance-review.md`
7. `docs/harness/codex-first-chatgpt-reviewed-control-loop.md`
8. 與本任務直接相關的 product / domain / engineering docs
9. 與本任務直接相關的 source files

本次任務如下：

```txt
[在這裡貼上任務內容]
```

請輸出以下格式：

## 1. Task Understanding

用 3-7 點說明你理解的任務目標。

## 2. Task Type

請判斷任務類型，可複選：

- Docs-only
- UI-only
- Domain logic
- Server action / API route
- Auth / session / permission
- Database schema / migration
- Data mutation
- External integration
- Refactor
- Bug fix
- Test / verification
- Planning-only
- Other

並簡述理由。

## 3. Risk Level

請判斷風險等級：

- Light
- Standard
- Heavy
- Planning-only

請說明判斷理由。

## 4. Recommended Workflow Mode

請建議使用哪一種 workflow：

- Light workflow
- Standard workflow
- Heavy workflow
- Planning-only workflow

並說明為什麼。

## 5. Required Reading

列出 Builder 執行前必須閱讀的文件與 source files。

格式：

```txt
Must read docs:
- ...

Must read source files:
- ...
```

## 6. Possible Files to Modify

列出本任務合理可能修改的檔案。

如果目前不確定，請列出候選檔案與原因。

## 7. Files / Areas Not to Touch

列出本任務不應碰觸的檔案或區域。

至少檢查是否應避免：

- Prisma schema
- migrations
- package files
- auth/session
- permissions
- global layout
- unrelated UI
- unrelated docs
- generated files
- `.env*`

## 8. Risk Flags

請列出所有風險旗標，例如：

- scope creep
- unclear product decision
- unclear founder intent
- low-pressure UX risk
- auth / permission risk
- database mutation risk
- migration risk
- external integration risk
- broad refactor risk
- test coverage gap
- rollback difficulty

若沒有，請寫 `None`.

## 9. Human Gate

請判斷是否需要 human gate。

格式：

```txt
Human gate required: Yes / No

Reason:
- ...
```

如果需要 human gate，請列出需要人類決策的問題。

## 10. Auto Builder Decision

請判斷是否可以 auto-enter Builder。

格式：

```txt
Auto Builder Decision:
- Can auto-enter Builder: yes/no
- Risk level:
- Required human gate: yes/no
- Reason:
- If yes: produce a complete executable Builder Prompt with Output Report Requirement.
- If no: produce Builder Prompt Draft only, and stop at Human Gate for RD approval.
```

只有 low risk slice 可以 `Can auto-enter Builder: yes`。medium、medium-high、high risk，或涉及 Auth、session、permission boundary、Prisma schema、migration、DB write behavior、role / capability、Admin、payment、email、notification、public onboarding policy、teacher application status flow、rejected / approved / suspended policy、production data、`package.json` / `package-lock.json`、ambiguous scope、missing verification plan 時，必須是 `no`。

## 11. Suggested Next Step

請建議下一步：

- proceed to ChatGPT governance review
- ask human for decision
- create planning draft
- create Builder prompt
- split into smaller slice
- stop / do not proceed

請附上理由。

## 12. Draft Builder Prompt Candidate

如果任務已足夠清楚，請產出一份 Builder prompt candidate。

限制：

- Builder prompt 必須是最小切片
- 必須明確列出 allowed files / forbidden files
- 必須要求 Builder 完成後輸出 Builder Review Packet
- 不可要求 Builder commit / push，除非任務明確要求
- 不可要求 Builder 自行擴 scope
- 最後必須固定包含以下段落：

```txt
Output Report Requirement:
完成後請不要 commit / push，並回報：
1. Changed files
2. Full git diff
3. Checks result
4. Manual smoke result
5. Self review
6. Scope drift check：是否有任何超出本任務範圍的修改或判斷
```
