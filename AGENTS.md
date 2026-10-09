# AGENTS.md

## Project

Free Soar Yoga is the first-phase marketplace product under the Free Soar master brand.

It is not a generic yoga website, a cold booking tool, or a discount course marketplace.
It is a brand-driven yoga group-class marketplace that helps organizers, yoga teachers, and members co-create high-quality body-mind practice experiences.

## Brand Constitution

The product must follow the Free Soar master brand spirit:

- Freedom 自由
- Awakening 覺醒
- Growth 成長
- Wellness 身心整合
- Leadership 自主人生
- Community 共創社群

The product should feel:

- Gentle
- Clear
- Spacious
- Trustworthy
- Professional
- Feminine
- Modern spiritual
- Technology-enabled but human-centered

UI 要避免的預設樣式（AI 生成畫面的常見套路，不屬於本品牌）：

- 標題裡用斜體強調某幾個字
- 用 01／02／03 編號當區塊標籤
- 用等寬字體（monospace）做小標籤

奶油色背景（`cream` #f7f4ee）與圓角膠囊按鈕（`rounded-full`）是既有品牌設計，照 `src/app/globals.css` 的色票使用，不在避免清單內。

## V1 Product Definition

Free Soar Yoga V1 is a yoga group-class marketplace for:

- Organizers / group leaders
- Yoga teachers
- Members / students
- Platform admins

V1 enables:

- Organizers to create group-class demand requests
- Teachers to create profiles and manage availability
- Teachers to view and respond to demand requests
- Organizers to select teachers and form class sessions
- Members to enroll in class sessions
- Admins to manage teachers, demands, classes, enrollments, and basic reporting

## V1 Scope

Must include:

- Brand landing pages
- Teacher onboarding
- Teacher profile
- Teacher availability calendar
- Organizer demand request
- Demand pool
- Teacher response
- Class session
- Enrollment
- Admin dashboard
- Email notification
- RWD / mobile-first support

Must not include in V1 unless explicitly approved:

- Native mobile app
- Advanced AI recommendation
- Full payment/refund automation
- Google Calendar two-way sync
- LINE deep integration
- Advanced enterprise permissions
- Wellness / Academy / Retreat full modules
- Complex gamification
- Full SaaS tools for teachers

## Tech Stack

Default preferred stack:

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma or Drizzle
- Auth.js / Supabase Auth / Clerk
- Resend
- Vercel
- Playwright
- Vitest

Architecture principles:

- Keep marketplace business logic out of page components.
- Use service/domain layers for state transitions and permission checks.
- Keep UI components reusable and mobile-first.
- Document data model, permissions, and state machines before major implementation.
- Preserve App-ready architecture by keeping APIs and domain logic clear.

## Development Workflow

Every non-trivial feature must follow:

1. spec
2. plan
3. build
4. test
5. review
6. ship

長任務（會跨很多步驟或很多回合的工作）要把任務清單寫在檔案裡：已有對應的 plan 或 ticket 檔（`docs/superpowers/plans/`）就直接用那份，完成一項勾一項，途中發現的新事項也補進去。不要只把清單留在對話裡，因為對話變長時舊內容會被摘要，清單可能會不見。

已核准的 STANDARD 任務，預設依 `docs/harness/risk-based-workflow.md` 的「STANDARD 精簡執行」：按需讀檔、引用 spec／票券、不重抄產品規則；一次落實核准範圍，每票只記範圍差異與短進度。完整 packet 在任務完成、實際移交或阻塞時產出，不在每張內部票重建相同報告。多票接續仍需明確授權；不得略過必要驗證、擴 scope 或放寬 Human Gate、commit／push gate。

已核准 HEAVY 多票任務依同文件的「已核准 HEAVY 多票紀錄」引用既有決策、累積證據與內部短進度；不逐票重抄相同規則或重建相同報告。Human Gate、獨立 review 與必要驗證仍逐項成立，正式 review／決策／交接時提供完整材料。未 commit 的 baseline／patch 與 migration 授權亦依該文件；快照不等於隔離工作環境，授權 schema 方案不等於授權操作任意資料庫。

Use relevant agent-skills workflows when available:

- spec-driven-development
- planning-and-task-breakdown
- incremental-implementation
- frontend-ui-engineering
- api-and-interface-design
- test-driven-development
- debugging-and-error-recovery
- code-review-and-quality
- security-and-hardening
- documentation-and-adrs
- ci-cd-and-automation
- shipping-and-launch

## Documentation Rules

For the docs system under `docs/`:

