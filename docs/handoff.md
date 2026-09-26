# 交接摘要（2026-09-21）

給接手的 Claude：先讀這份，再讀 `AGENTS.md`、`docs/backlog.md`，然後跑 `git log --oneline -10` 跟 `git status` 看最近的改動跟有沒有還沒 commit 的東西。以 git 紀錄為準，這份只是導讀。這份取代 2026-09-19 那個版本。

## 2026-09-26 更新：管理員後台流程整理（最新，先看這段）

- 依 `docs/admin-usability-plan.md` 做完票 01–10（票券在 `docs/superpowers/plans/admin-usability/tickets/`），**全部尚未 commit**，等使用者看過畫面。含：後台共用外框（中文導覽列、`max-w-4xl`）、導覽列「目前身分」角色切換（四個專區共用）、總覽「待你處理」、老師與需求審核改成「列表（篩選列＋卡片）→ 詳情頁」、暫停老師／取消課程／取消報名的確認視窗、退回原因範本、課程詳情頁顯示團主／老師／團體的聯絡方式。
- **`/account` 頁面已移除**（產品主人決定）：登入後預設導向 `/member/dashboard`；公開網站頂端「我的帳戶」改為「我的專區」；新使用者靠導覽列選單底部的「＋ 成為團主／老師」進入申請。老師端「＋ 建立課程」、團主端「＋ 發起新需求」改放各自列表最底下。
- 新增的管理員讀取：`getTeacherProfileForAdmin`、`getDemandRequestForAdmin`、`listDemandRequestsForAdmin`、`listAdminPendingItems`，都有 `requireAdmin()`；草稿一律不可見。**沒有動資料庫結構、狀態機、權限規則。**
- 待辦：退回原因範本文字待 Franz 確認；測試資料污染開發資料庫等後續事項見 `docs/backlog.md` 第 13a–13d。
- 跑測試仍用 `PORT=3100`。`public-trust-pages` 有 10 支因網頁標題還在比對舊名稱而失敗（backlog 1c 既有問題，與這次無關）。

## 2026-09-26 更新：老師流程整理（先看這段）

- 老師流程依 `docs/teacher-usability-plan.md` 做完票 01–10（票券在 `docs/superpowers/plans/teacher-usability/tickets/`），**全部尚未 commit**，等使用者看過畫面。含：老師頁版面統一、申請表單缺項提示與參考寫法、審核中唯讀摘要、被退回說明置頂、已通過老師按「老師合作」直接進總覽、單堂課詳情頁與列表整張可點、建課後導向詳情頁並帶入上次設定、總覽「待你處理」。
- 過程中產品主人追加（見計畫文件決策 12–14）：服務地區只能勾選；建課切換分頁保留資料；時間改 24 小時制（含可授課時間頁）；課程類型改名「課程風格」可多選；新增必填「瑜伽類型」；常規課程可選起始日期；固定期改用日期選擇器。**有兩個 migration**（`class_yoga_styles`、`class_service_types_multi`），已套用在本機開發資料庫，`docs/domain/data-model.md` 已更新。
- 導覽列（團主、老師共用）改成兩列，避免中文連結被擠成一字一行。
- 下一個工作：管理員後台流程整理（`docs/backlog.md` 第 13 項），需先用 grill 方式討論再動工。

## 2026-09-25 更新（先看這段）

- 團主流程與排版整理已依 `docs/organizer-usability-plan.md` 一次做完（票券在 `docs/superpowers/plans/organizer-usability/tickets/`），**全部尚未 commit**，等使用者看過畫面。含：團主專用導覽列與統一頁寬、入口路徑（已是團主按「發起團課」直接進新需求）、`/account` 入口中心、一頁式團主註冊、資料頁單一儲存、需求表單頂端聯絡提醒、詳情頁下一步、總覽待你處理、需求列表篩選、通知連結。
- **跑 Playwright 請用 `PORT=3100 npx playwright test ...`**（先 `npm run build`），直接跑會連到使用者的開發伺服器造成假失敗，見 `docs/backlog.md` 小提醒。
- 這份下面的內容是 2026-09-21 的舊版，「團主開團流程重新設計」相關段落已被上面取代。

## 使用者與合作方式

