# 04: 選團體、存需求草稿、補資料返回

**What to build:** 團主選自己的團體填一頁需求，明確存草稿；缺聯絡資料時儲存後前往補資料，再回到同一筆繼續送審。

**Blocked by:** 03：我的團體與首次建團

**Status:** done（2026-10-05）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、AUTH_RISK、STATE_MACHINE_RISK、LOW_PRESSURE_UX_RISK

- [x] 需求表單分區、必填／選填、團體摘要與缺項定位一致；新需求明確選 own organization，已有聯絡資料可重用。
- [x] own draft 可換團體；已送出需求維持原歸屬，不能直接換團體；server guard 不信任 client。
- [x] 首次儲存後使用含 demand ID 的穩定編輯 URL，更新、refresh、補資料返回都用同筆，不額外新建。
- [x] 儲存並補資料在保存成功後才離開；儲存失敗保留輸入與錯誤，不跳頁；合法站內返回不得開放任意 URL redirect。
- [x] 未保存修改有 internal navigation 與 unload 保護；明確保存與送審是不同動作，不新增持續雲端 autosave。
- [x] 驗證失敗保留原欄位；重送仍檢查團體完整度與既有需求狀態；送審成功前往單筆詳情，顯示下一位處理者。
- [x] 測試兩團體選擇、非 own ID、已送出不可換、補資料／登入返回同 ID、失敗不丟內容與手機操作；更新受影響文件。


## 執行紀錄（2026-10-04）

- **範圍**：沒有 schema 變更；domain `saveOwnDemandRequestDraft`／`submitOwnDemandRequest` 新增 `requestedOrganizationId`（一律以 id＋owner 驗證，錯誤碼 `organization_not_found`），草稿可以換團體，送審時以實際所屬團體檢查聯絡資料完整度；UI 在 `DemandRequestForm` 加入團體選擇、所選團體的聯絡資料提示與「儲存草稿並補齊聯絡資料／新增其他團體」、缺項定位按鈕、未儲存離開保護；送審成功前往需求詳情（`?submitted=1` 顯示已收到）；新增團體從流程返回時帶 `organizationId` 預選；移除不再使用的 `ContactIncompleteBanner`。
- **一併修正的既有問題**：新需求直接按送出時，action 會先建草稿；送出被伺服器擋下時表單原本不知道這筆草稿，下一次送出會再建一筆。現在失敗結果帶回草稿 id，表單沿用同一筆並把網址換成編輯頁。
- **網址**：第一次存檔與上述情況用 `history.replaceState` 換成 `/organizer/demands/[id]/edit`，不重新載入，畫面狀態與提示保留。
- **離開保護的範圍**：瀏覽器關閉／重新整理（beforeunload）與站內所有 `<a>` 連結（含 Next.js Link 與導覽列）。瀏覽器「上一頁」在 App Router 下沒有可靠的攔截點，沒有保護，留給票 14 一起評估。
- [x] 驗收項目逐條：分區與團體摘要、缺項定位（點摘要聚焦欄位）／own draft 可換團體、已送出不能換（編輯頁導回詳情；伺服器只更新 draft）、偽造團體 id 被拒／穩定 ID 網址、重新整理與補資料返回同一筆、不多建草稿／儲存成功才離開、失敗留在原頁／beforeunload 與站內連結保護、存檔與送審分開、沒有 autosave／伺服器驗證失敗保留欄位、送審前重驗團體完整度與狀態、成功前往詳情並顯示下一步。
- [x] 測試：新增 `tests/smoke/organizer-demand-organizations.spec.ts`（兩團體選擇與切換、穩定網址與重新整理、偽造 id、已送出不可換、流程中新增團體返回並預選、離開保護、伺服器驗證失敗保留欄位、缺項定位、送審後詳情）；更新 organizer-demand（補資料返回改為先存草稿、新錯誤文字）與 organization-ownership。
- [x] Checks：`npx tsc --noEmit`、eslint、`npm run build` 通過；Playwright（port 3100）需求相關 6 個 spec 92 passed；首輪 `notification.spec.ts:444`（報名取消通知，本票未改動）在 desktop 失敗一次，重跑通過。
- [x] Codex 第 1 輪修正：
  - 儲存或送出進行中時鎖住所有欄位與送審按鈕（`isBusy`），儲存與送審不能重疊，也不會丟掉等待期間的輸入（測試用延遲回應驗證鎖住狀態與只有一筆草稿）。
  - 新需求第一次存檔改用 `router.replace` 真的換到編輯頁，提示以固定代碼的 `?flash=` 帶過去、顯示後清掉；「儲存並補資料／新增團體」先把歷史項目換成編輯頁網址，再整頁前往，按上一頁會重新載入同一筆草稿（測試驗證）。
  - 從新增團體返回的 `?organizationId=` 在頁面顯示後清掉，之後改存其他團體再重新整理仍是剛存的團體（測試驗證）。
  - 未登入開啟需求編輯、新需求、團體新增／編輯頁時，轉到 `/sign-in?callbackUrl=` 並帶回原頁（含流程的 returnTo）；需求編輯頁有測試。完整的入口 intent 仍屬票 10。
  - 送審準備狀態與伺服器規則一致：標題、說明長度，人數、課程長度範圍，以及所選團體的聯絡資料完整度；伺服器回傳的欄位錯誤可點擊定位（缺項摘要定位有測試；伺服器欄位錯誤因前端已先擋下，沒有 E2E 情境可觸發）。
  - 送出確認畫面列出團體、期望時段與開課日期，並說明送出後不能換團體。
  - 伺服器在送出時重新檢查團體聯絡資料：測試在頁面載入後清掉聯絡資料，送出被擋下、欄位保留、仍只有一筆草稿。
- [x] 重跑：需求與團體相關 6 個 spec 81＋18 passed；一次 `PrismaClientInitializationError` 發生在測試建立資料時（尚未開頁面），重跑通過。tsc、eslint、build 通過。
- [x] Codex 第 2 輪修正：開始換頁後一直鎖住表單直到新頁面載入（`isNavigating`；測試延遲編輯頁載入驗證欄位與送審按鈕仍鎖住，載入後內容正確）；未登入轉登入頁時保留合法的 `organizationId` 預選參數（只接受 cuid 形式，其他 query 不帶；測試驗證）。
- [x] 重跑：organizer-demand-organizations、organizer-demand 39 passed／1 timeout（desktop、偽造團體 id 測試，沒有失敗的斷言）；該測試 `--repeat-each=3` 6 passed，判定為偶發。
- [x] Codex 第 3 輪：瀏覽器從 back-forward cache 還原時表單維持鎖定 → 新增 `pageshow`（`persisted`）處理解鎖。實測：另開一個打開快取的 Chromium 走「存檔 → 補資料頁 → 上一頁」，Chromium 回報 `response-cache-control-no-store` 不放進快取、一律重新載入，回來後表單可編輯、可存檔（測試記錄原因）；`pageshow` 處理保留給會還原頁面的瀏覽器。
- [x] 重跑 organizer-demand-organizations 20 passed；tsc 通過（一次失敗是 dev server 產生 `.next/dev/types` 時寫到一半，刪掉重新產生後通過，與原始碼無關）。
- [x] 獨立 review（Codex，4 輪後 APPROVED；第 4 輪接受「Chromium 因 no-store 不會從快取還原，不強制斷言 restoredFromCache」的反駁）。
- [x] 本機 commit（未 push）。

<!-- codex-peer-reviewed: 2026-10-04T21:53:50Z rounds=4 verdict=approved -->
