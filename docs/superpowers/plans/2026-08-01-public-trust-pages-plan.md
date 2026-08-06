# Public Trust Pages — Draft Implementation Plan

> Status: DRAFT — 待 Codex peer review 與產品主人內容決策；未授權 Builder 施工。
> Date: 2026-08-01

## 1. Outcome

在不改變 marketplace 核心流程的前提下，補齊 V1 已定義但尚未實作的 `/about` 與 `/faq`，並讓首頁、教師加入、主辦需求入口與兩個信任頁之間有一致、mobile-first 的公開導覽。完成後，首次造訪者應能在手機與電腦上快速理解 Free Soar Yoga 是什麼、適合誰、如何開始，以及目前平台能與不能處理的事情。

本計畫是「可施工前的 draft」，不是公開文案的自動發布授權。任何涉及付款、取消、退款、隱私、法律承諾、療效或聯絡方式的內容，都必須先通過產品主人決策。

## 2. Authority and Repo Reality

- `docs/product/PRD.md`、`docs/scope/v1-scope.md` 與 `docs/product/route-map.md` 已把 `/about`、`/faq` 列入 V1 public/trust pages；只有 `/classes` 被標為可延後。
- `docs/product/current-functional-architecture.md` 記錄 `/about`、`/faq` 尚未實作。
- `src/app/page.tsx` 目前是早期簡化首頁；`src/app/teachers/join/page.tsx` 與 `src/app/organizers/request/page.tsx` 已有較完整的品牌視覺，但尚無共同 public navigation。
- `src/app/layout.tsx` 仍使用預設 metadata 與 `lang="en"`，與繁體中文品牌網站不一致。
- 品牌依據：`docs/context/founder-intent.md`、`docs/context/brand-rules.md`、`docs/context/voice-and-tone.md`、`docs/context/visual-direction.md`。語氣必須溫柔、清楚、寬敞、可信任，不使用焦慮式銷售、醫療療效、低價市場或過度神祕宣稱。
- 工作樹目前另有 account/dashboard navigation 等未提交修改。Builder 必須只處理本計畫 allowlist，不能整理、覆寫或順手提交其他人的變更。

## 3. Scope

### In scope

- 新增 `/about` 與 `/faq` server-rendered public pages。
- 建立可重用且可由既有 Client Component 安全引用的 public header/navigation 與 footer，套用至 `/`、`/about`、`/faq`、`/teachers/join`、`/organizers/request`。
- 更新首頁，使 organizer、teacher、member 三種角色與平台運作方式清楚可見；現階段只把 organizer 與 teacher 呈現為可直接開始的 primary CTA，不虛構 member 公開探索入口。
- 修正 root document language 與品牌 metadata；為 `/about`、`/faq` 提供 page-specific metadata。
- 新增 desktop/mobile smoke coverage，包含導覽、主要 CTA、鍵盤焦點與水平 overflow。
- 若公開行為或 route 說明改變，更新 `docs/product/route-map.md` 與 `docs/product/current-functional-architecture.md`。

### Explicitly out of scope

- 不新增 Privacy Policy、Terms、Cookie consent；它們是另一個 launch/legal slice。
- 不自行制定付款、退款、取消、爭議處理或客服 SLA。
- 不新增真實課程資料、CMS、部落格、推薦演算法、AI matching、native app、Wellness / Academy / Retreat 模組。
- 不改 Auth、Prisma schema、permissions、marketplace state machines 或既有 form submission 行為。
- 不將 public header 放到所有 authenticated/admin routes 的 root layout。
- 不部署、不自動發布、不 commit、不 push。

## 4. Product Owner Decision Gates

Builder 開始前，產品主人必須確認以下內容；未確認時停止，不得自行猜測：

| Gate | Recommended default | Why it matters |
|---|---|---|
| P1 公開品牌文案 | 採本計畫的資訊架構，由 Builder 先做「待核稿」文案，再由產品主人逐頁核准 | 文案會對外代表品牌，不能由技術決策取代品牌決策 |
| P2 聯絡方式 | 只顯示已由產品主人確認且可收信的 support email；未確認就不放地址 | 避免公開無人管理或錯誤信箱 |
| P3 付款與退款 FAQ | 本 slice 不回答價格、付款、退款承諾，只說明平台目前不提供完整線上付款/退款自動化 | V1 明確排除 full payment/refund automation |
| P4 取消規則 | 不承諾期限、費用或退款；導向該課程主辦方與日後正式政策 | 目前沒有已核准的共通 cancellation policy |
| P5 首頁改版幅度 | 只做 V1 marketplace landing，不延伸 master-brand 其他事業模組；三種角色都可被理解，但 primary CTA 只提供目前有完整公開入口的 organizer 與 teacher | 防止 scope drift，且不把 `/account` 冒充課程探索入口 |

P2–P4 若尚未決定，不阻擋頁面骨架與測試先完成，但阻擋標記為 launch-ready 與公開部署。

