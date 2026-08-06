# Brand Visual Design System — Draft Implementation Plan

> Status: DRAFT — 待 Codex peer review 與產品主人多項品牌決策；未授權 Builder 施工。
> Date: 2026-08-02

## 1. Outcome

在不破壞既有 marketplace 功能與正在進行中的 Public Trust Pages 工作的前提下，為 Free Soar Yoga 建立一套可重複使用的品牌視覺系統（design tokens + 元件骨架），並依此系統逐步美編公開頁面（`/`、`/about`、`/faq`、`/teachers/join`、`/organizers/request`）。完成後，網站應該有一致、可辨識、符合「自由飛翔 × 身心靈整合 × 女性成長」品牌精神的視覺語言，而不是目前的 Next.js 預設樣式（`--background: #ffffff` / `--foreground: #171717`，Arial/Helvetica fallback，見 [globals.css](src/app/globals.css)）。

本計畫是「可施工前的 draft」。它不會產生最終 HEX 色票、字體或 logo，只會產生候選方案與 token 架構，讓產品主人做品牌決策。

## 2. Authority and Repo Reality

- 品牌依據：[`docs/context/brand-rules.md`](docs/context/brand-rules.md)、[`docs/context/visual-direction.md`](docs/context/visual-direction.md)、[`docs/context/voice-and-tone.md`](docs/context/voice-and-tone.md)、[`docs/context/founder-intent.md`](docs/context/founder-intent.md)。`visual-direction.md` 只給了**描述性**色彩方向（sky blue / white / gold / soft purple-pink / deep gray），沒有實際 HEX 值；目前 repo 沒有 logo 檔案（`public/` 只有 Next.js 預設 SVG），也沒有定義任何品牌 design token。
- **目前工作樹已有進行中、尚未 commit 的 Public Trust Pages 變更**（`src/app/page.tsx`、`src/app/layout.tsx`、`src/app/teachers/join/page.tsx`、`src/app/organizers/request/page.tsx`、新的 `src/app/_components/`、`src/app/about/`、`src/app/faq/`），對應 [`2026-08-01-public-trust-pages-plan.md`](docs/superpowers/plans/2026-08-01-public-trust-pages-plan.md) 且該 plan 今日（2026-08-02）已取得 Human Decision Record 核准。本計畫**不得**覆寫、重工或搶跑那批未提交的修改。
- 本計畫是對使用者提供的兩份 Gemini 意見（Codex 設計功能生態、v0/shadcn/Claude 客製化藍圖）的分析與整合，見第 10 節。

## 3. Scope

### In scope

- 在 [`globals.css`](src/app/globals.css) 用 Tailwind v4 `@theme` 定義品牌 design tokens（顏色、字體、圓角、陰影、間距節奏），取代目前的預設值。
- 引入 shadcn/ui 作為 headless 元件骨架（button、card、input、dialog 等 marketplace 表單常用元件），以既有 Radix 生態對齊 accessibility。
- 提出 2–3 組候選色票／字體方向（衍生自 `visual-direction.md`），供產品主人選擇或修正。
- 定義一個「wordmark 佔位」策略（在正式 logo 產出前，用選定 token 排版出的文字 lockup），不現在製作正式 logo 美術檔。
- 訂出 AI 生成工具在本 repo 工作流中的**使用邊界**：可用外部工具（v0 / Claude Design / Codex 設計功能等）產生視覺草稿或靈感，但落地程式碼必須回到本 repo 既有 Harness（spec → plan → build → test → review）與 Playwright smoke test 把關，不得繞過。
- 更新 Public Trust Pages 完成、基線穩定後，將 token 套用到既有五個公開頁面。

### Explicitly out of scope

- 正式 logo 美術設計、商標、平面識別系統。
- Auth.js 登入/註冊頁與 authenticated dashboard（member/organizer/admin/account）視覺改版——這些已有既定功能且屬於 [`AGENTS.md`](AGENTS.md) 定義的「one vertical slice at a time」下一階段，不在本計畫內，避免與正在進行的 dashboard 工作衝突。
- 訂閱／採購任何 AI 設計工具（Claude Design、v0 Pro、ChatGPT/Codex 付費方案）——工具採購是產品主人的預算與流程決策，不由本計畫代為決定。
- 改動 Auth、Prisma schema、permissions、marketplace state machines、既有表單 Server Action 行為。
- 不新增部落格、CMS、行銷追蹤、真實課程資料。
- 不部署、不自動發布、不 commit、不 push。

