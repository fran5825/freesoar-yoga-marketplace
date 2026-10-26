# Codex 專案 skills 使用方式

設定日期：2026-10-26。目的：讓 Codex 接手 Claude handoff 時，使用相同的 Free Soar 功能閉環、流程走查與 Impeccable 設計方法。

## 使用方式

在本專案的 Codex chat 輸入：

```text
$impeccable critique src/app/page.tsx
$feature-loop <功能描述或既有 feature-slug>
$flow-walkthrough 老師第一次加入，從入口到完成第一個有價值的結果
```

上面是三個獨立範例，不是要一次執行。也可以寫「請使用 feature-loop skill 接手以下 handoff」。

若習慣 Claude 的 `/impeccable`、`/feature-loop`、`/flow-walkthrough`，將文字送進對話後，adapter 會視為相同意圖；這不是新增 Codex UI 的原生 slash command。若 UI 攔截未知的 slash command，改用 `$skill-name` 或自然語言。

新 skills 預期下一輪可用；若選單未出現，重新開啟 Codex app 再進入本專案。也可明確請 Codex 讀對應 `.agents/skills/<name>/SKILL.md`，無須等選單。

官方依據：[OpenAI skills 文件](https://learn.chatgpt.com/docs/build-skills) 說明 repo 的 `.agents/skills/` discovery，以及 `$`／明確引用的使用方式；[Impeccable 官網](https://impeccable.style/) 提供設計命令與各工具的安裝說明。

## 本輪的檔案與共用方式

| Codex 入口 | 共用來源 |
| --- | --- |
| `.agents/skills/impeccable/SKILL.md` | `.claude/skills/impeccable/SKILL.md`，skill 4.6.0／engine 0.1.15 |
| `.agents/skills/feature-loop/SKILL.md` | `.claude/skills/feature-loop/SKILL.md` 與其各階段 skills |
| `.agents/skills/flow-walkthrough/SKILL.md` | `.claude/skills/flow-walkthrough/SKILL.md` 與既有 personas／jobs／report-template |

runtime 差異集中在 `.agents/skills/feature-loop/references/codex-runtime.md`。`feature-loop/agents/openai.yaml` 保留原始 skill 的 explicit-only 設定，避免一般功能討論誤啟動完整閉環。

本輪採用小型 adapter，沒有重新下載、升級或複製整套 Impeccable；保留專案既有版本與設計資料。之後更新 `.claude/skills/`，Codex 會讀到同一來源，但若上游修改了工具介面或階段，仍須重新驗證 adapter。

## 保留與轉接的行為

- `feature-loop`：沿用 grill → spec → tickets → implement → review → 畫面驗收 → retro，使用既有 loop-status 與真實授權紀錄恢復；未核准的關卡仍等待產品主人。安裝不會啟動閉環。
- `flow-walkthrough`：只讀程式、寫本次報告；沿用三位固定 persona、四問、日常工作對照與真人測試腳本。舊報告不覆寫；沒有實際看過的結論仍標「待驗證」。
- Claude 的 Skill tool：改為按需直接讀來源 skill；來源內部的相對引用仍從原始 skill 資料夾解析。
- Claude `/code-review`：改由可用的獨立 read-only reviewer 執行 bug／回歸 review，另做 Standards／Spec 審查。
- Claude Stop hook 的文件 peer review：改為報告完成後的明確獨立 reviewer 步驟；不假裝 hook 或 `codex exec` 有執行、不偽造 approved marker。reviewer 不可用時明確回報關卡未完成。
- 不增加 commit／push 授權；不改 Auth、schema、角色權限、state machine、route 或 V1 範圍。

## 自動 detector hooks 的狀態

本輪驗證 Impeccable engine 與 context 可執行，但沒有新增 `.codex/hooks.json`，因此尚未建立 Codex 的自動 detector hook。`hooks status` 顯示 enabled 是共用旗標，不等於 Codex 已安裝、trust 或觸發 hook。

目前 Codex 做 UI 修改時，由 adapter 要求明確執行手動 detector。自動 hooks 可另外透過 Impeccable 的 Codex 安裝流程啟用，再依 app Settings → Hooks 的實際 trust 流程驗證；本輪不改 Claude hooks，也不自動信任 hook。

## 驗證與限制

- 三個入口使用 skill-creator 的 `quick_validate.py` 驗證 frontmatter 與命名。
- YAML policy 與來源檔／Markdown 引用另外檢查，避免入口存在卻找不到方法。
- Windows `.cmd` 的 `engine-probe` 已回報 `impeccable-engine 0.1.15`；`context` 已讀出既有 PRODUCT.md、DESIGN.md 指標與首頁 surface brief。
- validator 缺少 PyYAML，僅在系統 temp 安裝 PyYAML 6.0.3 供檢查，未改專案 package／lockfile 或全域 Python。
- 以本輪開始時的 SHA-256 baseline 檢查既有 dirty files 未被改寫。
- 沒有啟動產品功能、建立走查報告、操作 DB 或改 UI，因此不跑 TypeScript／ESLint／build／E2E；也未宣稱已完成真實 handoff 的端到端閉環或 app 選單實測。

真實 handoff 到來後，先查進度、證據與 approval boundary，再決定從哪個階段續作。