## 5. Information Architecture and Copy Contract

### `/`

1. Brand promise：用一句清楚、可驗證、無療效宣稱的繁體中文說明平台價值。
2. Three audience roles：主辦人提出團課需求、老師加入與回應需求、學員透過已形成課程的分享連結了解並報名；不得宣稱目前已有 public class discovery/listing。
3. How it works：需求 → 老師回應 → 主辦選擇 → 形成課程 → 學員報名。
4. Trust block：說明審核、角色與資料透明度，但不宣稱尚未實作的保障。
5. Primary CTA：只提供 `/organizers/request`、`/teachers/join`。Member 區塊是誠實的使用方式說明，不放假的 discovery CTA，也不以 `/account` 冒充探索入口；日後 `/classes` 真正可用時另案加入。

### `/about`

- Free Soar Yoga 與 Free Soar master brand 的關係。
- 為何以共創團課 marketplace 連結 organizer、teacher、member。
- Freedom、Awakening、Growth、Wellness、Leadership、Community 如何落到產品行為。
- 清楚說明平台不是低價課程傾銷、醫療服務或成果保證。

### `/faq`

- 依 audience 分組：主辦人、老師、學員、帳號與通知。
- 只回答 repo 已存在或 V1 已批准的能力。
- 不得把「規劃中」寫成已上線；尚未提供的能力以平實語句標註。
- 所有答案必須是可見文字；accordion 若採用 `<details>/<summary>`，需保留原生鍵盤操作與無 JavaScript 基礎可讀性。

### Shared public navigation

- Logo/brand link 回 `/`。
- Links：關於我們、常見問題、我是老師、我是主辦人、登入/我的帳戶。
- Mobile menu 必須有可辨識 label、正確 expanded state、Escape/焦點行為；本 slice 優先採自然換行、無展開狀態的簡單連結列，避免為 hamburger 新增 client state。
- `PublicHeader` / `PublicFooter` 必須是同步、純呈現元件：不得使用 server-only API、async component、資料查詢或 React hooks。它們可在 server pages 保持 server-rendered，也可被既有 `"use client"` 的 `/teachers/join` 依賴圖安全納入 client bundle。若 Builder 發現需要 server-only 能力，必須改採 server page wrapper + 抽出的 teacher client form，並先回報新增檔案/風險；不得直接把 server-only component import 進 client page。
- Footer 不顯示未核准地址、公司資料、政策或社群帳號。

## 6. Proposed File Boundary