## 4. Product Owner Decision Gates

Builder 開始前，產品主人必須確認以下內容；未確認時只能停在候選方案階段，不得由 AI 自行選定品牌識別。

| Gate | 選項 | Recommended default | Why it matters |
|---|---|---|---|
| B1 主色調方向 | A：晨光飛翔（sky blue + gold，明亮開放） / B：覺醒微光（soft purple-pink + deep gray，沉靜高質感） / C：其他（產品主人自訂） | A（與 `visual-direction.md` 的 sky/gold 順位最前的建議一致） | 色彩是品牌識別的核心，且會被 Codex/Claude 之後每個頁面重複套用，選錯要全站重做 |
| B2 字體策略 | A：維持單一字族（現有 Geist Sans/Mono），靠 weight/spacing 建立層次 / B：加入第二款 display 字體做 Hero 標題 | A（MVP-first，避免多字體載入成本與风格不一致風險） | 多字體會增加 bundle size 與品牌一致性風險，屬於「for now vs later」的產品判斷。**本計畫只實作 A**：Slice C allowlist 未含 `layout.tsx`，且未指定字體來源／載入方式／fallback／subset。若核定 B，視為觸發第 11 節 Stop Condition，需先以本計畫為基礎產出一份小型修訂（含 `layout.tsx` 的 `next/font/google` 載入規格、變數命名、fallback stack），經 Codex peer review 後才能施工 |
| B3 Logo / Wordmark | A：本階段只做文字 wordmark 佔位，正式 logo 另案委託設計師 / B：先用 AI 工具（見第 10 節）產生 logo 草案給產品主人挑選 | A（logo 是長期資產，AI 草案品質風險高，不建議倉促定案） | logo 一旦上線會被大量複製使用，改動成本高 |
| B4 AI 設計工具使用範圍 | A：只用於產生「靈感/草稿」，最終落地一律經 Claude Code/Codex 在本 repo 依 Harness 規則實作 / B：允許直接把 AI 工具（如 v0）產出的元件程式碼貼進 repo，事後補 review | A（本 repo 有明確 Harness gate、brand checklist 與 Playwright smoke，繞過會失去這些保護） | 決定後續 Builder prompt 是否允許引入外部產生的原始碼 |
| B5 套用範圍與時序 | A：等 Public Trust Pages 今日核准的施工完成並穩定後，才開始把新 token 套進五個公開頁面 / B：token 定義與頁面套用同批進行 | A（避免與正在進行中的未提交變更衝突） | 目前 `page.tsx`、`layout.tsx`、`teachers/join`、`organizers/request` 都有未提交的進行中修改 |

B1–B4 未決定前，Builder 可以先做「不影響現有頁面視覺」的 token 定義草稿（Slice A），但不得將 token 套用到任何既有頁面（Slice C）。

## 5. Design Token Contract（草案，非最終色票）

以下為衍生自 `visual-direction.md` 的候選方向，實際 HEX 待產品主人於 Gate B1 核定；核定前僅供 Codex/Claude 討論與 peer review 使用，不得寫入任何頁面。

### 5.1 Scoping rule（避免影響 authenticated dashboard）

`globals.css` 目前的 `:root { --background; --foreground }` 與 `body` 的背景/文字/字體樣式，透過唯一的 [`src/app/layout.tsx`](src/app/layout.tsx) root layout 套用在**全站每一個 route**，包含 member/organizer/admin/account dashboard。本計畫明確**不得**修改這兩個既有 token 的值，也不得修改 `body` 或 `html` 上既有的 class/style。

Tailwind v4 的 `@theme` 系列語法本身無法寫在一個 class selector 裡（`@theme` 是 top-level at-rule，不能巢狀在 `.fsy-public-theme { }` 內），所以 scoping 需要兩層分工，Builder 必須照下列結構實作，不得自創寫法：

