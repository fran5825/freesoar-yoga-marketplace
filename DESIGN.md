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
  home-navy: "#153451"
  home-navy-deep: "#0e2740"
  home-ink: "#061b45"
  home-indigo: "#0b1459"
  home-green: "#07662f"
  home-band: "#faf7f1"
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
  home-display:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "min(max(1.6rem, 7.75vw), calc(33.3 * var(--hu)))"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.01em"
  home-headline:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "calc(22 * var(--hu))"
    fontWeight: 800
    lineHeight: 1.35
  home-title:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "calc(17 * var(--hu))"
    fontWeight: 800
    lineHeight: 1.375
  home-cta:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "calc(16 * var(--hu))"
    fontWeight: 800
    letterSpacing: "0.04em"
  home-body:
    fontFamily: "Geist, PingFang TC, Microsoft JhengHei, Noto Sans TC, Arial, sans-serif"
    fontSize: "calc(13 * var(--hu))"
    fontWeight: 600
    lineHeight: 1.6
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
  home-button-primary:
    backgroundColor: "{colors.home-navy}"
    textColor: "#ffffff"
    typography: "{typography.home-cta}"
    rounded: "{rounded.pill}"
    padding: "0 calc(48 * var(--hu))"
    height: "calc(37 * var(--hu))"
  home-button-primary-hover:
    backgroundColor: "{colors.home-navy-deep}"
  home-button-secondary:
    backgroundColor: "{colors.home-band}"
    textColor: "{colors.home-indigo}"
    typography: "{typography.home-cta}"
    rounded: "{rounded.pill}"
    padding: "0 calc(48 * var(--hu))"
    height: "calc(32 * var(--hu))"
  home-button-secondary-hover:
    backgroundColor: "#ffffff"
  home-band-section:
    backgroundColor: "{colors.home-band}"
    textColor: "{colors.home-ink}"
---

# Design System: Free Soar Yoga 飛索

> 2026-10-18 由 `/impeccable document` 從現有程式碼抽取，並依產品主人當天的決定修訂：創意北極星「展翅前的靜」、元件手感「柔軟而篤定」、色票走「A 演進」、頁面底色維持奶油色。
>
> **遷移狀態**：2026-10-18 階段 D0 已把目標色票寫進 `src/app/globals.css`：新增 `sky-mist`、`sky-ink`、`gold` 系列，`ink-faint` 加深，全站 `clay` 已換成 `gold` 並移除。
>
> **2026-10-21 補記首頁世界**：依 commit `e898065` 已上線的首頁（`src/app/page.tsx`，finish 結論 ship）補上「首頁世界（只限 `/`）」。產品主人 2026-10-20 決定「新配色先只用在首頁」，所以 `home-*` 色票、`font-home-display` 字體、`.home-scale` 縮放都只屬於首頁；其他公開頁與登入後專區仍照本檔原本的全站系統，沒有任何改變。是否擴大到其他頁，仍是未決事項（見 `.impeccable/surfaces/src-app-page-tsx.md`）。
>
> 品牌依據以 `AGENTS.md`、`docs/context/*`、`PRODUCT.md` 為準；本檔只記錄視覺系統。新增或修改顏色 token、改全站字體、改導覽結構，都需要產品主人同意。

## Overview

**Creative North Star: "展翅前的靜 The Stillness Before Flight"**

飛索的畫面是起飛前那一口安靜的呼吸：先安住，才有力氣展翅。大部分版面是安靜的，奶油色的底、充足的留白、柔和的圓角，讓老師、團主和學員一進來就放鬆，願意慢慢讀。安靜之中要有一點「往上」的感覺：晨空藍像清晨的天空，只在大面積留白處出現；晨光金像剛升起的光，只用在小小的重點上。

「柔軟而篤定」是這個系統的手感：形狀柔軟（膠囊按鈕、大圓角卡片），但該做的下一步一定清楚、紮實，不讓人猶豫。溫柔不等於模糊。