Expected allowlist（Builder 開始時需先重新查證；若實際架構不同，先回報）：

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/about/page.tsx` (new)
- `src/app/faq/page.tsx` (new)
- `src/app/_components/public-header.tsx` (new)
- `src/app/_components/public-footer.tsx` (new)
- `src/app/teachers/join/page.tsx`
- `src/app/organizers/request/page.tsx`
- `tests/smoke/public-trust-pages.spec.ts` (new)
- `docs/product/route-map.md`
- `docs/product/current-functional-architecture.md`

Forbidden without a new product-owner gate: `prisma/**`, `src/domain/**`, `src/lib/auth/**`, admin/dashboard business pages, payment code, notification delivery code, dependency/config changes unrelated to the public pages.

## 7. Incremental Build Plan

### Slice A — Content inventory and contract

1. Re-audit every CTA target with `rg` and confirm the route is usable, not merely documented.
2. Draft page-level copy in the components or a small typed content module; identify every unapproved sentence with a visible review checklist in the Builder handoff, not a user-facing “TODO”.
3. Obtain P1–P5 decisions before declaring copy final.

Acceptance:

- No claim exceeds current product behavior.
- No medical, guaranteed outcome, discount-marketplace, urgency, payment/refund or legal claim is invented.
- Every CTA target exists and has an intentional auth behavior.

### Slice B — Shared public shell

1. Build synchronous, pure-presentational `PublicHeader` and `PublicFooter` according to section 5. They must have no server-only imports or hooks, so the existing `/teachers/join` Client Component can import them without an invalid server/client boundary.
2. Integrate them manually only into the five public pages; do not modify authenticated route chrome.
3. Use semantic `header`, `nav`, `main`, `footer`; maintain one logical `h1` per page and visible keyboard focus.

Acceptance:

- Public navigation is consistent at 360, 390, 768 and desktop widths。
- Shared shell introduces no new hydration state. On `/teachers/join` it may be included in the existing client dependency graph, but remains a synchronous presentational component with no effects or browser-only behavior。
- Existing teacher and organizer forms, Server Actions, success/error rendering and query behavior remain unchanged.

### Slice C — Pages and metadata

1. Implement home sections per section 5.
2. Add `/about` and `/faq` as server components with page metadata.
3. Change root document language to `zh-Hant` and replace Create Next App metadata with Free Soar Yoga metadata.
4. Preserve the existing visual vocabulary: sky/white/gold palette, generous whitespace, readable contrast, feminine but inclusive tone.

Acceptance:

- Direct navigation to all three pages returns usable content without auth.
- Page titles/descriptions are specific and accurate.
- No images are required for acceptance; if images are later proposed, accessibility text, licensing and performance are separate review items.

### Slice D — Automated and manual verification

Add `tests/smoke/public-trust-pages.spec.ts` covering:

- anonymous user can visit all five promised pages: `/`, `/about`, `/faq`, `/teachers/join`, `/organizers/request`;
- nav/footer links resolve to expected routes;
- all five pages expose the same public nav/footer contract;
- organizer page still exposes its existing profile/sign-in actions，teacher page still hydrates and exposes its existing draft/readiness/submit controls；run the existing teacher/organizer targeted specs as regression coverage for the full form flows;
- FAQ questions are keyboard reachable and answers readable;
- root language and page titles are correct;
- 360×800 and 390×844 have no body/document horizontal overflow; desktop layout is checked at 1440×900;
- key text does not rely on color alone and focus indicators are visible.

Run, in order:

```text
npx playwright test tests/smoke/public-trust-pages.spec.ts
npx playwright test tests/smoke/teacher-join.spec.ts tests/smoke/organizer-demand.spec.ts
npx tsc --noEmit
npm run lint
npm run build
npm run test:smoke
```

Manual review: iPhone-class 360/390 width, Android Chrome-class width, desktop Chrome, keyboard-only navigation, 200% zoom, long Traditional Chinese wrapping, and brand/copy review by product owner.

### Slice E — Documentation and readiness update

- Mark `/about` and `/faq` as implemented only after automated checks and manual copy review pass.
- Record unresolved Privacy/Terms/contact/payment-policy dependencies as separate launch items, not as completed by this slice.
- Run required self review and list all changed files; do not include unrelated dirty files in commit preparation.

## 8. Security, Accessibility, RWD, and Brand Guardrails

- Public pages must not expose user, teacher application, organizer request or enrollment data.
- Do not embed API keys, personal email addresses, unpublished business details or analytics trackers.
- Public links into authenticated areas may redirect to sign-in, but must not reveal protected state in query strings.
- Touch targets should be at least 44×44 CSS px where applicable; contrast and focus state need manual review.
- Use mobile-first layout; long words/URLs must wrap and no fixed-width card may overflow.
- Copy must remain human-centered and trust-building, with no hard sell or unverified wellness outcomes.

## 9. Rollback and Stop Conditions

Rollback is file-level: remove the two new routes/components and revert only the public-page integrations/metadata/docs from this slice. No schema or data rollback should exist.

Stop and ask the product owner if:

- a CTA requires building a missing core flow;
- a FAQ answer needs a new payment/refund/cancellation/legal policy;
- authenticated pages would need global layout restructuring;
- implementation appears to require Auth, Prisma, role, permission or state-machine changes;
- concurrent edits overlap any allowlisted file and cannot be safely preserved;
- product owner has not approved external-facing copy before deploy.

## 10. Definition of Done

- `/about` and `/faq` exist, are accurate, accessible and RWD-reviewed.
- All five promised public pages share coherent navigation without changing protected route or teacher/organizer form behavior.
- Root/page metadata and `zh-Hant` are correct.
- Targeted test, TypeScript, ESLint, build and full smoke suite pass.
- Product owner approves public copy and all unresolved policy items are explicitly tracked.
- Docs reflect actual implementation.
- Required self review is complete; no unrelated files, commit, push or deploy are included.

## 11. Human Decision Record — 2026-08-02

產品主人已核准本 plan 的建議預設，Builder 可依下表施工；此核准不等同於公開部署或 commit/push 授權。

| Gate | Approved decision | Implementation boundary |
|---|---|---|
| P1 | A：採用本 plan 的資訊架構；Builder 可撰寫繁中初稿 | 上線前仍須產品主人逐頁核對公開 copy；不得加療效、保證、焦慮銷售或未證實承諾 |
| P2 | A：本 slice 不公開 support email | Footer／FAQ 不得放 placeholder、未確認信箱或其他聯絡資料 |
| P3 | A：只說明平台目前不提供完整線上付款與退款自動化 | 不承諾付款方式、退款資格、處理期限或金額 |
| P4 | A：不建立通用取消規則 FAQ | 不寫任何取消期限、費用或退款結果；若未來有正式政策，再另案加入 |
| P5 | A：首頁說明三種角色，但 primary CTA 只提供 organizer、teacher | 不新增或假裝存在 public class discovery；member 區塊只說明既有分享連結報名方式 |

**Next allowed action：**可進入 Public Trust Pages Builder；僅限本 plan allowlist，保留所有 stop conditions。**Commit / push / deploy：**未核准。

<!-- codex-peer-reviewed: 2026-07-31T22:01:25Z rounds=3 verdict=approved -->
