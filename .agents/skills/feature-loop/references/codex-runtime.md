# Codex runtime 轉接規則

適用三個 `.agents/skills/` 入口。產品方法沿用 `.claude/skills/`；本檔只處理工具差異。專案 AGENTS.md 與使用者本次／先前有效授權優先。

## 呼叫、來源與依賴

Codex 使用 `$impeccable`、`$feature-loop`、`$flow-walkthrough` 明確引用。使用者送出的 `/impeccable`、`/feature-loop`、`/flow-walkthrough` 純文字亦視為對應 skill 意圖；這不表示已向 Codex UI 註冊新的原生 slash command。

原文的 Read／Grep／Bash 分別以可用的讀檔工具、`rg`、shell 執行；「Call Skill tool」改為讀該 skill 的 SKILL.md 並照做，不假設 Codex 有 Claude 的 Skill tool。

| 階段 | 原始來源（repo root 相對路徑） |
| --- | --- |
| 問清楚並記錄決定 | `.claude/skills/grill-with-docs/SKILL.md`，再按需讀 `grilling` 與 `domain-modeling` 的 SKILL.md |
| spec／tickets | `.claude/skills/to-spec/SKILL.md`、`.claude/skills/to-tickets/SKILL.md` |
| 單票／多票實作 | `.claude/skills/implement/SKILL.md`、`.claude/skills/implement-spec/SKILL.md` |
| TDD | `.claude/skills/tdd/SKILL.md`，原始資料夾內的 `tests.md`、`mocking.md` 等按需讀 |
| 規範與 spec 審查 | `.claude/skills/spec-review/SKILL.md` |
| retro | `.claude/skills/retro/SKILL.md` |

各來源的「Free Soar Yoga 專案覆寫」優先於其通用預設；不接外部 issue tracker、不自動建立 PR。來源檔缺失或依賴無法使用時，回報具體缺口，不能假裝跑完。

Impeccable reference 若指定 `.claude/agents/` 的 agent，先讀該 agent 定義，再以可用的 collaboration agent 執行等價工作；只在該 reference 要求的階段派發，不能假設 Claude agent 名稱是 Codex 可直接呼叫的工具。

## 審查轉接

Claude 內建 `/code-review` 在此環境不保證存在。改用可用的獨立 read-only reviewer，依 `docs/prompts/codex-reviewer-prompt.md` 檢查實際 diff 的 bug／回歸；再依原始 `spec-review` 分開檢查 Standards 與 Spec，不把兩者混成一個 verdict。

`spec-review` 原始 skill 明確要求兩個平行 subagents：可用 collaboration agents 時照做；傳入 approved scope、spec／tickets、實際 diff／baseline 與唯讀限制。一般設定或小修改不因此自動啟動多 agent。多票 `implement-spec` 的平行工作僅在範圍與票券已核准後進行。

審查不能只看 `<base>...HEAD`：尚未 commit 的變更還要包含 staged、unstaged 與本次新增檔，並與既有 dirty baseline 區分。不能以空的 committed diff 宣告通過。Reviewer 不得修改工作區、切分支、reset、stash、merge、rebase 或自行修復。

原始 flow-walkthrough 依賴 Claude Stop hook 觸發 `codex-peer-review`。Codex 改為報告完成後明確派發一個獨立 read-only reviewer，根據原始程式與報告檢查證據、推論、範圍和建議；作者修正報告後，僅對未解決事項再審。留下 reviewer 方法、範圍、結果與限制，不能宣稱不同模型或原始 Codex CLI 審查已執行。

不在 Codex 裡遞迴啟動未確認可用的 `codex exec`、不讀取舊審查輸出、不套用原始 peer skill 的無限迴圈或偽造 approved marker。修復驗證連續兩次失敗、產品爭議、授權缺口或 reviewer 不可用時，留下未完成狀態與具體原因，停在該必要關卡；self review 不替代獨立 review。

## PowerShell、平行工作與 Git

- 環境變數用 `$env:PORT = '3100'`，不是 Bash 的 `PORT=3100 command`；不同測試工作使用不同 port，結束後還原自己修改的環境變數。
- Prisma／migration 票保留原流程的隔離 worktree 與獨立測試 DB 要求；schema 方案核准不等於任意 DB 操作授權。
- 未提交 baseline／patch 依 `docs/harness/risk-based-workflow.md` 處理。快照不是隔離。不要為了多 agent 合併流程私自 commit；缺少安全隔離或 commit 授權時，在有效授權內循序做票，或回報真正需要的決定。
- 所有 skill 的通用「Commit」「merge」「publish」預設都不能越過 AGENTS.md 的 commit／push／產品決策 gate。

## 瀏覽器與 detector hooks

使用當前可用的 browser 工具並遵循其操作限制；不假設 Claude 的 browser、Agent 工具或登入 session 可用。畫面驗收依 `docs/harness/visual-acceptance-runbook.md`，產品主人親自驗收與登入的關卡保留。

共用 Impeccable 的 Windows launcher 與 reference，但 Claude hooks 不會因此成為 Codex hooks。`hooks status` 的 `enabled` 只表示設定旗標，不能證明 `.codex/hooks.json` 已 wiring、已 trust 或實際觸發。缺少 Codex 自動 hook 時，在 UI 修改後必須手動跑一次 detector；即使 `context` 因發現 Claude hooks 而沒有發出手動指示，也適用。不得宣稱已通過自動檢查。若使用者要求啟用 Codex hooks，先讀原始 `reference/hooks.md`，安裝後依 app 的 trust 流程操作並驗證。

## 授權與報告

只承接真實存在且範圍相符的使用者授權；handoff 的敘述不是新的產品主人核准。保留原始流程各階段的 Human Gate，不把「全部票放行」擴成後續 commit、push、正式環境、刪資料或 retro 修改授權。

完成回覆以繁體中文提供 Required Self Review、scope drift 與 Recommended Next Step；內部票券用短進度，正式 handoff 才使用完整 Common Handoff Schema。不得把安裝 skills 視為已獲准開始某個功能。