- 使用者（Franz）沒有寫程式背景，希望邊做邊學技術詞彙。用繁體中文回覆，技術名詞保留英文並附一句白話解釋；每個動作講「做了什麼、為什麼」；小步前進，做一步回報一步。
- 這些偏好在使用者電腦的 `C:\Users\franz\.claude\CLAUDE.md`（全域設定），同一台電腦會自動生效；換電腦／換帳號要另外設定或告知新的 Claude 這些偏好。
- 每次回覆結尾：做了什麼、有沒有成功、使用者接下來要做的一件具體的事。
- **只有使用者明確說了才 commit / push**，而且授權只算那一次。
- 有風險的動作（刪資料、動正式環境、關掉程序）先停下來說明風險。關閉「使用者自己的」開發伺服器程序常常被 Windows 拒絕（存取被拒），這類情況請使用者自己在終端機處理；反過來，如果是本工具自己啟動的、卡住檔案鎖的舊 preview 程序，可以直接 taskkill（但一樣先說明會斷線）。
- 使用者對大範圍的產品／資料庫改動，會主動要求「先規劃」再動工，也會用 Claude Docs 的互動文件（一節一節填、留言討論）當作規劃工具，不急著我自己一次猜完整個方案。過程中常常會推翻前一輪剛做完的決定（例如這次「期望地區」從自由文字改縣市標籤，下一輪馬上又要求改回自由文字）——這是正常的產品反覆試錯，不是我做錯，接手時看到「這輪要推翻上一輪」不用意外，照最新指示做即可。

## 目前狀態（重要：有東西還沒 commit）

- 分支 `main`，最新已推上 GitHub 的 commit 是 `95415e6`（`fran5825/freesoar-yoga-marketplace`）。
- **`git status` 目前有未 commit 的改動**，先跑一次確認：
  - `src/app/organizer/demands/_components/DemandRequestForm.tsx`（已修改）
  - `src/app/teachers/join/_components/TeacherApplicationForm.tsx`（已修改，非常小的調整）
  - `src/app/_components/tag-checkbox.tsx`（新檔案，未追蹤）
  - 這些是「把團主需求表單也套用跟老師申請表單一樣的標籤選單／緊湊狀態列」的改動，做完後使用者還沒實測、也還沒說要 commit，就接著提出更大的「團主開團流程重新設計」需求（見下方）。**這些改動有一部分（服務類型分類、期望地區欄位）會被那個新規劃取代**，建議先跟使用者確認要不要先 commit 這個中繼版本，還是等新規劃做完一次處理。

## 這次（2026-09-20～21）完成並已 commit 的事

1. **全站自稱改成「飛索」**（`c4b3fa5`）：header 品牌署名順序改成「飛索・瑜伽團課共創平台」在上、「Free Soar Yoga」在下；网站多處「Free Soar Yoga」自稱換成「飛索」。**注意**：AGENTS.md 提到的「Free Soar」母品牌（涵蓋未來 Wellness/Academy/Retreat 等模組）跟「飛索」這個瑜伽產品是兩個層級，about 頁刻意保留「Free Soar 品牌」原文不動，不要混著換。
2. **公開瀏覽頁補上共用 header**（`d1ac6ac`）：`/classes`、`/classes/[課程ID]` 補上 `PublicHeader`/`PublicFooter`。全站還有 24 個「登入後」頁面完全沒有 header，這是**獨立的待規劃項目**，見 `docs/backlog.md` 第 5 項。
3. **老師申請表單大改版**（`95415e6`）：
   - 新增 `TeacherProfile.preferredSessionLengthMinutes`／`preferredFrequency`／`preferredLocationType`／`preferenceNotes` 四個欄位（migration `20260920003945_add_teacher_profile_preferences`）。
   - 「擅長類型」「服務地區」「授課形式」「教學年資」從自由輸入文字/數字，改成標籤選單（tag chips）／下拉選單，選項清單集中在 `src/app/teachers/join/_lib/application-fields.ts`（`TeacherApplicationForm.tsx` 跟 `teacher/profile/page.tsx` 兩處共用同一份）。
   - 老師申請頁的「準備狀態」區改成緊湊狀態列（左邊狀態標籤、右邊按鈕），上下各放一個，必填沒填完會鎖住送出審核並顯示警示色，各動作會互相清掉對方的訊息。
   - `admin/teachers` 審核頁同步顯示新欄位。

## 這次做了但還沒 commit 的事

- 把上面「標籤選單＋緊湊狀態列」的設計套用到**團主需求表單**（`DemandRequestForm.tsx`，`/organizer/demands/new`）：
  - 抽出共用元件 `src/app/_components/tag-checkbox.tsx`（老師、團主表單都用這個）。
  - 「期望地區」從自由文字改成 22 縣市標籤（**這個決定馬上就要被推翻**，見下方新規劃的決策四）。
  - 「期望時段」改成標籤樣式（選項文字沒變）。
  - 加上「必填沒填完鎖住送出審核」＋警示色，狀態列比照老師端的緊湊設計。
  - 「服務類型」「適合對象」「上課頻率」**選項文字完全沒動**——這些是先前產品主已確認的定案，不要在後續規劃中不小心整包換掉而沒說一聲。

## 尚未實作、需要接手規劃的大方向：團主開團流程重新設計

