# 05: 從課程直接 Google 登入

**What to build:** 訪客在課程詳情按「登入後報名」，直接進入既有的 Google 登入，不再先經過站內登入頁。按鈕附近清楚說明「第一次使用會自動建立帳號」。登入成功回到同一堂課，並保留原本的找課條件；取消或失敗時也能回到原課重試。回來後重新檢查課程與名額，學員仍要自己勾同意並按報名。

**Blocked by:** None (can start immediately)

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（Auth 登入入口與 callback）

**Risk flags:** Auth、callback 安全（含既有 open redirect 修正）、登入失敗處理。

**Source:** `docs/member-flow-redesign-plan.md` Q6、Q12、分批表第 3 批；`docs/backlog.md` 第 15 項。

## 已決定的規格（不重問）

- 只用既有 Google provider；不新增 provider、session／角色模型或帳號連結策略。
- 不自動報名，不預勾 basicConsent。
- callback 只接受站內合法路徑。
- 回來時課程已額滿、已開始或不可報名，顯示當下狀態與「找其他課程」，不暗示有保留名額。

## 既有 callback 漏洞（Codex 審查發現，2026-10-04 已驗證）

`src/lib/auth/callback-url.ts` 的 `sanitizeCallbackUrl` 只檢查「以 `/` 開頭、不以 `//` 開頭」。`/\evil.example/` 會通過檢查，但瀏覽器把反斜線當斜線，`new URL("/\\evil.example/", 站內網址)` 解析為 `https://evil.example/`。已登入者開 `/sign-in?callbackUrl=...` 時，sign-in 頁會直接 `redirect()` 到這個值，形成 open redirect。HEAD 已存在，不是第一批造成。

本票必須修正：以站內網址為基底解析 callback，要求解析後 origin 與站內相同，再組出正規化後的 path＋query＋hash；拒絕反斜線、控制字元與其他解析後跨站的值。另外，正規化本身可能產生新的 `//` 開頭路徑（例如 `/a/..//evil.example/`、`/a/%2e%2e//evil.example/` 解析後 pathname 為 `//evil.example/`），所以要對**最終回傳字串**再檢查一次：不得以 `//` 開頭，且以它重新解析後仍與站內同源，否則拒絕。

## Acceptance criteria

- [ ] 開工前提供具體 Builder plan（含 callback security review 重點），經 Human Gate 確認
- [ ] 訪客從詳情一鍵進 Google，成功後回同一堂課，並保留列表條件
- [ ] 首次建帳號的說明在按鈕前就看得到
- [ ] 取消／失敗回原課，可重試，不送出報名
- [ ] 回來後名額與狀態重新讀取；額滿／已開始時顯示正確出口
- [ ] 外站或非法 callback 被拒絕；回歸案例至少包含 `https://evil.example/`、`//evil.example`、`/\evil.example/`、`/a/..//evil.example/`、`/a/%2e%2e//evil.example/`、含 tab／換行等控制字元的值，且已登入開 `/sign-in` 與 Google 登入兩條路徑都驗證
- [ ] `docs/engineering/auth-entry-strategy.md`、`docs/domain/permissions.md` 視需要同步
- [ ] tsc、lint、build；站內 session 模擬 smoke 通過
- [ ] 報告分開寫：本站 session 模擬 smoke 結果，以及真實 Google OAuth 手動驗收結果（需產品主人操作；未做就寫未做）
- [ ] 真實 OAuth 手動驗收未完成時，可交付實作與限制報告，但本票驗收維持未完成，票 06 不得據此宣稱完整旅程已通過

<!-- codex-peer-reviewed: 2026-10-03T21:19:08Z rounds=3 verdict=approved (reviewed as one unit with ../ticket-breakdown.md) -->