首頁以外的頁面是一個以文字和留白為主的系統，沒有任何真實照片或插畫素材（見 `PRODUCT.md`）。首頁從 2026-10-20 起使用剪紙示意插畫（見下方「首頁世界」）。不論哪一頁，畫面都不可以用示意圖假裝成真實課程現場。

**Key Characteristics:**

- （首頁以外）奶油色頁面底，白色卡片靠色差與細框浮起，幾乎沒有陰影。
- 松綠是唯一的主行動色，每個畫面最多一個實心松綠按鈕。
- 晨空藍只做大面積的安靜底色，晨光金只做小面積重點。
- 膠囊按鈕、16px 圓角卡片。
- 手機優先，觸控目標至少 44px。

### 首頁世界（只限 `/`）

**首頁北極星："剪紙團課 The Paper-Cut Group Class"**

首頁是一堂正在進行的剪紙團課：一群看得出各自樣子的大人，在看得到新竹山景的明亮教室裡一起練習。畫面是乾淨的白底，上面放層疊平塗的剪紙插畫（每片紙分開剪、靠重疊產生深度，不用陰影與漸層），文字是極粗的深藏青黑體主標加深藏青內文。這是產品主人在第五輪後指定的方向，刻意拒絕瑜伽品類常見的「奶油底＋鼠尾草綠＋柔和圓形＋單人冥想照」。

這個世界和全站系統分開管理：首頁用自己的 `home-*` 色票與 Noto Sans TC 800 主標字，header 與 footer 用 `variant="home"` 換成同一套配色；其他頁面看不到這些設定。

**Key Characteristics（首頁）：**

- 白底為主，步驟區與 footer 用暖白（home-band）色帶；沒有卡片、沒有陰影。
- 主行動是實心深藏青膠囊，次行動是深藏青外框膠囊；兩顆按鈕同寬，箭頭都貼在按鈕右側。
- 主標、段落標、按鈕字、品牌字都用 Noto Sans TC 800；內文用全站系統字。
- 插畫顏色（朱紅、珊瑚、深靛藍、青綠、萬壽菊黃、葉綠）只活在插畫裡，介面元素只用藏青、靛藍、葉綠、暖白、白。
- 整頁依視窗寬度等比縮放（`.home-scale`），手機照 430px 構圖、桌機照 1536px 構圖。
- 動態安靜：首屏依序淡入、捲動時輕輕浮現、hover 時箭頭右移 3px；系統設定「減少動態」時全部關閉。

## Colors

溫暖的大地色（奶油、沙、鼠尾草、松綠）為底，加上清晨的天空與光作為「展翅」的暗示。首頁另有一組藏青色票，見本段最後的「首頁世界色票」。

### Primary

- **松林綠 Pine** (pine)：主要行動色。實心按鈕、header 的「登入／註冊」（首頁以外）。白字在松綠上的對比度是 8.5。
- **深松綠 Pine Deep** (pine-deep)：主要按鈕的 hover 狀態，以及淡綠底提示框裡的文字。
- **晨霧綠 Pine Tint** (pine-tint)：已選取的選項、標籤（chip）、安靜型提示框的底色。

### Secondary

- **晨光金 Dawn Gold** (gold)：新增，取代陶土色。用在小標（eyebrow）、文字連結的 hover、focus 外框。它在所有品牌底色上都能當文字使用（奶油底對比度 5.68，沙色底 4.87）。
- **深晨光金 Dawn Gold Deep** (gold-deep)：放在晨光淡金底上的文字。
- **晨光淡金 Dawn Gold Tint** (gold-tint)：溫暖型提示框的底色，例如提醒、需要注意但不是錯誤的訊息。
- **亮金 Gold Glow** (gold-glow)：**只當裝飾**，例如分隔線、小圓點。不可以拿來當文字，因為對比度不夠。

### Tertiary

- **晨空藍 Sky Mist** (sky-mist)：新增。用在大面積、安靜的區塊底色，像清晨的天空。不用在按鈕、文字或小面積重點。（2026-10-21 檢查時，`src/app` 的頁面還沒有使用它。）
- **晨空深藍 Sky Ink** (sky-ink)：新增。專門給晨空藍底上的文字使用（對比度 8.4）。