1. **Top-level `@theme inline` 區塊**（沿用 `globals.css` 現有寫法，緊接在既有 `--color-background: var(--background)` 那組之後新增，不覆寫既有兩行）：只負責「註冊 Tailwind utility 名稱」，並把每個 utility 指向一個**新的、`fsy-` 前綴**的 CSS variable，例如：

   ```css
   @theme inline {
     /* 既有兩行不變 */
     --color-background: var(--background);
     --color-foreground: var(--foreground);

     /* 本計畫新增：全部指向 fsy- 前綴變數，不得重用 --background/--foreground 這兩個名稱 */
     --color-primary: var(--fsy-primary);
     --color-primary-foreground: var(--fsy-primary-foreground);
     --color-surface: var(--fsy-surface);
     --color-ink: var(--fsy-ink);
     --color-accent: var(--fsy-accent);
     --color-muted: var(--fsy-muted);
     --color-card: var(--fsy-card);
     --color-border: var(--fsy-border);
     --color-ring: var(--fsy-ring);
     /* ...其餘 5.3 語意角色依此規則逐一加入，並補上對應的 --radius-* mapping */
   }
   ```

   `@theme inline`（而非 `@theme`）確保 utility 在編譯後仍是 `var(--color-primary)` 這種執行期參照，而不是把顏色值直接烘進 CSS，這樣才可能被下一步的 scope 覆蓋。**禁止**把 `--fsy-primary` 之類的名稱取成跟既有 `--background`/`--foreground` 相同，即使只在 `.fsy-public-theme` 內賦值，也會與全站既有 token 語意混淆。

2. **Scoped 賦值**：只有 `.fsy-public-theme` 這個 class 內才真正賦值：

   ```css
   .fsy-public-theme {
     --fsy-primary: #2C6796;
     --fsy-primary-foreground: #ffffff;
     --fsy-surface: #F4F8FB;
     --fsy-ink: #23262B;
     /* ...對應 5.2 / 5.3 的完整清單 */
   }
   ```

因為 CSS custom property 是在使用當下依 cascade 解析，`.fsy-public-theme` 以外的元素找不到 `--fsy-primary` 的定義，`--color-primary` 就會是 invalid/未定義，對應的 utility（如 `bg-primary`）在那裡不會有任何視覺效果；只有 Slice C 套用到的五個公開頁面最外層 wrapper 會加上 `fsy-public-theme` class，dashboard、account 等既有 route 不加這個 class，因此不會繼承任何新 token 的值。Slice B 安裝 shadcn/ui 時，**不得**採用其 CLI 預設會寫入 `:root` 的 init 流程；必須手動依上述兩層結構重寫生成的語意變數，並在 Slice B 完成後記錄實際採用的作法。

### 5.2 品牌核心 token 候選

### 候選 A — 晨光飛翔 Dawn Flight

| Token | 用途 | 候選 HEX |
|---|---|---|
| `--color-primary` | 主色（CTA、連結、品牌強調） | `#2C6796` |
| `--color-primary-soft` | 淺底、hover 背景 | `#EAF3F9` |
| `--color-accent` | 覺醒/溫暖強調（次要 CTA、徽章） | `#C9A24B` |
| `--color-ink` | 主要文字 | `#23262B` |
| `--color-muted` | 次要文字、說明 | `#6B7280` |
| `--color-surface` | 卡片/區塊底色 | `#F4F8FB` |

### 候選 B — 覺醒微光 Awakening Glow

| Token | 用途 | 候選 HEX |
|---|---|---|
| `--color-primary` | 主色 | `#6E5286` |
| `--color-primary-soft` | 淺底、hover 背景 | `#F3EDF7` |
| `--color-accent` | 女性能量強調 | `#E8B4C8` |
| `--color-ink` | 主要文字 | `#262230` |
| `--color-muted` | 次要文字 | `#6F6A78` |
| `--color-surface` | 卡片/區塊底色 | `#F8F5FA` |

兩組候選都必須在核定前用實際文字/按鈕組合做 WCAG AA 對比檢查（一般文字 ≥ 4.5:1，大字/CTA ≥ 3:1），不得只憑色票美觀判斷。

### 5.3 shadcn/ui 所需的完整語意 token 對照

Slice B 要導入 button、input、card、badge、dialog，這些元件的預設樣式依賴 shadcn 標準語意變數集，不是只有 5.2 的六個品牌 token 就夠。Builder 必須在 `.fsy-public-theme` 內把品牌 token 對應到下列語意角色（值待 Gate B1 核定後填入，此處先定義「有哪些角色、對應哪個品牌 token」）：

