# Teacher-first Launch Readiness（老師先行推出盤點）

建立日期：2026-10-04。最近更新：2026-10-05。狀態：`inventory-complete-awaiting-shared-understanding`。

## 目前結論（先看這段）

Q1–Q11 已逐項確認。推出目標為：3–5 位老師帶既有學員，先跑 4 週真實試營運；支援逐堂＋期班整期報名／請假、改課、關鍵 email，以及報名前可見的課費／付款聯絡／取消退款資訊。老師站外收費，飛索不代收也不追蹤付款，由產品主人親自支援。

**這是推出盤點完成，不是程式完成、正式上線或 Builder 授權。** 2026-10-05 已重新唯讀查證，基準為 `main`／HEAD `0c908de` 加當時 working tree；其他 task 仍有未提交的 schema／migration／docs 變更。下面「已實作」只代表 source 與既有紀錄，仍需產品驗收與 release baseline 驗證。

| 類別 | 現況 | 下一件具體工作 |
| --- | --- | --- |
| 已有基礎 | 老師申請／審核、逐堂建課／報名名單／分享按鈕 | 保留並做整合驗收，不重做 |
| 已新增實作 | 排課票 01–05：一次開放、續開提醒、後續場次取消、單堂／系列改課 | 核對既有測試紀錄、產品主人實看畫面；改課尚不含公開設定 |
| 已修復 | 不公開分享連結的匿名登入引導、callback 安全、一鍵 Google 登入 | 本機已有驗證；正式網域、首次帳號建立與完整返回路徑仍要驗 |
| 首波必做、未完成 | 期班／整期報名、請假退出、老師整期名單與一次確認、補課、期班分享與學員呈現 | 沿用既有排課票 06–13，不重新切一套重複票；06 是目前 07 的前置依賴 |
| 首波必做、未完成 | 真實 email 寄送、課費／付款聯絡／取消退款資訊的必填與報名前呈現 | 分別落實 email 草案及 Q9 的資訊規格，不加入付款追蹤／金流 |
| 啟動前營運準備 | 隱私與平台條款、固定支援入口、正式 Admin／OAuth／部署與資料保護流程 | 填寫真實營運資料、核准內容與環境操作，再驗證；不能虛構聯絡方式 |
| 最後推出 gate | 明確版本的 typecheck／lint／build／必要 unit／E2E、角色與狀態、RWD／品牌、實際 email 和正式環境操作 | 全部有證據才邀請真實首批使用者；當前不能宣稱可直接推出 |

**建議開發接續**：先由產品主人檢視已完成改課，核對既有排課票 06 的開工設計與當前共享 schema；沿原依賴完成 06–13。課費資訊規格與 email 規劃可先獨立查證；涉及共用 schema／課程頁時協調施工順序，不把技術可獨立視為平行 agent／多票 Builder 授權。信任／支援內容與正式環境準備在邀請前完成，最後集中驗收推出 baseline。

可延後：線上金流與收款追蹤、代登／匯入名單、共授／代課、管理員指派 UI、LINE／Facebook 登入、非必要老師 SaaS 工具。既有團主與 admin 工作保留其原授權，不接管，也不把整套未完改善當成老師 pilot 的依賴。

4 週回顧門檻：至少 3 位老師走完真實開課→分享→報名→名單管理，涵蓋逐堂及期班；至少 2 位願續用／已有續用行為，無未處理的核心流程阻斷與重大安全問題。達標才評估小幅擴大老師招募，未達就修正與延長；學生端主動推廣另外驗收供給與公開使用旅程。

參考另一項 `2026-10-05-teacher-first-growth-strategy-plan.md`，拓展訪談另記每週兩小時／持續兩個月與尚待答的最多三位老師提案。本輪不替它定案或改寫：三位可落在本輪 3–5 位內，四週可作八週中間回顧；真正啟動前仍須核對產品主人的可投入時間與支援承諾，不能把兩份訪談的不同數字當成已合併批准。

## 需求與授權

產品主人希望用 `grill-with-docs` 盤點還有哪些功能要完成才能正式推出；初步方向是「給老師好工具，讓很多老師先合作，再往學生端推廣」。這是推出次序的探索，不等於變更 V1 scope、首頁三方定位、角色／權限或 marketplace 規則。