### Neutral

- **奶油 Cream** (cream)：首頁以外的頁面底色。這是刻意的品牌選擇，維持不換。
- **沙色 Sand** (sand)：小標籤、次要區塊底色。
- **鼠尾草 Sage** (sage)：柔和的大區塊底色（例如 `/about`、老師頁的風格區塊）與狀態標籤底色。
- **墨綠 Ink** (ink)：主要文字與標題。
- **淺墨綠 Ink Soft** (ink-soft)：說明文字、次要資訊，全站最常用的文字色。
- **淡墨綠 Ink Faint** (ink-faint)：輔助資訊，例如欄位標籤、補充說明。2026-10-18 加深後，奶油底對比 4.77、白底 5.24、晨霧綠底 4.63，可以當小字；放在沙色底上只有 4.09，不要這樣用。
- **細框**：用 ink 加上 10%–20% 透明度畫 1px 細框（`border-ink/10`～`border-ink/20`），不另外定義灰色。

### Named Rules

**The One Pine Rule.** 每個畫面最多一個實心松綠按鈕。其他行動用外框按鈕或文字連結。

**The Sky Is Space Rule.** 晨空藍只出現在大面積的留白區塊，代表「空間」與「天空」。它不是強調色，不用在按鈕、icon、文字或小卡片上。

**The Dawn Is Small Rule.** 晨光金只做小面積重點：小標、連結 hover、focus 外框、裝飾線。不要整塊鋪滿金色。

**The No Hardcoded Color Rule.** 顏色一律用色票 token。2026-10-21 檢查時，`src/app` 的 `.tsx` 已沒有寫死的六位色碼；新程式碼也不要再加。

### 首頁世界色票（只限 `/`）

2026-10-20 產品主人核准，寫在 `globals.css` 的 `--color-home-*`。只有 `src/app/page.tsx` 與 header／footer 的 `variant="home"`（選單按鈕 `tone="home"`）會用到。

- **深藏青 Home Navy** (home-navy)：首頁主行動色。「我要發起團課」按鈕底色、首頁 header 的「登入／註冊」底色、反白選取文字（`::selection`）底色；也用 10%–15% 透明度畫首頁的細線（header 底線、步驟區上緣、身分清單分隔線、footer 上緣），5% 透明度當選單按鈕 hover 底。白字對比度 12.79。
- **更深藏青 Home Navy Deep** (home-navy-deep)：主行動按鈕與「登入／註冊」的 hover 狀態。
- **深夜藍 Home Ink** (home-ink)：首頁的主要文字色（整個 `main` 的預設字色）、所有標題、品牌字、選單圖示。白底對比度 16.79。
- **靛藍 Home Indigo** (home-indigo)：引言、內文、導覽連結、次按鈕的字與外框、文字連結與底線、footer 文字。白底 16.69、暖白底 15.60。
- **葉綠 Home Green** (home-green)：只用在 focus 外框，以及 header／footer 連結的 hover 字色。白底對比度 7.12、暖白底 6.66。不當底色、不當靜止狀態的文字色。
- **暖白 Home Band** (home-band)：步驟區「一堂團課，這樣成形」與 footer 的底色，以及手機版次按鈕的底色。和白底之間只差一點點，用來分段而不是做卡片。
- **白**（`#ffffff`）：首頁主要底色（首屏、身分區、header）。

**The Home Only Rule.** `home-*` 色票、`font-home-display`、`.home-scale` 只能出現在首頁 `/`（含 header／footer 的 `variant="home"`）。其他頁面不得引用，直到產品主人決定擴大。

**The Paper Stays In The Plates Rule.** 插畫的紙色（朱紅、珊瑚、萬壽菊黃等）只存在插畫檔裡，不抽成 token、不拿來當按鈕或文字顏色。介面元素只用藏青、靛藍、葉綠、暖白與白。

**The Green Is Focus Rule.** 葉綠在首頁只負責「你現在在這裡」：focus 外框與連結 hover。它不是第二個行動色。

## Typography