| shadcn 語意 token | 對應品牌 token（草案） |
|---|---|
| `--background` / `--foreground` | `--color-surface`（或白）／ `--color-ink` |
| `--card` / `--card-foreground` | `--color-surface` ／ `--color-ink` |
| `--popover` / `--popover-foreground` | 同 card |
| `--primary` / `--primary-foreground` | `--color-primary` ／ 白或 `--color-ink`（依對比檢查結果擇一） |
| `--secondary` / `--secondary-foreground` | `--color-primary-soft` ／ `--color-ink` |
| `--muted` / `--muted-foreground` | `--color-surface`（加深一階） ／ `--color-muted` |
| `--accent` / `--accent-foreground` | `--color-accent` ／ `--color-ink` |
| `--destructive` / `--destructive-foreground` | 沿用 Tailwind 預設紅（本計畫不新增品牌警示色） |
| `--border` / `--input` / `--ring` | 由 `--color-primary` 或 `--color-muted` 依 WCAG 非文字對比（≥ 3:1）派生 |
| `--radius` | 依下方圓角 token |

上表每一列都必須依 5.1 的兩層結構（top-level `@theme inline` 註冊 utility + `.fsy-public-theme` 內賦值）落地成實際的 `--color-*`／`--radius-*` utility mapping，Builder 不得只寫 scoped 變數卻漏掉 `@theme inline` 註冊，否則 shadcn 元件會拿不到 `bg-primary`、`text-foreground`、`rounded-md` 等 utility 而退回無樣式狀態。

每一組 foreground/background 配對，都必須在 Slice B 完成時附上實際渲染截圖與對比數字，作為 Acceptance 的一部分（見第 7 節 Slice B）。

### 5.4 其餘 token 類別（非顏色）

- `--radius-*`：卡片/按鈕圓角，呼應「gentle、soft borders」方向，避免銳角或過度圓潤的 pill 風格造成廉價感。
- `--shadow-*`：極輕陰影，呼應「spaciousness、breath」，避免厚重擬物陰影。
- `--space-*`：延續現有 Tailwind spacing scale，但在 Hero/區塊間距上採用比預設更寬鬆的節奏（呼應 breath-like spacing）。

## 6. Proposed File Boundary

Expected allowlist（Builder 開始時需先重新查證未提交變更的最新狀態；若與本清單不同，先回報，不得自行覆寫）：

Slice A + B（token 定義與元件骨架，不觸碰既有頁面）：

- `src/app/globals.css`（僅新增 5.1 所述的 scope class 與新 token，不得修改既有 `:root`／`body` 區塊的值）
- `tailwind.config.*`（若 Tailwind v4 需要，先確認是否仍用 CSS-first `@theme` 或需要額外 config 檔）
- `components.json`、`src/components/ui/**`（shadcn/ui 生成的元件骨架，新增）
- `src/app/_internal/style-guide/page.tsx`（新增，未連結進導覽，Slice A/B 的唯一驗證場域）
- `package.json`、`package-lock.json`（shadcn/ui 與 Slice B 新增的 `@axe-core/playwright` 安裝必然變更；Builder 需在報告中列出實際新增的 dependency 清單）

Slice C（套用到既有頁面，需 Gate B5 = Public Trust Pages 基線已 commit 才能開始）：

- `src/app/page.tsx`、`src/app/about/page.tsx`、`src/app/faq/page.tsx`、`src/app/teachers/join/page.tsx`、`src/app/organizers/request/page.tsx`
- `src/app/_components/**`（既有 `PublicHeader`/`PublicFooter` 等公開頁殼層元件，僅套用 `fsy-public-theme` scope 與新元件，不改既有 nav/CTA 行為）
- `tests/smoke/public-trust-pages.spec.ts`（擴充 Slice C 步驟 5 所述的 overflow／keyboard／dialog／axe 檢查）

Forbidden without a new product-owner gate：`prisma/**`、`src/domain/**`、`src/lib/auth/**`、`src/app/layout.tsx` 中 `html`/`body` 既有 class 與既有 `:root { --background; --foreground }` 的值、任何 authenticated dashboard 或 account 頁面、payment 相關程式碼、通知寄送邏輯、與本計畫無關的 dependency/config 變更；以及 Public Trust Pages 尚未 commit 的既有修改範圍，在 Gate B5 允許之前不得觸碰。

## 7. Incremental Build Plan

### Slice A — Design token 草案（不影響任何現有頁面）

