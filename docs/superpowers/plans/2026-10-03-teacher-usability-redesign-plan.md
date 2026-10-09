# 老師流程第二輪實作計畫

日期：2026-10-03。

狀態：`tickets-published-draft-awaiting-builder-approval`。Q1–Q20 已確認採 A；產品主人以「1」核准在目前 task 發布已提案八票。票券與第一票候選 prompt 完成，尚未實作；整體 shared understanding 與個票 Builder 尚待確認。本次不授權程式、commit／push 或部署。

**2026-10-09 實際狀態：** 八票已全部實作完成（2026-10-04）。上方狀態為歷史紀錄。

## 1. 規格與決策來源

- `docs/specs/teacher-usability-redesign-spec.md`：完整呈現規則、領域邊界與驗收條件。
- `docs/teacher-usability-plan.md`：2026-10-03 第二輪訪談；保留第一輪歷史，最新確認項目優先。
- `docs/context/glossary.md`：單堂、每週固定、指定日期、課程系列、老師開課的用詞。

已讀老師申請、開課、列表、單堂／系列詳情、TeacherShell、相關 actions／read-service、權限／狀態／資料模型與 smoke。查證結論：主要變更是 UI／導覽及失敗回傳，不需 Prisma migration 或新 marketplace 狀態。

## 2. 工作分類與風險

- 現階段：已授權的 docs-only batch，完成八票發布與同步；source read-only。
- 整體實作：Standard workflow，risk = medium；涉及 UI core flow、建課 action 的錯誤回傳，以及取消／婉拒防誤觸。
- Auto-enter Builder = no；原因是 skill 要求整體 shared understanding，且需核准第一票具體執行範圍。
- Auth、Prisma、角色、權限、狀態轉換及通知副作用保持既有約定；不新增公開系列、編輯課程、付款或其他 V1 外功能。
- 01 單堂與 02 重複建課 actions 分別可調整 transport／失敗回傳，但必須沿用原 domain service、輸入值與資格檢查，不修改 mutation policy。
- 目前 `main` 有其他 task 的 admin、團主、學員文件／程式／測試變更；保留全部現有內容。本工作只修改明列的老師檔案與對應測試／文件，不把整個 working tree 當成自己的 diff。

## 3. 八票、依賴與四階段里程碑

| 里程碑 | 交付票券 | 驗收與邊界 |
| --- | --- | --- |
| 1 開課與單堂詳情 | 01 單堂開課、02 重複開課、03 單堂詳情 | 分票驗證摘要、失敗保留、成功導向及操作；新建入口移到 04 |
| 2 列表、系列與入口 | 04 我的課程、05 系列管理、07 暫停老師入口 | 分類、安全返回、逐場 counts、取消確認及既有讀取導覽；不新增公開或批次操作 |
| 3 老師申請 | 06 必填集中與摘要送審 | 七項必填、草稿 snapshot、timeout、二次摘要、各審核狀態；保留原 Auth 與審核 |
| 4 整體驗收 | 08 老師完整旅程驗收 | 前七票各自先驗收，再整合完整路徑、角色、RWD 與品牌 |

完整票券索引：`docs/superpowers/plans/teacher-usability-redesign/tickets/README.md`。全部 draft／STANDARD／Human Gate yes，風險為 BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK；沒有實際 HEAVY 票，若需要改 Auth／schema／權限／state machine 等 policy，停止並另提 HEAVY decision plan。

真正依賴：02 ← 01；04 ← 03；05 ← 03＋04；08 ← 01–07。01、03、06、07 無票券依賴；05 可用既有系列驗收，因此不依賴 02。建議一次一票依編號推進，但不把優先順序當成 blocker 或平行 agent 授權。

各票 allowed files 與 checks 須落實並核准後才進入實作；每票各自驗收，不把測試全部延到 08、不把第一票完成誤報為整體完成。

## 4. 第一票的工程落點

- 使用現有 ClassSessionCreateForm state 保留切換模式輸入；抽出局部型別、摘要或離頁提醒 helper 只在老師建課目錄中。
- 單堂 action 失敗回傳可序列化結果，成功仍使用原成功 id 導向；不以 catch 所有例外吞掉 Next.js redirect，不把未確認成功的例外當作可重複寫入。
- 單堂摘要使用表單內實際值，取代單堂 confirmCreate。共用卡片與模式標籤可在本票呈現，但另外兩模式繼續用既有建立核對及提交；完整重複摘要、checkbox 移除與 action 失敗回傳在 02。
- 01 不新增取消確認元件、不改詳情或列表。03 完成詳情與取消／婉拒確認，04 才上移新建入口及接入返回來源。
- 兩種重複模式可建立且切換輸入保留，避免第一票把既有功能關掉等待第二票。

