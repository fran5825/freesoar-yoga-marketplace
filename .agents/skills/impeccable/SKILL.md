---
name: impeccable
description: "Free Soar 專案的 Impeccable 設計入口。用於 UI design、critique、audit、polish、adapt、onboard、live 等前端設計工作；也接受使用者貼上的 /impeccable 指令。不適用純後端工作。"
---

# Impeccable（Codex 入口）

本檔是 runtime adapter，不是另一份設計方法。從 repo root 解析以下路徑：

1. 先讀 [Codex runtime 轉接規則](../feature-loop/references/codex-runtime.md)。
2. 讀 `.claude/skills/impeccable/SKILL.md`，以該檔所在資料夾作為真正的 skill base directory；所有相對 `reference/`、`scripts/` 都從那裡解析，不能從本 adapter 解析。
3. 照原始 skill 執行，僅載入這次 command 需要的 reference。沒有 command 時依 routing 顯示選單，不自動改畫面。

Windows PowerShell 的入口是：

```powershell
& .\.claude\skills\impeccable\scripts\impeccable.cmd context
```

context 每個 session 只跑一次；有 target 時照原始 skill 傳 `--target`。其他 engine verb 使用同一個 `.cmd` launcher。

Free Soar 的 AGENTS.md、PRODUCT.md、DESIGN.md 與既有色票優先於通用審美建議；`cream` 與 `rounded-full` 是已確認的品牌選擇。本入口不授權擴大 V1 scope、重寫核心流程、commit 或 push。
