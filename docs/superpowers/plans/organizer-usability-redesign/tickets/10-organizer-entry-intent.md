# 10: 雙入口、註冊與登入返回

**What to build:** 從『我需要找老師』或『我已有合作老師』開始，訪客與既有團主都一路到正確流程，首次建資料不丟失開團目的。

**Blocked by:** 04：選團體、存需求草稿、補資料返回；09：直接開放報名與來源權限

**Status:** in progress（2026-10-05：除「已有合作老師」入口公開外都已落地，見進度紀錄）

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** AUTH_RISK、PERMISSION_RISK、LOW_PRESSURE_UX_RISK

- [ ] /organizers/request 首屏兩張情境卡（目前只公開「我需要找老師」；第二張卡由 `DIRECT_CLASS_ENTRY_PUBLIC` 控制）；已有團主顯示精簡選擇，不一律 redirect 需求表單。
- [x] 訪客、已登入未有團主資料、已有團主、老師兼團主的 intent 在登入與首次 onboarding 後正確返回；既有深連結優先回該單筆。
- [ ] 入口／總覽／需求與課程列表首屏有對應建立捷徑（找老師已公開；直接開團捷徑待公開）；直接開團路徑完整可用後才公開 CTA，未新增 dashboard 模組或覆寫其他角色設計。
- [x] callback 只接受合法站內目的地，不能 open redirect／越權存取；沒有明確 intent 時保留既有 last-role 行為。
- [x] 首次一頁個人＋團體資料，既有資料不重填；個人 profile 與我的團體導覽分工一致。
- [x] 表單分區、欄位摘要、主動作與成功去向一致，錯誤／保存保留輸入；手機與鍵盤可完成兩條路徑。
- [x] 驗證四種身分、合法／惡意 callback、深連結、重複 onboarding、公開 header／role shell 回歸；不更換 Auth provider、session model 或 account linking。

## 進度紀錄

- 2026-10-05 範圍：入口頁、團主資料頁的 `next`、新表單頁的首次 onboarding 導向、團主頁面的登入返回、總覽／需求／課程首屏捷徑、我的課程上方的直接開團進度清單。不換 Auth provider、session model 或 account linking；全站 `sanitizeCallbackUrl` 與 last-role 行為不變。
- intent：`src/domain/organizer-profile/intent.ts`（只接受 `find_teacher`／`direct_class`）。訪客卡片→`/sign-in?callbackUrl=/organizers/request?intent=…`；已登入未有團主資料（含只有老師身分）→`/organizer/profile?next=<表單>`；已有團主→表單。入口頁收到合法 intent 且已登入時直接分流；沒有 intent 時已有團主看精簡選擇（推翻 2026-09-25 票 02 的一律 redirect）。
- callback／返回路徑：`sanitizeOrganizerReturnPath` 改為先套 `sanitizeCallbackUrl`（擋反斜線、控制字元、正規化後的 `//` 與外站），再要求正規化後的路徑在 `/organizer/` 底下，`/organizer/../admin` 不再通過。登入頁沿用全站 callback 檢查；13.8 的團主允許前綴落在團主流程自己的 `next`／`returnTo`。
- 深連結：需求詳情、課程詳情、需求／課程列表、總覽、通知、我的團體、團主資料未登入時都帶 `callbackUrl` 回原頁（團主資料連 `next` 一起保留）；新表單頁沒有團主資料時帶 `next` 導到團主資料。
- 範圍差異：合作邀請列表原屬票 12；為了讓公開的直接開團入口「完整可用」（存草稿離開後找得回來），本票在我的課程上方加最小的進度清單（`listOwnActiveProposalsForOrganizer`，只回本人 owner 的進行中邀請），待我處理／等待對方的細分仍在票 12。
- 公開 CTA 判斷（Codex 第 1 輪 P1，產品主人 2026-10-05 決定）：老師端取消核心只驗 `teacherProfileId`、沒有 origin 限制，受邀老師偽造請求可取消團主的課（spec §8）。修正要動老師排課任務尚未 commit 的檔案，所以「我已有合作老師」入口先不公開：`src/domain/organizer-profile/intent.ts` 的 `DIRECT_CLASS_ENTRY_PUBLIC = false` 控制入口卡、總覽與我的課程捷徑；`intent=direct_class`、直接開網址與進度清單照常可用並有測試。
- 剩下工作：票 09 老師端開放／取消 origin guards 落地（含越權測試）後，把 `DIRECT_CLASS_ENTRY_PUBLIC` 改成 true，恢復兩張卡與捷徑的測試斷言（首屏可見、鍵盤），再勾選上面兩項。
- 手機首屏（Codex 第 1 輪 P2）：情境卡移到標題正下方、介紹往下移，卡片在手機縮小留白；測試在桌機與 390 手機點擊前先驗證主操作完整在畫面內，並用鍵盤 Enter 進入。
- 驗證：tsc、eslint、build 通過；新增 `tests/smoke/organizer-entry-intent.spec.ts`（訪客 intent 登入返回、未有團主資料保留直接開團 intent 完成 onboarding、重複進入不重填、老師兼團主、未知 intent／不合法 next、深連結登入返回、首屏捷徑與直接開團草稿找得回來），更新 `organizers-request.spec.ts`、`public-trust-pages.spec.ts`。入口相關 3 檔 `--repeat-each=2` 76 passed（第一次跑有 1 個 toHaveURL 偶發，重跑未再出現）；團主回歸 13 檔 164 passed（port 3200）。

<!-- codex-peer-reviewed: 2026-10-05T11:50:02Z rounds=2 verdict=approved -->