## 5. 驗證計畫

1. `git diff --check`、TypeScript、ESLint、build。
2. 01 targeted Playwright：老師單堂建立、瑜伽類型／既有驗證與成功詳情導向；回歸重複建立既有成功路徑。其他票依各自受影響流程驗收。
3. 01 只改單堂 confirmCreate 的舊預期，保留重複模式至 02、團主同名勾選與真正報名 consent；03 再改詳情順序及取消／婉拒測試。
4. 01 新增有意義情境：衝突或 service 驗證失敗保留輸入、摘要對應實際提交、離頁取消留原值、成功導向不誤報未存。取消確認前無寫入與視窗返回屬 03／05。
5. 375px／768px／1440px 畫面 QA，檢查長內容、focus、觸控按鈕、錯誤、空狀態及待審名單。
6. 測試以獨立 port 和正式 build 執行；先確認 port／build 鎖可用，不關閉使用者或其他 task 的程序。Smoke 會建立／清理測試 fixture，只使用現有本機 smoke 環境，不接 production。
7. 若 repo-wide checks 被其他 task 變更擋住，區分既有／外部變更與本片問題，保留 log，修復限定在 allowed files；不修改 admin／團主／學員程式來通過 checks。

目前沒有獨立 unit test script／Vitest 依賴；不為本片安裝測試框架。需要新增純函式測試時，可沿用現有 Playwright test runner 的非 browser 測試能力，檢驗輸入與時間邊界而非鏡像 UI 結構。

## 6. 文件同步

本輪已發布票券索引及八票，同步本計畫、規格切片表、訪談記錄與單堂第一票候選 prompt，移除原大切片 prompt 的執行範圍。僅 docs 檢查，未執行或宣稱 TypeScript／build／smoke／畫面驗收通過。

- 各票實作後更新老師計畫與規格的實作狀態，保留未完成票券。
- 相關 class spec 與 state-transition-details 只更新畫面確認方式／action adapter 行為，保持完整 draft 與明確開放語意。
- route-map 與 permissions 的列表／詳情位置描述只做必要局部更正；共享檔案先重讀最新內容。
- 不修改 Auth 文件、資料模型、狀態轉換政策；如實作發現必須變動，停止另提產品決策。

## 7. 完成與停止條件

- 完成一票 = 該票 allowed scope 內各項驗收與必要 checks 完成，產出 Builder Review Packet；沒有完成剩餘票券的宣稱。
- 需要 forbidden area、新增套件、改 service policy、改權限／資料／狀態、公開系列、課程編輯或觸及 production 即停止。
- check 修復會擴 scope 時停止；若只是外部變更造成失敗，回報驗證限制及可行下一片，不偷改其他 task 的內容。
- 仍禁止 auto commit、push、deploy、替使用者發布真實課程或通知。

## Recommended Next Step（Common Handoff Schema）

- Level：L3。
- Recommended next work mode：Product Owner Decision → 核准後 STANDARD Builder。
- Next smallest actionable slice：`teacher-usability-redesign/01-builder-prompt.md` 的票 01 單堂開課。
- Why this should be next：先完成可建立、可核對、失敗可修正的一條路徑，供 02 重複開課沿用，再完成詳情與導覽。
- Can Codex execute directly：本輪票券文件已完成；Builder 需整體 shared understanding 與 01 執行確認。
- Suggested execution location：current task，維持訪談脈絡；new task 也可使用完整候選 prompt。
- Requires product owner decision：是，確認整體設計及 01 執行；不重新詢問 Q1–Q20 或八票拆分。
- Suggested next prompt：完整內容見 `docs/superpowers/plans/teacher-usability-redesign/01-builder-prompt.md`，複製該文件的「可複製執行 prompt」。
- Auto-continue allowed：僅 read-only／已授權 docs 記錄可；程式 Builder 暫不可。
- Auto-continue reason：八票文件授權已取得且完成；skill 的整體確認與個票執行尚未取得。
- Stop condition triggered：尚未取得 shared understanding／01 執行確認。
- Notify human：是。
- Notification reason：請產品主人檢視具體規格與候選 prompt，確認後可執行。
- Approval noise reduction applied：是，未重問已確認項目，查證、記錄與驗證連續完成。
- Approval boundary note：Q1–Q20 與八票文件已核准；不是 source Builder、commit／push／部署或剩餘票券的空白授權。