1. 在 `globals.css` 新增 `.fsy-public-theme` scope class（見 5.1），內含候選 A 或 B 的預留值，標記為 `DRAFT — pending Gate B1`；**不修改**既有 `:root`／`body` 區塊。
2. 確認 Tailwind v4 `@theme inline` 是否需要搭配 `tailwind.config` 或純 CSS 即可；記錄決定與理由。
3. 新增 `src/app/_internal/style-guide/page.tsx`：一個獨立、未加入任何導覽連結、不出現在 route map 的頁面，最外層套用 `fsy-public-theme` class，展示候選色票、字體、圓角、陰影，供產品主人在瀏覽器直接比較兩組候選。

Acceptance：

- 既有五個公開頁面與所有 authenticated/dashboard/account 頁面視覺零變化（因為它們的 DOM 樹不含 `fsy-public-theme` class）。
- Playwright 既有全套 `npm run test:smoke` 通過（token 定義不應觸發任何行為變化）。

### Slice B — shadcn/ui 骨架導入

1. 安裝並初始化 shadcn/ui，僅生成 marketplace 表單常用的少數元件（button、input、card、badge、dialog），不要一次生成全部元件庫。**不使用**其 CLI 預設會寫入 `:root` 的 init 流程；依 5.3 節語意 token 對照表，把生成的 CSS 變數改放進 Slice A 建立的 `.fsy-public-theme` scope。
2. 元件內部一律引用語意 CSS variable（`bg-primary`、`text-foreground` 等），不寫死色碼，確保之後色票一旦核定，只需改 token 不必改元件。
3. 安裝 `@axe-core/playwright`（devDependency，供 Slice C 使用）。
4. 唯一驗證場域是 Slice A 新增的 `/_internal/style-guide` 頁：在該頁展示 button、input、card、badge、dialog 的每個 variant，**不修改**任何既有頁面或既有表單元素。

Acceptance：

- TypeScript / ESLint / build 通過。
- 未改變任何既有頁面、既有表單的 Server Action、驗證邏輯或 `data-testid`。
- 5.3 節每一組 foreground/background 配對，附上 `/_internal/style-guide` 的實際渲染截圖與對比數字（工具不拘，如瀏覽器 DevTools 對比檢查器），一般文字 ≥ 4.5:1、非文字元件（border/ring）≥ 3:1。

### Slice C — 套用到公開頁面（需 Gate B5 = 已完成 Public Trust Pages 基線後才開始）

1. 依 Gate B1 核定色票，把 Slice A 的 DRAFT token 轉正，仍保留在 `.fsy-public-theme` scope 內。
2. 在五個公開頁面的最外層容器加上 `fsy-public-theme` class（例如既有 `PublicHeader`/`PublicFooter` 共用的 shell，若尚未存在共用 shell，則個別頁面 root 容器各自加上），再逐頁把 shadcn 元件套用到 `/`、`/about`、`/faq`、`/teachers/join`、`/organizers/request`，一次一頁，每頁跑一次對應 smoke test。
3. 依 Gate B3 交付 wordmark：若核定 A（本階段只做文字佔位），在既有 `PublicHeader` 的品牌連結區塊，用核定字體與 `--color-primary`／`--color-ink` 排版出「Free Soar 飛索瑜伽」文字 lockup，取代目前的 placeholder 品牌文字；不製作圖形 logo、不新增圖片資產。若核定 B（先用 AI 工具產生 logo 草案），本 slice 不執行，需先有新的 Product Owner Decision 與另案的圖檔/授權/命名規範，才能施工。
4. 保留 [`docs/harness/brand-review-checklist.md`](docs/harness/brand-review-checklist.md) 逐頁勾選。
5. 擴充 `tests/smoke/public-trust-pages.spec.ts`，新增：
   - 360/390/768/1440 四種寬度下，五個公開頁面 `document.documentElement.scrollWidth` 不超過 viewport 寬度（無水平 overflow）；
   - 新引入的互動元件（至少一個 dialog、一組 input/button）鍵盤可達、focus 可見、dialog 支援 Escape 關閉與 focus trap；
   - 用 `@axe-core/playwright` 對五個頁面各跑一次自動化 a11y 掃描，critical/serious 違規數為 0（moderate/minor 可記錄為已知項目，不阻擋）。

Acceptance：