本輪為 PLANNING_ONLY：查證 repository、建立盤點文件與逐輪訪談。可以更新本文件；確定術語時依 skill 同步 glossary；有真正需要保存的取捨才新增 ADR。沒有 source Builder、migration、資料庫操作、測試 fixture、commit／push 或部署授權。既有 working tree 含其他任務變更，全部保留。

使用流程：`.claude/skills/grill-with-docs/SKILL.md`、`grilling/SKILL.md`、`domain-modeling/SKILL.md`。此環境無 Skill 呼叫工具，直接讀取三份 instructions 並組合執行；grilling 要求環境事實由 read-only 子代理查證，本輪以兩項查證工作執行。

## 持續任務清單

- [x] 讀取 AGENTS、風險工作流、next-step 規則、V1、品牌與 founder intent。
- [x] 找到並讀取 grill-with-docs 與其兩個組成 skill。
- [x] 對照最新老師八票 packet／README 與 2026-10-04 排程設計，辨別過時文件。
- [x] 完成老師工具與合作模式的 source 查證。
- [x] 完成通知、公開信任頁、Auth、營運與部署證據的 source 查證。
- [x] 第一輪：確認首波合作價值與開放程度。
- [x] Q5：初期站外收費、不追蹤收款，未來依痛點另案規劃。
- [x] Q4：老師分享連結，學員自行登入、報名。
- [x] Q3：逐堂報名及期班整期報名／單場請假都列首波必要；題號已確認。
- [x] Q6–Q8：改課與關鍵 email 首波必備；3–5 位老師先觀察 4 週。
- [x] Q9–Q11：課程資訊報名前可見、產品主人親自支援、依 4 週使用與續用證據回顧。
- [x] 按第一輪答案展開：實際工作情境、人工營運邊界、推出驗收標準。
- [x] 對照每個情境列出已有、缺失、待驗證與待決策。
- [x] 明確分出首波必做、學生推廣前必做及可延後項目。
- [x] 整合清單前重查當前 source／票券進度，避免將其他 task 已完成的功能重列為缺口。
- [ ] 產品主人確認 shared understanding，再提出最小實作切片／票券候選。
- [x] 盤點文件 read-back 與 self review；仍不能把規劃完成當成推出驗收通過。

## 已知文件時效與證據規則

- `docs/product/current-functional-architecture.md` 的基準是 2026-08-07，仍描述已移除的 `/account`，只能作歷史導覽。
- `docs/handoff.md` 有 2026-09-26 更新，不能取代 2026-10-04 的 code、票券執行紀錄與 review packet。
- `2026-10-03-teacher-usability-redesign-plan.md` 開頭仍寫八票 draft；較新的票券 README 和 `teacher-usability-redesign/08-builder-review-packet.md` 已記錄八票完成及本機 commit。不能誤列成八票都未做。
- `docs/specs/teacher-class-scheduling-spec.md` 是 `approved-design`：期班／整期報名、改課、批次開放與系列公開等設計已確認，但文件明示不是 Builder 授權。仍須 source 查證，不把設計當成實作。
- 引用其他工作測試結果必須標為「既有紀錄」，本輪不重跑應用程式測試，不宣稱當前整合版本或 production 通過。

## 決策樹與第一輪 frontier

```text
老師先行推出
├─ Q1 首波合作的主要價值（已答：老師自己的開課與既有學員管理）
│  ├─ 老師自己的開課與既有學員管理
│  ├─ 老師與團主／企業／社群的授課合作
│  └─ 老師彼此共授、代課或共同經營
│     └─ 角色、課程歸屬與權限影響：答案確認後才展開
└─ Q2 第一階段開放程度（已答：邀請制真實試營運）
   ├─ 邀請制真實試營運
   ├─ 公開招募老師，學生端暫不主動推廣
   └─ 老師與學生同時公開推廣
      └─ 規模、營運承諾與推出驗收：答案確認後才展開
```

Q1 建議：先用既有 marketplace 能力支持老師開課與既有學員；但若產品主人指老師彼此授課合作，要獨立確認，不能默認已有。

Q2 建議：先邀請少量合作老師真實試營運，再擴大老師招募。邀請制只是一項建議，不代表可略過資料保護、權限與必要驗證。

本輪沒有重問已定案的 Q1–Q28 排程設計或老師八票 UI 決策。

## 第一輪答案（2026-10-04）

