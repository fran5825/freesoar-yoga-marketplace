---
name: Free Soar Yoga 飛索・瑜伽團課共創平台
description: 在展翅之前，先安靜下來：一個溫柔、清楚、可信任的瑜伽團課共創平台。
colors:
  cream: "#f7f4ee"
  sand: "#ebe2d7"
  sage: "#dfe8dc"
  sky-mist: "#e4ecef"
  sky-ink: "#2c4552"
  ink: "#29382f"
  ink-soft: "#56645b"
  ink-faint: "#686e66"
  pine: "#345343"
  pine-deep: "#293f35"
  pine-tint: "#eef2ee"
  gold: "#7d5a2a"
  gold-deep: "#5e4320"
  gold-tint: "#f4ecdc"
  gold-glow: "#c8a35a"
typography:
  display:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5rem
  body-lead:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 2rem
  label:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    letterSpacing: "0.2em"
rounded:
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  section: "64px"
  section-wide: "96px"
components:
  button-primary:
    backgroundColor: "{colors.pine}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.pine-deep}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "44px"
  chip:
    backgroundColor: "{colors.pine-tint}"
    textColor: "{colors.pine-deep}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  card:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  notice-calm:
    backgroundColor: "{colors.pine-tint}"
    textColor: "{colors.pine-deep}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  notice-warm:
    backgroundColor: "{colors.gold-tint}"
    textColor: "{colors.gold-deep}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  sky-band:
    backgroundColor: "{colors.sky-mist}"
    textColor: "{colors.sky-ink}"
    rounded: "{rounded.xl}"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
---

# Design System: Free Soar Yoga 飛索

> 2026-10-18 由 `/impeccable document` 從現有程式碼抽取，並依產品主人當天的決定修訂：創意北極星「展翅前的靜」、元件手感「柔軟而篤定」、色票走「A 演進」、頁面底色維持奶油色。
>
> **遷移狀態**：2026-10-18 階段 D0 已把目標色票寫進 `src/app/globals.css`：新增 `sky-mist`、`sky-ink`、`gold` 系列，`ink-faint` 加深，全站 `clay` 已換成 `gold` 並移除。
>
> 品牌依據以 `AGENTS.md`、`docs/context/*`、`PRODUCT.md` 為準；本檔只記錄視覺系統。新增或修改顏色 token、改全站字體、改導覽結構，都需要產品主人同意。

## Overview

**Creative North Star: "展翅前的靜 The Stillness Before Flight"**

飛索的畫面是起飛前那一口安靜的呼吸：先安住，才有力氣展翅。大部分版面是安靜的，奶油色的底、充足的留白、柔和的圓角，讓老師、團主和學員一進來就放鬆，願意慢慢讀。安靜之中要有一點「往上」的感覺：晨空藍像清晨的天空，只在大面積留白處出現；晨光金像剛升起的光，只用在小小的重點上。

「柔軟而篤定」是這個系統的手感：形狀柔軟（膠囊按鈕、大圓角卡片、有機形狀），但該做的下一步一定清楚、紮實，不讓人猶豫。溫柔不等於模糊。

這是一個以文字和留白為主的系統。目前沒有任何真實照片或插畫素材（見 `PRODUCT.md`），畫面不可以用示意圖假裝成真實課程現場。

**Key Characteristics:**

- 奶油色頁面底，白色卡片靠色差與細框浮起，幾乎沒有陰影。
- 松綠是唯一的主行動色，每個畫面最多一個實心松綠按鈕。
- 晨空藍只做大面積的安靜底色，晨光金只做小面積重點。
- 膠囊按鈕、16px 圓角卡片、有機形狀的品牌圖形。
- 手機優先，觸控目標至少 44px。

## Colors

溫暖的大地色（奶油、沙、鼠尾草、松綠）為底，加上清晨的天空與光作為「展翅」的暗示。

### Primary