- 五個公開頁面視覺一致，符合核定色票與字體。
- 若 Gate B3 核定 A：五個公開頁面共用同一個文字 wordmark lockup，且與其他品牌 token 一致；若核定 B，本 slice 明確標記 wordmark 為未交付、待另案。
- 既有 `tests/smoke/*.spec.ts` 全數通過（`npm run test:smoke`），包含所有 dashboard/account/admin specs——這是證明本 slice 沒有意外影響 authenticated 頁面的直接證據，而不只是「理論上 scope 沒重疊」。
- Slice C 步驟 5 所述新增的 overflow／keyboard／dialog／axe 檢查全數通過。

### Slice D — 文件與 Definition of Done 收斂

- 把核定後的實際 HEX、字體、圓角、陰影寫回 `docs/context/visual-direction.md`，取代描述性建議。
- 記錄哪些頁面（authenticated dashboard 等）刻意排除在本輪之外，作為下一階段候選。

本計畫**不包含** authenticated dashboard／data table／skeleton screen 美編（Gemini 第二份意見的「第三步之 3」），原因是那屬於另一個 vertical slice，且目前已有近期 commit（`22d26b5 feat: add member and organizer dashboards`、`ce00fb0 feat: add account dashboard navigation`）在做功能面工作，同時改視覺風險過高。

## 8. Testing

```text
npx playwright test tests/smoke/public-trust-pages.spec.ts
npx playwright test tests/smoke/teacher-join.spec.ts tests/smoke/organizer-demand.spec.ts
npx tsc --noEmit
npm run lint
npm run build
npm run test:smoke
```

`npm run test:smoke` 涵蓋全部既有 spec，包含 `admin-dashboard.spec.ts`、`member-dashboard.spec.ts`、`organizer-dashboard.spec.ts`、`teacher-dashboard.spec.ts`、`account-dashboard-navigation.spec.ts` 等——Slice C 完成後這些必須維持全綠，作為「dashboard 視覺與行為未受影響」的直接證據。

擴充後的 `public-trust-pages.spec.ts` 須包含：360/390/768/1440 四寬度 overflow 檢查、新元件鍵盤 focus／dialog Escape 與 focus trap 檢查、`@axe-core/playwright` 對五個公開頁面的自動化掃描（critical/serious 違規為 0）。

人工檢查：iPhone-class 360/390、Android Chrome-class、桌面 Chrome、鍵盤導覽、200% 縮放、色彩對比（AA）、繁體中文長文字換行、隨機抽查一個 dashboard 頁面確認視覺與改版前一致。

## 9. Security, Accessibility, RWD, and Brand Guardrails

- 不把使用者資料、Prisma schema、未公開商業文件貼進第三方 AI 設計 SaaS 工具；視覺設計工作只需要頁面結構與已核准文案。
- 新 token/元件不得引入無障礙倒退：對比、focus 可見性、觸控目標 ≥ 44×44 CSS px 需人工複查。
- 遵守 [`docs/harness/brand-review-checklist.md`](docs/harness/brand-review-checklist.md)：不做焦慮式行銷視覺、不把老師商品化的視覺呈現（例如價格牌卡式排版）、不做通用健身房風格。
- 任何頁面套用（Slice C）前必須先確認 Public Trust Pages 的未提交修改已經 commit，避免兩批修改互相覆寫。

## 10. Analysis of the Two Gemini Opinions

### 第一份意見（Codex 設計功能 vs Claude Design 生態比較）

方向正確：Codex（OpenAI）確實不是只有 terminal coding，Anthropic 的 Claude Design 與市場上 v0 / Open Design / Lovable / Bolt.new 是同一類「文字/圖片 → 可互動原型」工具的不同解法，這與我先前查證的結果一致。

**需要保留的疑慮**：文中提到的「Codex Product Design 插件」「十多項專屬設計技能」「Sites 可分享站點」「Figma MCP 深度雙向整合」等具體功能名稱與細節，我沒有獨立管道逐一查證真偽與確切能力邊界（這些細節可能隨版本快速變動，Gemini 回覆也可能混合了行銷用語與推測）。**建議**：在真的要採購或依賴這些具體功能之前，由產品主人或工程端直接到 OpenAI/Codex 官方文件核實，不要把這些細節當作已確認事實寫進正式決策。本計畫因此不把任何工具的具體功能清單當作依賴項，只把「AI 工具可產生草稿，落地要回到本 repo Harness」當作唯一穩定假設（見 Gate B4）。