**Display Font:** Geist（後備字體 Arial、Helvetica、sans-serif）
**Body Font:** Geist（同上）
**中文字體：** 依 2026-10-18 方案一，在 Geist 之後明確指定系統中文字體（見下方）。
**首頁主標字體：** Noto Sans TC 800，只限首頁（見「首頁世界字體」）。

**Character:** 乾淨、現代、不花俏的無襯線字體，靠字重與大小區分層次，不靠裝飾字體。

### Hierarchy

- **Display**（600，手機 36px／寬螢幕 60px，行高 1.15，字距 -0.03em）：大型頁首主標，例如 `/about`、`/faq` 的 h1。首頁不用這一層，改用 `home-display`。
- **Headline**（600，24–30px，字距略緊）：各頁的頁面主標（h1）與段落大標。
- **Title**（500，18px，行高 1.5）：卡片標題、區塊標題（h2），是全站最常見的標題層級。
- **Body**（400，14px，行高 24px）：全站正文。說明段落寬度控制在約 42rem（`max-w-2xl`）以內。
- **Body Lead**（400，18px，行高 32px）：頁首主標下方的引言，例如 `/about`、`/faq`、老師加入說明頁。
- **Label**（500，14px，字距 0.2em）：中文小標（eyebrow），用晨光金。

### Named Rules

**The No Italic Emphasis Rule.** 標題裡不用斜體強調某幾個字（`AGENTS.md` 避免清單）。中文本來就沒有真正的斜體，強行傾斜只會看起來歪掉。

**The No Mono Label Rule.** 不用等寬字體做小標籤（`AGENTS.md` 避免清單）。目前載入了 `Geist_Mono` 但公開頁沒有使用。

**The Chinese First Rule.** 介面以繁體中文為主，字級、行高、斷行都要先以中文的可讀性來判斷。

### 中文字體（2026-10-18 產品主人定案：方案一）

**明確指定系統中文字體**：字體堆疊在 Geist 之後依序加上 `PingFang TC`、`Microsoft JhengHei`、`Noto Sans TC`，不下載任何中文字體檔，載入速度不變；代價是不同裝置之間仍會有些微差異。

- **遷移狀態**：2026-10-18 階段 D0 已寫進 `globals.css` 的 `--font-sans`，`body` 與 Tailwind 的 `font-sans` 都會用到。
- **首頁例外（2026-10-20）**：首頁的標題、按鈕字與品牌字改用透過 `next/font` 載入的 Noto Sans TC 800（`--font-home-display`），只載入 800 一種字重、`preload: false`、`display: swap`，瀏覽器依 unicode-range 只下載頁面用到的字。首頁內文仍用上面的系統字體。其他頁面不受影響。

### 首頁世界字體（只限 `/`）

字級寫成「構圖量到的數值 × 縮放單位」：手機以 430px 寬構圖為準（`--hu`），桌機（≥1024px）以 1536px 寬構圖為準（`--du`），見 Layout。下方先寫手機值，再寫桌機值。

- **主標 h1**（`home-display`，800）：手機 33.3、最小 1.6rem，行高 1.2，字距 0.01em，寬度限制 9.3em 讓它剛好在逗號後斷成兩行，360px 也維持兩行；桌機 65、一行、行高 1.15、置中。
- **段落標 h2**（`home-headline`，800）：身分區 22／40，行高 1.35；步驟區標題 19／40、置中、字距 0.04em。
- **小節標 h3**（`home-title`，800）：身分名稱 17／28；步驟名稱 12.8／29。
- **按鈕字**（`home-cta`，800）：16／28，字距 0.04em。品牌字「飛索」19.2／40、「瑜伽團課共創平台」14／27。
- **引言**（`home-body`，系統字）：手機 13、半粗 600、行高 1.6、靛藍；桌機 26、字重 500、行高 1.36。
- **內文**：身分說明 13／18、600、行高 1.7；步驟說明 12／18、行高 1.6，桌機不在詞中斷行（`break-keep`）。
- **老師小字連結**：12／20、粗體、靛藍底線。