- **松林綠 Pine** (pine)：主要行動色。實心按鈕、header 的「登入／註冊」、首頁的三種身分分流區塊底色。白字在松綠上的對比度是 8.5。
- **深松綠 Pine Deep** (pine-deep)：主要按鈕的 hover 狀態，以及淡綠底提示框裡的文字。
- **晨霧綠 Pine Tint** (pine-tint)：已選取的選項、標籤（chip）、安靜型提示框的底色。

### Secondary

- **晨光金 Dawn Gold** (gold)：新增，取代陶土色。用在小標（eyebrow）、文字連結的 hover、focus 外框。它在所有品牌底色上都能當文字使用（奶油底對比度 5.68，沙色底 4.87）。
- **深晨光金 Dawn Gold Deep** (gold-deep)：放在晨光淡金底上的文字。
- **晨光淡金 Dawn Gold Tint** (gold-tint)：溫暖型提示框的底色，例如提醒、需要注意但不是錯誤的訊息。
- **亮金 Gold Glow** (gold-glow)：**只當裝飾**，例如分隔線、小圓點、品牌圖形的描邊。不可以拿來當文字，因為對比度不夠。

### Tertiary

- **晨空藍 Sky Mist** (sky-mist)：新增。用在大面積、安靜的區塊底色，例如首頁某一段的背景或品牌圖形，像清晨的天空。不用在按鈕、文字或小面積重點。
- **晨空深藍 Sky Ink** (sky-ink)：新增。專門給晨空藍底上的文字使用（對比度 8.4）。

### Neutral

- **奶油 Cream** (cream)：全站頁面底色。這是刻意的品牌選擇，維持不換。
- **沙色 Sand** (sand)：小標籤、次要區塊底色。
- **鼠尾草 Sage** (sage)：首頁品牌圖形底色、柔和的區塊底色。
- **墨綠 Ink** (ink)：主要文字與標題。
- **淺墨綠 Ink Soft** (ink-soft)：說明文字、次要資訊，全站最常用的文字色。
- **淡墨綠 Ink Faint** (ink-faint)：輔助資訊，例如欄位標籤、補充說明。2026-10-18 加深後，奶油底對比 4.77、白底 5.24、晨霧綠底 4.63，可以當小字；放在沙色底上只有 4.09，不要這樣用。
- **細框**：用 ink 加上 10%–20% 透明度畫 1px 細框（`border-ink/10`～`border-ink/20`），不另外定義灰色。

### Named Rules

**The One Pine Rule.** 每個畫面最多一個實心松綠按鈕。其他行動用外框按鈕或文字連結。

**The Sky Is Space Rule.** 晨空藍只出現在大面積的留白區塊，代表「空間」與「天空」。它不是強調色，不用在按鈕、icon、文字或小卡片上。

**The Dawn Is Small Rule.** 晨光金只做小面積重點：小標、連結 hover、focus 外框、裝飾線。不要整塊鋪滿金色。

**The No Hardcoded Color Rule.** 顏色一律用色票 token。目前公開頁有 10 種寫死的色碼，分散在首頁、`/about`、`/faq`、footer 與老師申請表單（例如 `#5d6a61`、`#6d7d70`、`#cfdbd1`），要在階段 D 收回 token 或補上正式 token。

## Typography

**Display Font:** Geist（後備字體 Arial、Helvetica、sans-serif）
**Body Font:** Geist（同上）
**中文字體：** 目前沒有指定。中文會由使用者的系統自動補上（Windows 通常是微軟正黑體，Apple 裝置是蘋方），所以在不同裝置上看起來不一樣。

**Character:** 乾淨、現代、不花俏的無襯線字體，靠字重與大小區分層次，不靠裝飾字體。

### Hierarchy

- **Display**（600，手機 36px／寬螢幕 60px，行高 1.15，字距 -0.03em）：只用在首頁主標。
- **Headline**（600，24–30px，字距略緊）：各頁的頁面主標（h1）與首頁的段落大標。
- **Title**（500，18px，行高 1.5）：卡片標題、區塊標題（h2），是全站最常見的標題層級。
- **Body**（400，14px，行高 24px）：全站正文。說明段落寬度控制在約 42rem（`max-w-2xl`）以內。
- **Body Lead**（400，18px，行高 32px）：首頁主標下方的引言。
- **Label**（500，14px，字距 0.2em）：中文小標（eyebrow），用晨光金。