### 第二份意見（針對本 repo 技術棧的四步藍圖）

這份對本專案最有直接幫助，因為它是針對 Next.js 16 + Tailwind CSS 4 + shadcn/ui 的具體路徑，且提出的四步（1 全域 design token、2 shadcn/ui 骨架、3 逐頁 AI 重構、4 Playwright 護航）與本 repo 既有 Harness 工作流（spec → plan → build → test → review）高度相容。本計畫的 Slice A–D 基本上是把這四步套進本 repo 既有的 plan 模板、Product Owner Decision Gate 與 file boundary 規則，差異在於：

1. 明確標出「目前有未提交的 Public Trust Pages 工作」這個第二份意見沒看到的 repo 現況，並加了 Gate B5 時序保護。
2. 把「品牌色票/字體/logo」明確列為 Product Owner Decision Gate，而不是讓 AI（不論是 v0、Claude Design 或 Claude Code）直接依審美自行定案——founder-intent.md 明確要求價值判斷不能由 AI 默默選擇。
3. 縮小第一輪範圍：只做 design token + shadcn 骨架 + 五個既有公開頁面，明確排除 authenticated dashboard 美編、logo 正式製作與 AI 工具採購，避免一次擴張太多 surface（違反 AGENTS.md 的 MVP-first / one slice at a time）。

### Claude 的補充意見

- Design token 要先於任何頁面套用定案，這樣不管日後用 v0、Claude Design 還是純手刻，AI 產出的元件都可以被要求「引用既有 token」而不是每次自己發明顏色，避免多輪 AI 生成後風格漂移（俗稱 AI 產出的「千篇一律感」）。
- 建議先做一次「現有頁面視覺盤點」：`teachers/join`、`organizers/request` 目前已有相對完整的品牌視覺（見 public-trust-pages-plan 的觀察），不必整頁重生成，只需要套新 token；真正空白的是 `globals.css` 的預設值與尚未存在的 style guide。這能省下不必要的 AI 重繪成本。
- 外部 AI 設計工具的輸出，一律當作「靈感輸入」而非「可直接合併的程式碼」，最終仍由 Claude Code / Codex 在本 repo 依現有 review packet、brand checklist、Playwright smoke 落地——這點呼應 Gate B4 選項 A，也是我的建議選項。

## 11. Rollback and Stop Conditions

Rollback 為檔案層級：移除本計畫新增的 token 區塊、shadcn 元件與 style-guide 靜態頁；不影響 schema 或資料。

Stop and ask the product owner if：

- Public Trust Pages 的未提交修改尚未 commit，卻被要求開始 Slice C；
- 色票候選在 WCAG AA 對比檢查未過，需要重新提案；
- 任何 Builder prompt 打算把外部 AI 工具（v0/Claude Design/Codex）產出的原始碼直接貼入 repo，而 Gate B4 尚未選 B；
- 任何人要求把美編範圍擴大到 authenticated dashboard、logo 正式製作或工具採購；
- Gate B2 核定為 B（加入第二款 display 字體），但尚未有涵蓋 `layout.tsx` 字體載入規格的修訂版 plan 通過 Codex peer review。

## 12. Definition of Done

- Gate B1–B5 均已由產品主人核定。
- `globals.css` 有明確、可追溯的品牌 design token（含 `@theme inline` utility mapping 與對應 scoped 賦值），取代 Next.js 預設值；既有 `--background`/`--foreground` 與 `body`/`html` 樣式未被修改。
- shadcn/ui 骨架已導入且套用 token，不寫死色碼；`.fsy-public-theme` 之外的頁面（含所有 dashboard）視覺與行為不變，並有全套 `npm run test:smoke` 綠燈為證。
- 五個既有公開頁面在不影響現有功能與既有 smoke test 的前提下套用新視覺語言，並依核定的 Gate B3 交付（或明確標記未交付）wordmark。
- 新增的 overflow／keyboard／dialog／`@axe-core/playwright` 檢查已納入 `public-trust-pages.spec.ts` 並通過。
- `docs/context/visual-direction.md` 更新為實際核定的 HEX/字體/圓角/陰影。
- Required self review 完成；未包含無關檔案、commit、push 或部署。

<!-- codex-peer-reviewed: 2026-08-02T16:12:38Z rounds=3 verdict=approved -->