**The One Heavy Face Rule.** Noto Sans TC 只用 800 一種字重，只給標題、按鈕字與品牌字；內文永遠用系統字。粗細對比就是首頁的層次，不要再加中間字重。

**The No Kicker Rule.** 首頁的標題上方不放小標（eyebrow）。原本主標上方的「讓團體練習，自然發生」與身分區的小標，已在 2026-10-20 finish review 依 /impeccable craft-floor 禁令、經產品主人同意刪除；身分名稱改當 h3。

## Layout

- **容器**：最大寬度 1152px（`max-w-6xl`），左右內距手機 20px、寬螢幕 32px。
- **段落節奏**：大段落上下間距，手機 64px、寬螢幕 96px。卡片之間 16–24px。
- **閱讀寬度**：段落文字控制在約 42rem 以內，避免一行太長。
- **斷點**：照 Tailwind 預設，`sm` 640px、`md` 768px、`lg` 1024px。檢查寬度依 `docs/harness/rwd-checklist.md`（360／390／768／1024／1440px）。
- **手機優先**：先排單欄；`md` 以上才分成多欄。
- **觸控目標**：按鈕、連結、可點選的選項至少 44px 高（`min-h-11`），不可以出現橫向捲動。首頁有產品主人核准的例外，見下方。

### Named Rules

**The Breath Rule.** 有疑慮時，多留白、少放東西。寧可讓一個段落只說一件事，也不要把三件事塞進同一張卡片。

### 首頁世界版面（只限 `/`）

首頁不用上面的 1152px 容器，整頁包在 `.home-scale` 裡，依視窗等比縮放（`globals.css`）：

- **430px 以下**：照手機構圖原尺寸，`--hu` = 1px。
- **431–1023px**：`--hu` = min(視窗寬 ÷ 430, 視窗高 ÷ 530)。高度限制讓 1280×800、1440×900 這類筆電也能在一個畫面看到導覽、插圖、主標與兩顆按鈕（產品主人 2026-10-20 選 A）。版面是置中單欄、最寬 430 × `--hu`，平板兩側會留白。
- **1024px 以上**：`--du` = 視窗寬 ÷ 1536，桌機元素都寫成「桌機構圖量到的數值 × `--du`」。
- `.home-scale` 內會改寫 Tailwind 的 `--spacing`、`--text-xs`、`--text-sm`、`--text-base`，所以一般的間距與字級 class 也會一起縮放。

**手機與平板構圖（comp-4e）：** 白色細頂列；滿版剪紙教室插畫約佔首屏四成高；下方白底、左對齊同一條邊線（左右內距 min(9.4vw, 40.4 × `--hu`)）：兩行主標、引言、上下疊放的滿寬主按鈕與次按鈕（間距 4）、置中的老師小字連結。下一段暖白底，置中標題下方三張插圖步驟，手機也排成三欄。再下一段白底，身分清單用細線上下分隔。

**桌機構圖（comp-desktop-a，產品主人 2026-10-20 選 A）：** 寬幅橫圖＋下方置中文字。滿版、較矮的橫幅插畫（2304×579）；下面置中一行主標、兩行引言、兩顆並排按鈕（各 422 寬、間距 16）、老師小字連結，步驟區開頭也在第一個畫面裡。步驟區與身分區內容寬 1190，步驟之間 90；身分區三欄、欄距 60，每欄上方一條細線。

**品牌字的位置：** 手機頂列左內距較窄（16px），品牌字貼近畫面左邊，不和主標對齊（產品主人核准的刻意差異）。桌機頂列高 66、左右內距 98／94。

**觸控與字級例外（產品主人 2026-10-20 核准，只限首頁）：** 為了貼近構圖，手機主按鈕高 37、次按鈕高 32、引言 13px、老師連結 12px，低於 `PRODUCT.md` 的 44px 觸控下限。這是首頁限定的例外，不改變全站 44px 規則，其他頁面不要照抄。身分區的文字連結仍維持 44px（`min-h-11`）。

## Elevation & Depth