### Named Rules

**The No Italic Emphasis Rule.** 標題裡不用斜體強調某幾個字（`AGENTS.md` 避免清單）。中文本來就沒有真正的斜體，強行傾斜只會看起來歪掉。

**The No Mono Label Rule.** 不用等寬字體做小標籤（`AGENTS.md` 避免清單）。目前載入了 `Geist_Mono` 但公開頁沒有使用。

**The Chinese First Rule.** 介面以繁體中文為主，字級、行高、斷行都要先以中文的可讀性來判斷。

### 中文字體（2026-10-18 產品主人定案：方案一）

**明確指定系統中文字體**：字體堆疊在 Geist 之後依序加上 `PingFang TC`、`Microsoft JhengHei`、`Noto Sans TC`，不下載任何中文字體檔，載入速度不變；代價是不同裝置之間仍會有些微差異。

- **遷移狀態**：2026-10-18 階段 D0 已寫進 `globals.css` 的 `--font-sans`，`body` 與 Tailwind 的 `font-sans` 都會用到。
- **沒有採用的方案**：透過 `next/font` 載入 Noto Sans TC（思源黑體），所有裝置一致，但中文字體檔很大，首次載入會變慢。等公開頁改版穩定後可以再評估。

## Layout

- **容器**：最大寬度 1152px（`max-w-6xl`），左右內距手機 20px、寬螢幕 32px。
- **段落節奏**：大段落上下間距，手機 64px、寬螢幕 96px。卡片之間 16–24px。
- **閱讀寬度**：段落文字控制在約 42rem 以內，避免一行太長。
- **斷點**：照 Tailwind 預設，`sm` 640px、`md` 768px、`lg` 1024px。檢查寬度依 `docs/harness/rwd-checklist.md`（360／390／768／1024／1440px）。
- **手機優先**：先排單欄；`md` 以上才分成多欄，例如首頁三種身分卡片在 `md` 變三欄、首頁主視覺在 `lg` 變左右兩欄。
- **觸控目標**：按鈕、連結、可點選的選項至少 44px 高（`min-h-11`），不可以出現橫向捲動。

### Named Rules

**The Breath Rule.** 有疑慮時，多留白、少放東西。寧可讓一個段落只說一件事，也不要把三件事塞進同一張卡片。

## Elevation & Depth

整體是扁平的，靠「色調分層」表現深度，不靠陰影：奶油色頁面底 → 白色卡片 → 淡綠或淡金的提示框。卡片與頁面之間用 1px 的半透明墨綠細框分開。唯一的陰影是下拉選單的極淡陰影（`shadow-sm`），用來表示它浮在內容上方。

### Named Rules

**The Flat By Default Rule.** 卡片、按鈕在靜止時都不加陰影。只有浮在內容上的東西（下拉選單）才可以用最淡的陰影。

**The Light Only Rule.** V1 只設計淺色畫面。原本 `globals.css` 裡 Next.js 範本留下的 dark mode 區塊已在 2026-10-18 階段 D0 移除，深色模式的裝置也會看到淺色畫面。

## Shapes

- **膠囊（9999px）**：所有按鈕、標籤（chip）、可切換的選項按鈕。這是刻意的品牌設計，維持不改。
- **12px 圓角**：提示框、表單輸入框、可勾選的選項列。
- **16px 圓角**：一般內容卡片。
- **24px 圓角**：首頁的大型身分分流卡片。
- **有機形狀**：首頁主視覺的品牌圖形使用不對稱的橢圓圓角（例如 `42% 58% 52% 48%`），像呼吸中的形狀。這是品牌圖形專用，不用在一般卡片上。

## Components

### Buttons

柔軟的形狀，篤定的存在感。

