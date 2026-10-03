# 老師流程第二輪票券

日期：2026-10-03。產品主人以「1」確認在目前 task 將已提案的八票寫入本地文件。八票拆分與依賴已確認；全部維持 `draft`，尚未授權 source Builder、commit／push 或部署。

來源：[整體規格](../../../../specs/teacher-usability-redesign-spec.md)、[分批計畫](../../2026-10-03-teacher-usability-redesign-plan.md)。沿用 Q1–Q20 已確認設計，不重啟產品選項。

## 執行授權紀錄（2026-10-04）

產品主人採用精簡版執行 prompt，授權依 01 → 08 逐票實作（取代上方「尚未授權 source Builder」的歷史狀態）：每票跑 tsc＋lint＋受影響 smoke，通過後在本機 commit 該票檔案（不 push），04、08 加跑 build 與完整 RWD，08 寫完整 review packet。禁止事項與停止條件照各票與 `01-builder-prompt.md`。

## 票券索引

| 票 | 完成結果 | Blocked by | Workflow mode | Human Gate | Status |
| --- | --- | --- | --- | --- | --- |
| [01 單堂開課](01-single-class-creation.md) | 分區、摘要、錯誤保留、離頁提醒，成功建立完整 draft | None | STANDARD | yes | done（2026-10-04） |
| [02 重複開課](02-recurring-class-creation.md) | 每週固定與指定日期完整建立、核對與失敗修正 | 01 | STANDARD | yes | done（2026-10-04） |
| [03 單堂詳情](03-class-detail-actions.md) | 重點與操作置頂，處理報名及取消確認 | None | STANDARD | yes | draft |
| [04 我的課程](04-class-list-navigation.md) | 分類、建立入口、系列連結、安全返回與位置 | 03 | STANDARD | yes | draft |
| [05 系列管理](05-series-management.md) | 逐場日期／狀態／人數、詳情返回、取消確認 | 03、04 | STANDARD | yes | draft |
| [06 老師申請](06-teacher-application.md) | 必填集中、即時缺項、摘要送審與各審核狀態 | None | STANDARD | yes | draft |
| [07 暫停老師入口](07-suspended-teacher-navigation.md) | 原查看資格下找得到既有課程 | None | STANDARD | yes | draft |
| [08 完整旅程驗收](08-teacher-journey-acceptance.md) | 全旅程／RWD／品牌／角色邊界驗收證據 | 01–07 | STANDARD | yes | draft |

所有票的風險標籤為 BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。既有 domain 寫入、權限、狀態與通知規則不改；STANDARD 不代表可略過核心流程的產品確認。

## HEAVY 票

目前沒有：不變更 Auth、Prisma schema／migration、權限模型、state machine、package、env、deploy 或 payment。05 只擴充 own-scoped 的既有 read DTO 推導 counts；07 只呈現原已允許的讀取入口。

若實作發現必須變更上述邊界，停止該票、另提 HEAVY decision plan 與產品主人確認，不用 STANDARD 票授權繞過。

## 依賴與執行方式

- 初始依賴 frontier 是 01、03、06、07；這表示技術上可獨立開始，**不是 source 執行授權或平行 agent 授權**。
- 02 沿用 01 的表單與錯誤保留；04 在 03 的詳情操作路徑整合返回；05 沿用 03 確認介面與 04 返回機制。
- 05 不依賴 02，既有系列即可驗收；08 需前七票全部完成。
- 建議一次一票依 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 推進，優先驗證開課到處理報名，再補完整導覽與申請。序列是優先順序，不增加虛構 blockers。
- 每票各自完成必要 tests／RWD／self review；08 是整合驗收，不是把所有測試延後。
- 不建立水平式元件／API／tests 票。必要的局部整理隨最早能展示完整成果的 01 或 03 交付。
- 每票 Builder 前另落實 allowed files、checks 與 stop conditions；票券本身避免寫容易過時的 source 路徑。01 的完整候選 prompt 位於上層 `01-builder-prompt.md`。
- 依個別票驗收完成更新狀態，保留未完成票；完成 milestone 不等同全部老師流程完成。

## 四階段里程碑對照

| 原里程碑 | 實際交付票 | 邊界 |
| --- | --- | --- |
| 開課到單堂操作 | 01、02、03 | 不在一票塞三排程與詳情；建立入口移至 04 |
| 列表、系列與入口 | 04、05、07 | 安全返回、逐場資訊及暫停既有讀取入口 |
| 老師申請 | 06 | 沿用既有 Auth 與審核政策 |
| 整體驗收 | 08 | 不能代替前票驗收或擴 source 修正授權 |

## 本輪文件 self review

- 只發布八票、索引並同步規格／計畫／候選 prompt／訪談紀錄，未修改程式或執行功能測試。
- 保持 V1；沒有 Wellness／Academy／Retreat、AI matching、複雜付款／退款、native App 或老師完整 SaaS。
- 角色、權限、資料模型、state machine 與 route policy 不變；各票寫明必要邊界及測試，畫面與安全驗收尚待實作後完成。
- 已確認拆分與依賴；整體 shared understanding 與個票 Builder 授權尚待取得。
- 未修改其他 task 的檔案內容，未 commit／push。
- 文件驗證通過：八票必填欄位、驗收項、索引連結、Markdown code fences、新增文件 whitespace 與老師計畫 tracked diff whitespace。僅有 Git 的 LF／CRLF 提示；未執行程式 checks 或畫面驗收。

## Recommended Next Step（Common Handoff Schema）

- Level：L3。
- Recommended next work mode：Product Owner Decision → 本票核准後 STANDARD Builder。
- Next smallest actionable slice：01 單堂開課。
- Why this should be next：先完成一條能實際建立並保留失敗輸入的路徑，供 02 沿用。
- Can Codex execute directly：本輪文件完成；程式需產品主人採用候選 prompt。
- Suggested execution location：current task 優先，new task 亦可用完整 prompt。
- Requires product owner decision：確認整體 shared understanding，並核准 01；不重問 Q1–Q20 或八票拆分。
- Suggested next prompt：上層 `01-builder-prompt.md` 的「可複製執行 prompt」。
- Auto-continue allowed：本輪已授權文件可；source 尚不可。
- Auto-continue reason：拆票文件授權已完成，個票 Builder 尚未核准。
- Stop condition triggered：source Builder 的授權邊界。
- Notify human：是。
- Notification reason：票券與第一票候選 prompt 已可檢視。
- Approval noise reduction applied：是，沿用已確認的八票及設計，不重問。
- Approval boundary note：本次「1」核准本地票券文件，不授權 source、後續票、commit／push 或 deploy。