- Q1：老師用平台開自己的課、管理既有學員。
- Q2：先邀請少量老師與其既有學員試營運。
- 確定術語：老師先行試營運，已同步 glossary；不改任何角色、權限或資料模型。
- 推導：不主動向學生市場推廣，仍需要學員能完成分享連結 → 登入 → 報名 → 查看狀態／取消的最低使用流程。老師工具的驗收包含實際學員端，不能只驗老師畫面。
- Q1–Q11 的推出盤點方向均已逐項確認；成功／擴大標準、支援責任與報名前資訊依 Q9–Q11。單項實作與正式環境操作仍需另落實細節與授權，不以此盤點取代 Builder／release gate。

## 第二輪答案（Q3、Q4、Q5 已定案）

1. Q3 首批課程：A、B 都做。單堂／每週固定的逐堂報名，以及期班整期報名／單場請假，都列首波必要；沿用已核准排程 spec 與 ADR 的規則，不重新討論或擅自加規則。
2. Q4 既有學員進入：已確認 A，老師分享連結，學員自行登入與報名；老師代登／匯入名單不列首波必做。
3. Q5 收費處理：已確認平台外收費、不追蹤收款。歷史選項另有手動收款紀錄或僅免費課；不重新詢問同一選擇。

下輪依答案決定改課／缺席情境、提醒與人工營運、推出驗收門檻；不在本輪猜測產品主人尚未回答的前提。

### 第二輪回覆紀錄（2026-10-05）

- 原文：「Q1A、B都做, Q4 A」。
- Q4 明確確認 A：老師分享連結，既有學員自行登入、報名。不因此改變學員身份或老師代報權限。
- 最初有題號歧義：可能指上一輪第一個問題 Q3（兩種課型），也可能修改最初 Q1（老師自行開課與團主合作）。經單題確認，產品主人選「1」，確認指 Q3。
- 正式答案為 Q3 A＋B：逐堂報名及期班整期報名／單場請假都列首波必要；沿用現有排程 spec／ADR 規則，不重啟整期設計，不代表授權全部排程功能或 source Builder。
- Q1 維持老師自開課與既有學員管理；不把團主 15 票自動納入首波必做。

## 第三輪答案（Q6–Q8 已定案）

2026-10-05，產品主人原文：「Q6 A、Q7 A、Q8 A」。

- Q6 改課：首波必備，能修改尚未開始的課程時間、地點與內容，沿用已核准排程 spec；有報名時保留名單，時間／地點異動通知學員。不重問改課規則，不擅自擴至團主媒合課。
- Q7 通知：首波必備站內通知＋關鍵 email，已確認最低涵蓋報名待處理、確認、取消與課程異動。每個事件／角色收件人、寄送／重試與失敗處理仍須在通知規劃列明；課前提醒等其他事件是否先行尚未定案。不將選 A 當成 email 供應商、env、deploy 或實際發信授權。
- Q8 規模：3–5 位老師、每位帶少量真實學員，先觀察 4 週。此為試營運與首次回顧安排，不是 4 週內完成開發或強制公開推出的期限；期班可能超過 4 週，回顧不代表整期生命周期驗收完成。

## 第四輪答案（Q9–Q11 已定案）

2026-10-05，產品主人原文：「Q9 A、Q10 A、Q11 A」。

- Q9：每門課報名前能看清課費、付款方式／聯絡方式、取消與退款約定；款項與退款仍由老師在站外處理。確認的是資訊需求，不是具體退款政策、價格型別、收款追蹤或金流 Builder；欄位／呈現與公開資料邊界需規格化。
- Q10：由產品主人親自陪跑與處理支援，使用一個固定支援信箱／管道；不需先做客服系統或管理員指派 UI。實際信箱／管道與可回覆時間是啟動前營運待填項，不由 Codex 虛構或自動聯絡。
- Q11：4 週回顧時，至少 3 位老師完成真實開課→分享→學員報名→名單管理，整體涵蓋逐堂與期班；至少 2 位願持續使用或已有持續使用行為，且沒有未處理的核心流程阻斷與重大安全問題。未達則修正並延長。達標才評估小幅擴大老師招募，不表示立即學生端全面推廣或自動部署。期班完整規則仍須先技術驗證，真實 lifecycle 後續持續追蹤。

第四輪後預計整合必做／可延後／待驗證清單與 shared understanding；若答案引入新的產品邊界，再只問該分支，不延伸為完整老師 SaaS。實際管理員授權、正式環境、寄送、migration 與部署仍屬後續必要工作，不因訪談定案而宣稱通過。