- File names and folder names must use English kebab-case for tool compatibility, URLs, Git diffs, and developer collaboration.
- Route names, component names, function names, model names, schema names, and code identifiers must use English.
- Document content should be written in Traditional Chinese by default, because the product owner reviews and decides in Chinese.
- Technical terms can remain in English when clearer, including marketplace, dashboard, route, permission, state machine, API, service layer, MVP, RWD, and mobile-first.
- Document titles can be English or bilingual, but explanatory content should be primarily Traditional Chinese.
- If a document must include English content for code, identifiers, third-party service names, or external references, add Chinese explanation around it.
- Do not rename existing docs only to translate file names into Chinese.
- Do not translate programmatic names into Chinese because docs content is Chinese; code and system naming remain English.
- When architecture, product behavior, permissions, state machines, or scope changes, update the related Chinese docs in the same change.

## Response Language

除非使用者明確要求英文，Codex 的 final report、self review、review packet、scope drift check 與 implementation summary 應以繁體中文為主。

Code identifier、route name、file path、command name、Git command、package name、第三方服務名稱與 error code 可在較清楚時保留英文。

## Completion Report

Codex 每次 final report 都必須包含 `Recommended Next Step`，即使本輪結果是 completed、partially completed、blocked、no-op 或 planning-only。

一般 final report 的 `Recommended Next Step` 至少必須具體回答：

- Level：L1 快速解決問題 / L2 Harness Preflight / L3 需要啟動 template prompt。
- Recommended next work mode。
- Next smallest actionable slice。
- Why this should be next。
- Can Codex execute directly。
- Suggested execution location：在現有 task 執行、開新 task 執行，或兩者皆可。
- Requires product owner decision。
- Suggested next prompt。

`Suggested next prompt` 必須可直接複製使用，並依任務等級對齊 `docs/harness/next-step-handoff-levels.md`：

- L1 可提供一句輕量 prompt。
- L2 應提供 Harness Preflight prompt。
- L3 必須提供符合 planning、builder、reviewer 或 product owner decision template 的 prompt。

若有產出 `Suggested next prompt` 且不是 `None`，Codex 的 final report 最後必須用 1 / 2 選項格式詢問產品主人是否要在目前 task 執行該 prompt，或開新 task 執行該 prompt。Codex 不得在未被明確要求時自動建立新 task。

正式 Builder Review Packet、Reviewer output 或 Final Review output 若作為 handoff packet，必須依 `docs/harness/review-packet-spec.md` 補齊完整 Common Handoff Schema，包括 auto-continue、stop / notify 與 approval boundary 欄位。

內部票券的短進度紀錄不是 final report 或正式 handoff，不必逐票列 L1／L2／L3、Common Handoff Schema 或 1／2 選項。實際 final report 與交接仍遵守以上規則。

不得只給空泛建議，例如「可以繼續優化」。若沒有合理下一步，必須寫 `None`，並說明為什麼可以停止。

本規則不改變 V1 scope、product owner decision gate、commit gate 或 push gate；Codex 仍不得在未經產品主人明確要求時自動 commit 或 push。

## Quality Gates

Before merge:

- TypeScript passes
- ESLint passes
- Build passes
- Unit tests pass for changed logic
- E2E smoke tests pass for key user flows
- Role permissions reviewed
- Marketplace state transitions reviewed
- Brand consistency reviewed
- RWD/mobile review completed
- App-readiness boundary not violated

驗證範圍須對應實際修改與具體風險；完整依賴目錄校驗需先說明必要性、預期耗時與較輕量替代方案。

## Required Self Review

After any docs or code modification, Codex must run a lightweight self review before reporting completion.

Codex must report:

- Which files were changed.
- Whether the change stays within V1 scope.
- Whether it avoids adding Wellness / Academy / Retreat modules, AI matching, complex payment/refund automation, or a native mobile app.
- Whether it remains consistent with the role model, permissions, state machines, data model, and route map.
- Whether there are security, RWD, or brand consistency concerns.
- Whether any product owner decision is required.
- Whether any unrelated files were modified.
- Whether Codex did not auto commit or push.

Codex self review is the first guardrail, not the final product decision.

STANDARD 內部票券可將 self review 與 scope drift 合併成短紀錄；仍須實際檢查上述項目並記錄發現的風險。任務完成或交接時集中報告完整結果，不以精簡格式宣稱未驗證項目通過。

Any decision that affects Auth, Prisma schema, role / permission model, marketplace state machines, V1 scope, or core user flows requires product owner confirmation.

Codex must not commit or push unless the product owner explicitly asks for it.

## AI Rules

- Do not overbuild beyond V1.
- Do not change the data model without explaining impact.
- Do not change marketplace state machines without updating docs.
- Do not change permissions without security review.
- Do not implement payment unless explicitly requested.
- Do not auto-publish generated content.
- Do not remove brand context.
- Always update docs when architecture or product behavior changes.
- For uncertain product decisions, create options and tradeoffs instead of silently choosing.