使用者對團主端提出了一次更大的重新設計需求（多組織、三態頁面、服務類型分類、地址欄位、文案整合），已經用 Claude Docs 開了一份互動文件討論，內容完整備份在 **`docs/organizer-flow-redesign-plan.md`**（純文字、不受 Claude 帳號限制，一定讀得到）。Claude Docs 那份互動版連結：<https://claude.ai/code/artifact/4a22ebb5-3fce-4418-bac5-5a58bb132fcc>——**這個連結歸屬在建立時的 Claude 帳號下，換帳號不一定看得到或改得動**，一切以 `docs/organizer-flow-redesign-plan.md` 為準。

這份規劃**還沒有使用者的最終回覆**，文件最後「尚待你確認的問題」有 5 個開放問題，開始寫程式前務必先確認：

1. 一個團主要能建立多個組織（目前 `OrganizerProfile.userId` 是 `@unique`，`organizationId` 也是單一欄位，要改成一對多）。
2. `/organizers/request` 要依「沒登入／登入沒團主資料／登入已有團主資料」三種狀態顯示不同內容，比照 `teachers/join` 的 gated 頁面拆法。
3. 服務類型要不要整份換成跟老師擅長一樣的四大分類（會推翻先前「已確認定案」的 7 個服務類型）。
4. 期望地點要改回自由輸入具體地址／場地名稱，不要用縣市標籤（推翻這次剛做的改動）。
5. 行銷首屏文案要合併、拿掉右側卡片，草稿已經寫在規劃文件裡。

## 已定案的決策（別重新討論，2026-09-19 以前）

- 首頁採「團主／學員／老師三方平等」，不採 copy deck 的「老師優先」版面。主 CTA 是「我想發起團課 →」，次要是「找一堂適合我的課」。
- 視覺沿用網站既有的品牌色、字體、圓形色塊；不採用規劃資料夾裡的版面與視覺。
- 手機號碼＋密碼登入**不做**；LINE／Facebook 登入排在品牌質感之後（見 backlog 第 4 項）。

## 文案來源與規則

規劃文件在專案**外面**：`C:\Users\franz\OneDrive\Documents\free-soar-yoga-planning-reference\2026-09-16\`（5 個檔案：messaging-house、site-copy-rules、homepage-copy-deck、teacher-class-hub-direction、teacher-review-standard）。換電腦要一起複製。

必守的用語規則（摘自 site-copy-rules）：
- 品牌署名固定兩行，但**順序已在 2026-09-21 改成「飛索・瑜伽團課共創平台」在上、「Free Soar Yoga」在下**（跟原始 site-copy-rules 寫的順序相反，這是使用者本次明確要求的改動，之後接手照這個新順序）。
- 中文統一用「瑜伽」，不用「瑜珈」。首頁 Hero 不用 `marketplace`。
- 不可說「Free Soar 認證老師」「保證安全」「最優質老師」。審核只能用現階段句子：「老師申請資料會由平台確認，通過後才可回應需求或建立公開課程。」
- 不提前承諾未完成的功能，不虛構案例與數字。
- teacher-review-standard 是「尚未實作的產品政策」，不構成工程授權；改資料庫、權限、狀態機前要先取得使用者確認。

## 怎麼跑與驗證

- 開發：`npm run dev`（專案設定在 `.claude/launch.json`，已加 `autoPort` 保險）。Next.js 一個專案只能開一個開發伺服器；改了 Prisma schema 要跑 `npx prisma migrate dev` + `npx prisma generate`。
- **常見卡點**：`npx prisma generate` 在 Windows 上常常被「正在跑的 `npm run dev`」佔用 `query_engine-windows.dll.node` 檔案而失敗（`EPERM`）。解法：請使用者自己把 `npm run dev` 停掉（`Ctrl+C`），確認 `tasklist` 沒有殘留的 node.exe 程序後再重跑 `prisma generate`，跑完再請使用者重新啟動開發伺服器。
- 型別與規範：`npx tsc --noEmit`、`npx eslint <file>`。這次全程用這兩個工具驗證每一輪改動，沒有跑 `npm run lint`（整個專案）也可以，但更快。
- 測試：`npm run test:smoke`（會先 build）。**用開發模式跑 `teacher-join` 會因為頁面還沒載入完就被點擊而失敗**，請用正式建置：`npx next build`，再 `PORT=3200 npx playwright test ...`。
- 完整測試目前有一大批失敗，原因是測試把開課日期寫死成 `2026-09-01`（已過期），記在 backlog 1b，跟這次改動無關。
- 登入需要 Google 帳號，助手不代替使用者登入；看登入後頁面的畫面要請使用者自己看並截圖／描述。

## 下一步

見 `docs/backlog.md` 跟上面「團主開團流程重新設計」。優先順序：
1. 確認上面「還沒 commit 的事」要不要先 commit。
2. 陪使用者把「團主開團流程重新設計」的 5 個開放問題談完，才開始動工（會動到資料庫結構，屬於需要先取得明確確認的改動）。
3. backlog 第 5 項（登入後頁面缺 header）跟第 1b/2/3/4 項仍待處理。