### 已確認首波必做的整合方向（已按 2026-10-05 查證更新）

| 工作 | 首波必要性來源 | 查證基準與後續落點 |
| --- | --- | --- |
| 老師開課、分享、學員登入返回與報名、老師名單管理 | Q1、Q3、Q4 | 已有基礎；不公開分享連結入口與 callback 安全已修復，保留整合與正式環境驗證 |
| 期班整期報名／請假及完整相依規則 | Q3 A＋B、既有排程 spec／ADR | 期班仍未落地；包含名額併發、整期確認、退出、補課與老師／學員兩端，依既有 06–13 票接續 |
| 老師改課及學員異動回饋 | Q6 A、既有排程 spec | 排課 04／05 已實作與既有驗證；保留產品主人畫面驗收，email 仍待真正寄送 |
| 站內＋關鍵 email | Q7 A | 審核／報名等其他事件沿既有 notification spec 查證；最低核准事件為報名待處理、確認、取消、課程異動，收件人／失敗處理／env 另具體化 |
| 真實試營運的資料與營運準備 | repo release gates、Q2、Q8–Q10 | 隱私／條款、產品主人固定支援入口、admin、OAuth、資料隔離、備份回復與 release baseline 驗證；學員費用／付款聯絡／取消約定為首波必要資訊 |
| 3–5 位老師、4 週使用回顧 | Q8、Q11 A | 至少 3 位走完真實使用路徑、至少 2 位願續用，核心流程與安全無未處理阻斷；學生端主動推廣仍屬下一階段 |

可先延後：線上金流、手動收款追蹤、老師代登／匯入名單、共授／代課、管理員指派 UI、LINE／Facebook 登入及未依核心流程證明必要的 SaaS 工具。團主重設原有工作繼續維持其已核准計畫，不作為此老師自開課 pilot 的自動依賴。

### Q5 延伸討論與確認（2026-10-05）

產品主人先詢問：為了初期開發客群，先不追蹤收款、由老師自行處理金流，上軌道後改為線上金流是否合適。Codex 提出分階段建議後，產品主人回覆「1」，採用 Suggested next prompt 並在目前 task 繼續訪談。

**確認內容**：Q5 採用初期站外收費、不追蹤收款，未來依實際痛點另案規劃金流；請記錄並繼續 Q3、Q4。老師可正常開付費課，不限免費課；飛索初期不代收，也不建立已收／未收追蹤。

**授權邊界**：本次核准此推出策略與文件紀錄；不是線上金流、手動收款紀錄、付款供應商、退款規則、抽成率、平台服務費或永久免費的核准，也不是 source／schema／migration／Builder、commit／push／部署授權。下方階段門檻、招募方法與過渡細節仍屬建議；Q3、Q4 的後續確認另見第二輪答案。

建議採分階段方式：

| 階段 | 建議範圍 | 進入下一階段的訊號 |
| --- | --- | --- |
| 少量老師先行試營運 | 老師可正常開付費課並沿用自己的收款方式；飛索處理課程與報名，不追蹤已收／未收、不代收。學員需知道課費、收款聯絡方式及取消／退款約定；實際呈現方式待規格盤點 | 老師願意重複使用與再次開課，學員能完成報名，並有具體回饋 |
| 視痛點補最小收款紀錄 | 若多位老師反覆遇到漏對帳、催款或不知誰付費，再評估手動已收／未收；這不是必經階段，也不是本輪核准 | 手動紀錄仍耗時，或已有因付款不便而放棄報名的明確案例 |
| 另案規劃線上金流 | 先決定老師直接收款或平台代收、退款與爭議處理、費用及平台營收，再選服務與整合方式；仍須另過 scope／schema／permission／state machine／payment gate | 核准商業與營運規則、技術與服務可用性，並完成必要驗證 |

採用理由：首波是老師帶既有學員，讓老師保留熟悉的收款方式，預期可降低搬移成本；這是產品判斷，尚未經真實 pilot 驗證。初期招募重點應是陪老師開出第一堂真實課、完成學員報名，觀察是否減少訊息往返與名單整理，再邀請願意持續使用的老師推薦同業。可先挑一種使用情境相近的老師群體，避免首批一次驗證太多課型。

必須守住的語意與銜接：

