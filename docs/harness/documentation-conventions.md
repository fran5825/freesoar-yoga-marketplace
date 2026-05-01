# 文件系統規範

## 目的

Free Soar Yoga 的 docs 系統是產品、品牌、架構、權限、流程與 AI 協作的共同記憶。

文件必須讓產品負責人容易閱讀、判斷與修改，同時也要讓工程工具、GitHub、部署流程與 AI agent 容易搜尋與引用。

## 命名規則

docs 底下的資料夾與檔名一律使用英文 kebab-case。

範例：

- `free-soar-yoga-positioning.md`
- `brand-rules.md`
- `state-machines.md`
- `documentation-conventions.md`

不要使用中文檔名，例如：

- `品牌規則.md`
- `狀態機.md`
- `文件規範.md`

原因：

- 英文檔名比較適合 Git、GitHub、URL、CLI、部署工具與跨系統協作。
- kebab-case 容易閱讀，也比空格或大小寫混用更穩定。
- 檔名保持英文，未來工程師與 AI agent 比較容易定位文件。

程式與系統命名也一律使用英文。

包含：

- route 名稱
- component 名稱
- function 名稱
- model 名稱
- schema 名稱
- service 名稱
- API endpoint 名稱
- database table / column 名稱
- TypeScript type / interface / enum 名稱

原則是：中文用來說明產品、規格、決策與脈絡；英文用來命名系統、程式、資料結構與協作介面。

不要因為 docs 內文使用中文，就把程式命名改成中文。

## 內容語言

docs 內容預設使用繁體中文。

原因：

- 產品策略、品牌語氣、權限邏輯與流程決策，需要讓產品負責人能快速閱讀與確認。
- 中文內容更適合保留 Free Soar 的品牌細節、使用者情境與決策脈絡。
- 文件是專案的共同記憶，不只是工程備忘錄。

## 技術詞保留

以下情況可以保留英文：

- 程式碼名稱，例如 `UserRole`、`DemandStatus`、`ClassSession`
- 技術名詞，例如 marketplace、dashboard、API、route、schema、migration、service、service layer、component、state machine、permission、MVP、RWD、mobile-first
- 第三方服務名稱，例如 Next.js、Prisma、Clerk、Supabase、Resend、Vercel
- GitHub、CI、部署與測試指令

原則是：英文技術詞可以保留，不需要硬翻；但重要概念要用中文說明它在產品或架構上的意思。

## 文件標題

文件標題可以使用英文或中英混合。

可以接受：

- `# Data Model`
- `# Data Model 資料模型`
- `# 權限規則 Permissions`

但文件內文的說明、決策理由、規則描述與審核重點，應以繁體中文為主，方便產品負責人閱讀與確認。

## 文件更新規則

當以下內容改變時，必須同步更新 docs：

- 產品範圍
- 使用者角色
- 權限規則
- marketplace 狀態機
- 資料模型
- API 或服務邊界
- 品牌定位與語氣
- RWD 或使用者流程
- 發布、測試、安全或審查流程

如果只是程式碼修 bug，但沒有改變產品行為或架構，可以不用新增文件；如果修 bug 讓規則更清楚，應補充到對應文件。

## 寫作風格

文件應該：

- 清楚
- 溫和
- 可決策
- 可追蹤
- 不過度工程化
- 不使用空泛行銷語
- 不把 V1 以外的功能偷偷寫進 scope

每份文件都應該服務一個明確目的：幫助產品判斷、幫助工程實作、幫助測試驗證，或幫助 AI agent 維持一致性。
