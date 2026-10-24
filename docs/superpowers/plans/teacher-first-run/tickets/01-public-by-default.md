# 01: 老師開課預設公開，並沿用上一堂的公開設定

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 老師第一次開課（單堂或系列）時，「公開列表」預設為列在公開列表；之後開課沿用上一堂的選擇（包含明確選了「僅透過連結招募」）。選項旁有白話說明：僅透過連結招募時，學員要先登入才看得到課程內容。分享文案的「需要先登入」那句只在僅透過連結招募的課出現。已建立的課完全不變。

**Blocked by:** None (can start immediately)

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 讀取「上一堂預設值」的 own-scoped 查詢加一個欄位（不放寬權限）；不改可見性規則

- [x] 沒有任何課的老師，單堂與系列建課表單的公開列表預設為列在公開列表
- [x] 上一堂是公開的老師，預設公開；上一堂是僅透過連結招募的老師，預設僅透過連結招募（單堂、系列都驗）
- [x] 選項說明寫出「學員要先登入才看得到課程內容」
- [x] 分享文案只在僅透過連結招募的課出現「需要先登入」
- [x] 既有課程的 isPublic 不被任何程式改動
- [x] 相關 smoke 測試通過（建課、分享文案）

## 進度紀錄

- 2026-10-24：`getOwnLatestClassFormDefaultsForTeacher` 加讀 `isPublic`，表單沒有上一堂時預設公開、有上一堂就沿用（含 false）；選項改名「僅透過連結招募」並說明要先登入；分享文案的登入提醒只在僅透過連結招募時出現。tsc、lint 通過；smoke（teacher-class-usability、share-templates、series-member-info）因本機 PostgreSQL（Docker）未啟動尚未執行。
- 2026-10-24：smoke 通過——teacher-class-usability 15/16（1 個手機版失敗是既有問題）、share-templates 14/14、series-member-info 16/16。兩個手機版失敗在改版前的 66363eb 也一樣失敗，與本票無關：teacher-class-usability「leaving with unsaved input」（手機版找不到可見的 /teacher/dashboard 連結）、teacher-initiated-open-classes「action buttons only appear…」（草稿的「取消課程」在手機收進「更多」）。