- 飛索不追蹤付款時，報名確認不代表已付款；既有 `confirmed` 的顯示不得被拿來當收款憑證。
- 未來新付款紀錄應與報名／名額狀態分開設計；本輪不先新增空模型或 payment 欄位。
- 過渡建議：先對新課／新一期提供可選線上付款，既有站外付款沿用原安排；沒有證據的舊資料維持未追蹤，不回填成未付款。具體切換規則仍待未來決策。
- 初期不追蹤金額，平台就沒有可靠的實收／退款或交易總額資料，不宜用報名數估成收入或據此計算抽成。
- 合作招募應明確說明試營運期間與範圍、老師如何收費；如未來提供平台付費服務，另談價值與費用，不承諾永久免費或某個尚未核准的抽成率。老師課費與平台服務費是不同問題。
- 「報名流程省事」可由 pilot 觀察；「不追蹤收款仍是好工具」也需驗證，若老師主要痛點正是對帳，應調整優先序。

既有依據：`docs/superpowers/plans/2026-08-03-lightweight-payment-v0-plan.md` 是 DRAFT，已提出站外轉帳＋手動收款紀錄，並主張付款狀態與 EnrollmentStatus 分開；當時的 source 行號與部分報名現況已過時，未來採用前必須重查，不能直接當成核准方案。

外部參考：