整體是扁平的，靠「色調分層」表現深度，不靠陰影：奶油色頁面底 → 白色卡片 → 淡綠或淡金的提示框。卡片與頁面之間用 1px 的半透明墨綠細框分開。唯一的陰影是下拉選單的極淡陰影（`shadow-sm`），用來表示它浮在內容上方。

**首頁：** 完全沒有陰影，也沒有卡片。深度只來自插畫裡剪紙的前後重疊；介面上只用白底與暖白色帶的交替、以及 10%–15% 透明度的藏青細線分段。

### Named Rules

**The Flat By Default Rule.** 卡片、按鈕在靜止時都不加陰影。只有浮在內容上的東西（下拉選單）才可以用最淡的陰影。

**The Light Only Rule.** V1 只設計淺色畫面。原本 `globals.css` 裡 Next.js 範本留下的 dark mode 區塊已在 2026-10-18 階段 D0 移除，深色模式的裝置也會看到淺色畫面。

## Shapes

- **膠囊（9999px）**：所有按鈕、標籤（chip）、可切換的選項按鈕。這是刻意的品牌設計，維持不改；首頁的按鈕也是膠囊。
- **12px 圓角**：提示框、表單輸入框、可勾選的選項列。
- **16px 圓角**：一般內容卡片。
- **24px 圓角**：大型區塊，例如 `/about` 的鼠尾草區塊、老師頁的風格區塊。
- **原首頁有機形狀品牌圖形**：已在 2026-10-20 首頁改版時移除，目前沒有任何頁面使用。
- **首頁**：除了膠囊按鈕與品牌字中間的小圓點，沒有圓角容器；插畫是滿版直角，區塊之間靠底色與細線分開。

## Components

### Buttons

柔軟的形狀，篤定的存在感。

- **Shape：** 膠囊（9999px）。
- **Primary：** 實心松綠底、白字、字重 500，內距約 12px × 24px，高度至少 44px。每個畫面最多一個。
- **Hover / Focus：** hover 時變深松綠；鍵盤 focus 時出現 2px 外框，距離 2px。
- **Secondary：** 白色或半透明白底，加上 30% 松綠細框，墨綠字；hover 時細框變成實心松綠。
- **Text link：** 底線連結，hover 時文字變晨光金。

### 首頁按鈕（只限 `/`）

- **Primary「我要發起團課」：** 實心深藏青、白字、Noto Sans TC 800，左右內距 48；手機高 37、桌機高 66 寬 422。hover 變更深藏青。
- **Secondary「我要找一堂課」：** 1.5（桌機 2.5）靛藍外框、靛藍字；手機暖白底、高 32，桌機白底、和主按鈕同尺寸。hover 底色變白。
- **箭頭貼右：** 兩顆按鈕都是文字置中、箭頭（線條箭頭 SVG，粗細 2.25）固定在按鈕右側，主次只用實心／外框區分（產品主人 2026-10-20 選做法 1）。
- **Focus：** 2px 葉綠外框，距離 2px。
- **按下：** 縮到 0.985（`home-press`）；hover 或 focus 時箭頭往右移 3px（`home-nudge`）。
- **文字連結：** 靛藍字、靛藍底線、粗體，後面接小箭頭，hover 時箭頭右移；桌機的老師連結改用 1.5 粗的下邊線取代底線。

### Chips

- **Style：** 晨霧綠底、深松綠字、12px 小字、膠囊形狀。資訊型標籤也可以用沙色底加金色字。
- **State：** 可切換的選項，未選時是細框加淺墨綠字；選取後變實心松綠加白字。

### Cards / Containers

