# Codex skills 環境轉接

建立日期：2026-10-26。來源：產品主人要求先備妥 Claude handoff 的接手環境。

## 範圍與驗收

本輪是低風險 tooling／文件設定：提供本 repo 的 `impeccable`、`feature-loop`、`flow-walkthrough` Codex skills，沿用 `.claude/skills/` 作為流程與參考資料的來源，不複製另一套產品規則。不執行任何產品功能、走查或視覺修改。

- Allowed：新增 `.agents/skills/` 入口、Codex runtime 轉接說明、本計畫、操作文件。
- Forbidden：既有工作變更、產品程式、Auth、schema、migration、DB、package／lockfile、env、deploy、Claude skills／hooks、品牌設計檔。
- Approval boundary：產品主人已授權本輪設定；不代表核准未提供的 handoff、功能票券、產品決策、commit 或 push。
- 不新增第三方安裝：專案已有 Impeccable skill 4.6.0、engine 0.1.15 與 Windows binary，可直接共用。
- 不默默搬用 Claude 的 Stop hook；Codex review 改為流程中的明確步驟。自動 detector hooks 的 provider wiring／trust 與 skills 分開揭露。

## Checklist

- [x] 讀 AGENTS.md、Harness 與三個原始 skills，確認依賴和授權。
- [x] 查官方 Codex skills discovery／invocation 與 Impeccable 文件。
- [x] 記錄現有 dirty files 的 SHA-256 baseline（系統 temp，僅校驗本輪沒有覆寫）。
- [x] 驗證現有 Windows launcher 的 engine-probe。
- [x] 新增三個 Codex 入口與共享 runtime 轉接規則。
- [x] 寫操作說明，明確區分 `$skill`、Claude `/skill` 與 hooks。
- [x] 驗證 frontmatter、引用、Impeccable context、原始檔案未改動。
- [x] 輕量 self review 並記錄驗證限制。

## 驗證策略

使用 skill-creator 的 `quick_validate.py` 檢查三個入口；解析 YAML metadata、檢查引用檔存在；實跑現有 Impeccable launcher 的 `engine-probe`、`context` 與 `hooks status`。不為 skills 設定跑全專案 build／Playwright，也不安裝測試依賴。實際 feature-loop gate 與走查方法由後續真實 handoff 驗證，不能把靜態驗證宣稱為完整功能閉環已通過。

## 進度與 self review

2026-10-26 完成本輪設定。新增五個 `.agents/skills/` 檔案、本計畫與 `docs/engineering/codex-skills-setup.md`，共七檔。

驗證結果：

- `quick_validate.py` 三個入口皆回報 `Skill is valid!`。最初 validator 因缺 PyYAML 失敗；改用系統 temp 的 PyYAML 6.0.3 重跑成功，未改專案依賴。
- YAML policy、入口 Markdown links、十個階段來源、persona／jobs／template、Impeccable references 與 reviewer／驗收 runbook 均存在。
- `engine-probe` 成功：`impeccable-engine 0.1.15`；`context` 成功載入現有 PRODUCT 與首頁 brief，並正確指向 DESIGN.md。沒有執行設計決策或 UI 修改。
- `hooks status` 成功，但 `.codex/hooks.json` 不存在；自動 Codex hooks 未安裝／trust／觸發，不宣稱已通過。adapter 要求 UI 修改後手動 detector。
- 25 個原先 dirty files 的 SHA-256 全數一致。原始 `.claude/` 沒有變更；沒有 commit／push。
- 未做真實 handoff 閉環、真人驗收或 app 選單 smoke；這些不冒充靜態驗證已涵蓋。沒有產品程式變更，不跑 TypeScript／lint／build／E2E。

Self review／scope drift：僅新增本輪允許的 tooling 與文件，未動無關檔案；維持 V1，未新增 Wellness／Academy／Retreat、AI matching、付款退款自動化或 native app。未改 role model、permissions、state machine、data model、route map。無產品 UI／RWD 改動；品牌保留既有 constitution 與設計檔。reviewer 維持唯讀與真實證據，沒有放寬安全、產品決策、DB、commit／push gate。本輪沒有需要產品主人決策的產品變更；後續 handoff 授權仍需依實際內容判斷。