- [Paul Graham：Do Things That Don't Scale](https://paulgraham.com/ds.html)：早期人工招募與親自服務首批使用者；本專案的陪老師開第一堂課建議是依此原則提出的推論。
- [Stripe：Connect charge types](https://docs.stripe.com/connect/charges)：不同收款方式影響資金流向、退款與爭議扣款對象。僅用來說明未來付款設計需要先釐清交易關係，不代表推薦 Stripe、確認臺灣可用性或核准供應商。

Q5 已寫入正式答案；未新增 ADR，未更動 glossary／domain／scope／source。當前沒有付款實作，不修改既有付款草案以避免將推出策略誤記成 Builder 授權。

## Source 歷史查證摘要（2026-10-04；後續更新優先）

- 最新 `git log` 已有 `48a0b6e` 複製報名連結與 `85bba16` 防 prefetch 改寫上次身分。部分 packet 與票券尚留舊文字，不能重複列為未實作。
- 老師單堂／系列頁已接入 `CopyEnrollLinkButton`。分享流程須再驗完整訪客入口與登入返回，不能把按鈕存在當成整條流程通過。
- notification sender 僅站內 noop，沒有真正 email sender；`src/app` 未見 privacy／terms 正式頁。
- callback URL 的 open redirect 仍在當前 source：`src/lib/auth/callback-url.ts` 只檢查 `/` 與 `//`，反斜線值會原樣回傳；`src/app/sign-in/page.tsx` 使用其結果 redirect。對應 member 票 05 仍 draft。應列試營運前安全缺口，不能為邀請制而忽略；本輪只讀 code，未執行外站導航或修正。
- admin 第二輪第一批已有實作與驗證紀錄，第二批在其他工作推進，部分狀態文字更新中；本盤點不接管或阻擋其既有授權工作。

## 最新增量查證（2026-10-05）

- 排課票 01–05 已實作，commit `36d56e5`；`teacher-class-scheduling/tickets/README.md` 頂端仍有「全 draft」歷史文字，應採逐票 Status／執行紀錄。04 有 tsc／lint／build、92 smoke 紀錄；05 是首輪 93/98，fixture 修正與偶發案例另重跑通過，不能改寫成同一輪 98/98。產品主人看畫面仍待記錄。
- `src/domain/class-session/__internal__/edit-class-session-core-for-teacher.ts`、`edit-series-from-occurrence-core.ts` 已實作保留報名、衝突／名額檢查與修改後通知；目前發的是站內通知。系列一次開放、生成提醒、從指定場次以後取消亦已接線。
- 分享入口 commit `0c908de`，`ClassSignInGuide.tsx` 對所有匿名不可讀課程一致提供登入引導，不揭露非公開課程存在性；課程登入入口 commit `048b878`，callback helper 與 `callback-url.spec.ts` 已補反斜線／控制字元／同源解析等檢查。本機真實 Google 取消／重試／返回及 122/122 自動化已有紀錄，正式 OAuth／新帳號首登仍需獨立證據。
- schema 的 `RecurringClassSeries` 仍無系列型態／整期報名方式／isPublic，沒有 `SeriesEnrollment` 或逐場報名的整期關聯；現有分享按鈕仍是單場連結。06–13 未完成。
- `ClassSession`／`RecurringClassSeries` 尚無課費、付款說明／聯絡、取消退款約定的專用欄位；建課只有選填 description，無法保證 Q9 每課資訊完整。未來規格先比較現有欄位約束與新增欄位選項，不將專用欄位或金額型別視為已核准方案。
- notification create 仍固定 in_app，sender noop；真實 email 未做。`class_session_changed` 的站內觸發已存在，notification spec 留「未落地」舊字。`class_reminder_basic` 沒有 trigger／copy／排程，保留 V1 預期差距；此輪不默認它包含在 Q7 的最低事件授權。
- privacy／terms／支援聯絡入口尚未交付；正式 admin 策略、部署／migration／資料隔離／備份回復／email 送達與觀察流程未取得完成證據。這是待做或待驗證，不能推論從未部署。
- admin 第二輪 01–11 有實作與畫面驗收紀錄，12／13 仍 draft、第四批總驗收未完成；既有審核／取消能力保留。schema 已有 `OrganizerClassProposal`／`organizer_direct`，舊「團主整組沒做」敘述失效。本輪老師自建課不自動依賴其剩餘所有票。

## 缺口矩陣（2026-10-05）

「已實作」指 repository 有接線；「既有驗證」指其他工作記錄，不代表本輪重驗或 production-ready。

| 能力／條件 | 現況與證據 | 首波判斷 |
| --- | --- | --- |
| 老師申請、審核、資料、列表、報名處理 | 老師八票已完成；`teacher-usability-redesign/tickets/README.md`、`08-builder-review-packet.md` | 保留現有成果，做整合驗收，不重做八票 |
| 單堂、每週固定、指定日期開課 | `src/domain/class-session/service.ts`、老師建課 actions；已實作，現有系列學員逐場報名 | Q3 另要求完整期班能力，不能把現有指定日期當整期報名 |
| 老師分享報名連結 | 已實作並有追加 28 smoke 通過紀錄；`CopyEnrollLinkButton`、commit `48a0b6e` | 已有，不列新增功能；仍需整條鏈路驗收 |
| 不公開連結的訪客登入引導 | `ClassSignInGuide.tsx` 已接線，匿名一致引導登入 | 已修，不重開修復；驗完整正式登入返回路徑 |
| 登入 callback 安全 | `callback-url.ts` 已修復並新增回歸案例，本機 Google 已驗收 | 已修，不重開漏洞票；正式域名／首次建帳號仍待驗 |
| 改課／批次開放／系列公開／續開與補課 | 01–05 已完成改課／開放／提醒／後續取消；06 公開、11 補課未完成 | 已完成部分看畫面並回歸；期班依既有 06–13 依賴接續，無全部 Builder 授權 |
| 期班整期報名、請假、退出、一次確認 | `teacher-class-scheduling-spec.md`、ADR 0005 已定案；schema 尚無整期報名模型 | Q3 已確認 A＋B，列首波重要缺口；需完整老師與最低學員端及既有相依規則，不能只做報名按鈕 |
| 既有學員名單 | 能看待確認／已報名、姓名與備註；沒有代登、匯入、點名或匯出入口 | Q4 已確認學員自報，代登／匯入不列首波必做；不因有 enum 就宣稱已有點名 |
| Email 與提醒 | 只有站內資料通知，sender noop；email 計畫 DRAFT | Q7 已確認關鍵 email 試營運前必做；待處理報名、確認、取消、異動為最低事件，其餘提醒與收件人另落實 |
| 隱私告知、服務／合作條款、支援聯絡 | about／FAQ 存在，privacy／terms 正式 route 與固定支援入口缺失 | 收真實老師／學員資料前需交付並確認內容；Q10 由產品主人支援，本輪不作法律充分性判斷 |
| 報名前課費／付款聯絡／取消退款資訊 | description 目前選填，無完整必填與讀取呈現流程 | Q9 已確認首波必備；先規格化，不增加已收／未收或自動退款 |
| 真實 Google OAuth／production Admin | Google 與 admin guard 已接線；first-admin-strategy 仍待定案，未取得部署實測證據 | 上線操作與驗證缺口；不是要求新增管理員權限配置功能 |
| 最新整合版本測試、RWD、權限 | 有 54 個 smoke 檔與 desktop/mobile 設定；老師 packet 有既有驗證，其他工作仍變動 | 必須對明確推出 baseline 驗證；本輪未執行應用測試 |
| 部署、資料隔離、備份／回復、錯誤觀察、支援處理 | release checklist 有要求，repository 未見完整 production runbook／完成證據 | 待補證據，不推論從未部署；測試 fixture 不得混入真實試營運資料 |
| 團主多團體／直接合作邀請 | 已有 proposal model／organizer_direct 與部分操作；另有未完成票券 | 既有團主工作按原授權接續；不作老師自建課 pilot 全組依賴 |
| 老師共授／代課、LINE／Facebook 登入、名冊匯出、候補、收款紀錄 | 沒有對應完整能力或在 backlog；收款依 Q5 | 不默認首波必做，新增要有真實場景與授權 |

### 候選推出順序（尚未定案）

1. 老師先行試營運：3–5 位老師與少量真實學員；完整分享／登入／逐堂與整期報名、請假、改課與關鍵 email 路徑，加上安全／個資／基本營運準備。4 週為首次使用回顧，不是開發 deadline；其餘工具按相依與後續答案收斂。
2. 擴大老師招募：先用真實 pilot 確認老師能獨立開課、管理名單、再次開課，以及平台能承接審核／支援；通過門檻見待答 Q11。
3. 學生端主動推廣：在有可報名的課程供給與可運作的老師工具後，完成搜尋／內容／通知與公開信任流程整體驗收。門檻尚未決策，不提前承諾日期。

## 本輪 self review 與驗證邊界

- 本工作只新增本盤點文件與在 `docs/context/glossary.md` 加入「老師先行試營運」段落；glossary 原有其他任務變更完整保留，不能把整個 `git diff` 視為本工作成果。
- 維持 V1，沒有增加 Wellness／Academy／Retreat、AI matching、複雜付款退款、native App、完整老師 SaaS 或 Google Calendar／LINE 深度整合。
- 角色、permission、state machine、data model 與 route policy 沒有修改；已定案但未落地的期班／改課明確標記。
- 安全：記錄 callback 缺口與不公開資料邊界；RWD／品牌只讀既有證據，未宣稱本輪畫面通過。
- Q1–Q11 已逐項確認；整合盤點完成，待 shared understanding 確認，不進 Builder。
- 未修改無關 source／tests／config，未操作 DB，未 auto commit、push、部署或發送通知。
- 文件 read-back／whitespace 檢查於本輪執行；不跑 tsc／build／fixtures，原因是本輪只有規劃與術語文件變更。
- 2026-10-05 Q5 確認回合：只更新本盤點文件的日期、答案、待辦與授權邊界；本回合沒有修改 glossary 或其他檔案，沒有新增安全、RWD 或品牌風險。
- 2026-10-05 Q4 回合：只更新本文件的確定答案及 Q1／Q3 題號歧義，保留原文；沒有擴大功能、角色、付款或 Builder 授權。
- 2026-10-05 Q3 確認回合：只更新本文件的題號確認、首波課型必要性與第三輪待答問題；沒有修改既有排程設計、source、權限或 schema，沒有新增安全、RWD 或品牌風險。
- 2026-10-05 Q6–Q8 確認回合：只更新本文件的答案、初步必要性與第四輪問題；未核准新退款政策、通知供應商或發布日期，沒有修改 source／tests／schema，未 auto commit／push。
- 2026-10-05 Q9–Q11 確認回合：只更新本文件的定案答案並重新唯讀查證 source；未修改退款政策、glossary、source 或其他工作的票券。
- 2026-10-05 最後盤點：更新本文件的最新矩陣與候選下一步；依 source／逐票紀錄校正過時缺口。只讀既有 checks，未重跑應用測試或畫面，未宣稱 production 通過。文件 read-back／whitespace 與路徑存在性於本輪檢查。

## 共同理解與實作細節的邊界

本輪要確認的是「推出盤點」共同理解：目標客群、首波必要性、未完成工作、可延後功能與驗收門檻。Q1–Q11 已逐項確認；沒有新增須在本輪先決定的產品分支。以下是後續單項工作必須具體化的內容，保留為待規劃／待填，而不在盤點中默默決定：

- 既有排課 06 的當前 Builder／migration 授權、共享 schema 的未提交 baseline、migration 目標環境；後續 07–11 的工程方案及推導規則 gate。
- email 的供應商、寄件身份、每事件收件人、重試／失敗／重複抑制、課前提醒是否納入首波；試寄與真實發信授權分開。
- Q9 資訊如何儲存／驗證／呈現，是否需 schema；老師取消／退款約定的實際文字與平台條款內容。
- 正式網域、第一位 Admin 建置、真實支援管道／時間、資料環境及備份回復、release 操作與授權。

`.claude/skills/grilling/SKILL.md` 要求："Do not act on it until the user confirms you have reached a shared understanding." 因此先將本份具體盤點交產品主人確認；不以盤點完成自動進 Builder、commit／push 或部署。

## Recommended Next Step（Common Handoff Schema）

- Level：L3。
- Recommended next work mode：PLANNING_ONLY／grill-with-docs 訪談。
- Next smallest actionable slice：確認整體推出盤點，然後做既有排課票 06 公開設定的 read-only execution preflight。
- Why this should be next：01–05 已實作，06 是期班建立 07 的既有前置；先核對當前授權與共享 schema，可接續既有工作而不重做／擴 scope。
- Can Codex execute directly：本輪盤點文件已完成；採用下方 prompt 後可做唯讀 preflight，不能自動開始 source Builder 或 migration。
- Suggested execution location：現有 task 優先，保留 Q1–Q11；開新 task 亦可引用本文件與完整候選 prompt。
- Requires product owner decision：是，確認整體盤點；後續具體 Builder 與環境操作仍有獨立 gate。
- Suggested next prompt：下方「可複製 Planning prompt」。
- Auto-continue allowed：僅已授權盤點文件與檢查可完成；未確認前不進下一份 execution preflight。
- Auto-continue reason：產品主人核准逐輪文件紀錄，未核准整合方案後的工程工作。
- Stop condition triggered：整合盤點已交付，待 shared understanding 確認；本輪沒有 source 授權。
- Notify human：是。
- Notification reason：請確認具體推出範圍；可選在本 task 或新 task 做唯讀下一片。
- Approval noise reduction applied：是，沒有重問 Q1–Q11、沒有把已修復缺口重開成票，直接引用 06–13。
- Approval boundary note：確認盤點／選擇 Planning prompt 只授權唯讀 preflight，不代表 Builder、任何資料庫／migration 操作、真實發信、commit／push 或部署。

### 可複製 Planning prompt

```text
我確認 docs/superpowers/plans/2026-10-04-teacher-first-launch-readiness-plan.md 的整體推出盤點：老師先行，3–5 位老師帶既有學員；逐堂與期班、改課、關鍵 email、報名前費用／付款聯絡／取消資訊為首波必要。老師站外收費、不追蹤收款；4 週依使用與續用證據回顧，不代表開發期限。

請依 docs/prompts/codex-repo-aware-triage-prompt.md 執行 Planning / Orchestrator。

任務：對既有 docs/superpowers/plans/teacher-class-scheduling/tickets/06-visibility-settings.md 做下一片 execution preflight，沿用 teacher-class-scheduling-spec 與 ADR 0005，核對前置票 04、05 的實作／產品驗收及本票最新授權，不重新討論已定案的產品規則。

限制：本輪只讀，不修改任何檔案，不生成或套用 migration，不操作資料庫，不讀取 secret，不修改 Auth／schema／permissions／state machine／package／env／deploy，不發送通知、不 commit／push。工作樹有其他 task 的變更，不能 reset／覆蓋／混入。不要開始 source Builder 或自動接續其他票。

請輸出：
1. 最新 repo-aware triage、workflow／risk flags、human gate 與前置是否成立。
2. 當前 schema／migration 的共享變更與協調風險；缺少授權或環境識別時明確標記，不執行 migration。
3. 票 06 的精確 allowed／forbidden files 候選、行為邊界、驗證與 rollback 計畫，沿用公開／own-scoped／老師資格規則。
4. 已存在與待補的產品驗收證據；不要把本機 checks 改寫成 production 通過。
5. 符合本 repo template 的最小 Builder Prompt Draft；尚未核准時清楚保留 Human Gate。
6. 以繁體中文提供 Recommended Next Step 與 Common Handoff Schema，區分 auto-continue、stop／notify 與 approval boundary。
```