- **Shape：** 膠囊（9999px）。
- **Primary：** 實心松綠底、白字、字重 500，內距約 12px × 24px，高度至少 44px。每個畫面最多一個。
- **Hover / Focus：** hover 時變深松綠；鍵盤 focus 時出現 2px 外框，距離 2px。
- **Secondary：** 白色或半透明白底，加上 30% 松綠細框，墨綠字；hover 時細框變成實心松綠。
- **Text link：** 底線連結，hover 時文字變晨光金。

### Chips

- **Style：** 晨霧綠底、深松綠字、12px 小字、膠囊形狀。資訊型標籤也可以用沙色底加金色字。
- **State：** 可切換的選項，未選時是細框加淺墨綠字；選取後變實心松綠加白字。

### Cards / Containers

- **Corner Style：** 16px（一般）、24px（首頁身分卡片）。
- **Background：** 白色，放在奶油色頁面上。
- **Shadow Strategy：** 無陰影，見 Elevation & Depth。
- **Border：** 1px，墨綠 12% 透明度。
- **Internal Padding：** 手機 20px、寬螢幕 24px。

### Notices

- **安靜型：** 晨霧綠底、深松綠字、12px 圓角，用在一般說明或成功訊息。
- **溫暖型：** 晨光淡金底、深晨光金字，用在提醒。

### Inputs / Fields

- **Style：** 白底、墨綠 15%–20% 細框、12px 圓角，內距約 8px × 12px，高度至少 44px。
- **Focus：** 2px 外框，與按鈕的 focus 一致。
- **Selectable rows：** 可勾選的選項列被選取時，細框變松綠、底色變晨霧綠。

### Navigation

- **公開 header：** 左邊是品牌名稱「飛索・瑜伽團課共創平台」，下面一行小字 Free Soar Yoga；右邊是 14px 淺墨綠連結（發起團課、搜尋課程、老師合作、關於飛索），hover 時變金色；最右邊是唯一的實心松綠「登入／註冊」膠囊按鈕。
- **手機：** 連結與登入收進 ☰ 選單，選單按鈕是圓形、至少 44px。
- **登入後：** 公開頁會換成各角色專區的導覽外框（`site-shell.tsx`），這一輪不改。導覽結構屬於品牌決策。

### Brand Mark（首頁品牌圖形）

首頁主視覺右側的有機形狀：鼠尾草底，裡面是半透明白色的內層形狀，放一句品牌短語，上下兩行英文品牌價值。它是目前唯一的「圖像」，在有正式 logo 美術之前，承擔品牌記憶點的工作。

## Do's and Don'ts

### Do:

- **Do** 用奶油色（cream）當頁面底色，白色卡片加細框浮在上面。
- **Do** 每個畫面只放一個實心松綠主要按鈕，其餘用外框按鈕或文字連結。
- **Do** 把晨空藍保留給大面積、安靜的區塊；晨空藍底上的字一律用晨空深藍。
- **Do** 小標用晨光金、字距 0.2em。
- **Do** 所有可點的東西至少 44px 高，並保留清楚的 focus 外框。
- **Do** 沒有真實素材時，用文字、留白與品牌圖形撐起畫面。

### Don't:

- **Don't** 在標題裡用斜體強調某幾個字。
- **Don't** 用 01／02／03 編號當區塊標籤。
- **Don't** 用等寬字體做小標籤。
- **Don't** 把奶油色背景或膠囊按鈕當成「常見套路」拿掉，它們是刻意的品牌設計。
- **Don't** 用亮金（gold-glow）當文字顏色，對比度不夠；淡墨綠（ink-faint）不要放在沙色底上。
- **Don't** 寫死色碼，一律用色票 token。
- **Don't** 用漸層文字、發光陰影、炫技動畫；`bolder` 與 `overdrive` 的方向和飛索相反。
- **Don't** 用示意照片、假的推薦語、假的學員人數或評分，假裝成真實內容。
- **Don't** 用倒數計時、限量、搶課這類製造焦慮的視覺元素。