- **Corner Style：** 16px（一般）、24px（大型區塊）。
- **Background：** 白色，放在奶油色頁面上。
- **Shadow Strategy：** 無陰影，見 Elevation & Depth。
- **Border：** 1px，墨綠 12% 透明度。
- **Internal Padding：** 手機 20px、寬螢幕 24px。
- **首頁不用卡片**：步驟區是暖白色帶上的三欄插圖，身分區是用細線分隔的清單。

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
- **首頁 header（`variant="home"`）：** 白底、10% 藏青底線。品牌字是一行 Noto Sans TC 800 的「飛索・瑜伽團課共創平台」，中間的「・」是實心小圓點，英文名只留給螢幕閱讀器。**所有寬度（包含桌機）都只顯示 ☰ 選單按鈕**，連結與「登入／註冊」收在選單裡（產品主人決定桌機首頁保留漢堡選單）。選單裡的連結是粗體靛藍、hover 變葉綠，「登入／註冊」是深藏青膠囊。手機的選單按鈕與品牌字連結點擊高度至少 44px（2026-10-21 產品主人決定，不列入例外）。
- **首頁 footer（`variant="home"`）：** 暖白底、15% 藏青上緣、半粗靛藍字，連結 hover 變葉綠；已登入時拿掉「登入」。
- **登入後：** 公開頁會換成各角色專區的導覽外框（`site-shell.tsx`）。已登入的人從專區點品牌名稱回首頁（`?view=home`）時，首頁上方改用專區導覽列，不顯示首頁 header。

### 首頁剪紙插畫（Signature，只限 `/`）

首頁唯一的圖像。檔案在 `public/home/`（原始檔在 `assets/plates/`，每張圖都嵌有來源紀錄 provenance）：

- `hero-illustration.png`（1536×783）：手機與平板的首屏插畫。
- `hero-banner.png`（2304×579）：桌機（≥1024px）的寬幅橫圖。兩張用 `<picture>` 切換，瀏覽器只下載需要的那一張。
- `step-1-art.png`、`step-2-art.png`、`step-3-art.png`：三個步驟的小插圖，放進同比例的框、靠下對齊，讓下方標題排在同一條線上。

首屏插圖有描述畫面內容的替代文字；步驟小插圖是裝飾，替代文字留空。插畫是示意，不是真實課程現場；首頁不放人數、評分、推薦語、合作單位或價格。

### 首頁動態（只限 `/`）

安靜、不擋閱讀，只在系統沒有開「減少動態」時啟用：

- **首屏淡入**（`home-enter`）：插圖、主標、引言、按鈕、老師連結依序淡入並上移 6px，420ms，延遲 0／120／180／240／300ms 錯開。
- **捲動浮現**（`home-reveal`）：步驟與身分項目進入畫面時淡入並上移 12px（scroll-driven animation，不支援的瀏覽器直接顯示）。
- **箭頭輕推**（`home-nudge`）：hover／focus 時箭頭右移 3px，200ms。
- **按下回饋**（`home-press`）：按鈕按下時縮到 0.985，120ms。

## Do's and Don'ts

### Do:

- **Do** 首頁以外的頁面用奶油色（cream）當頁面底色，白色卡片加細框浮在上面。
- **Do** 每個畫面只放一個實心松綠主要按鈕，其餘用外框按鈕或文字連結。
- **Do** 把晨空藍保留給大面積、安靜的區塊；晨空藍底上的字一律用晨空深藍。
- **Do** 小標用晨光金、字距 0.2em。
- **Do** 所有可點的東西至少 44px 高，並保留清楚的 focus 外框（首頁手機按鈕是產品主人核准的例外）。
- **Do** 沒有真實素材時，用文字與留白撐起畫面。
- **Do**（首頁）只用 `home-*` 色票與 `font-home-display`，並維持白底＋暖白色帶＋藏青細線的扁平分段。
- **Do**（首頁）兩顆行動按鈕同寬、文字置中、箭頭貼右，主次只用實心／外框區分。
- **Do**（首頁）新的尺寸寫成「構圖數值 × `--hu`」或「× `--du`」，讓它跟著 `.home-scale` 縮放。

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
- **Don't** 在首頁以外的頁面使用 `home-*` 色票、Noto Sans TC 主標字或 `.home-scale`，除非產品主人決定擴大。
- **Don't**（首頁）在標題上方放小標（eyebrow）。
- **Don't**（首頁）把插畫的紙色抽出來當按鈕、文字或底色。
- **Don't** 把首頁 37／32px 按鈕高度當成其他頁面的先例；全站下限仍是 44px。
