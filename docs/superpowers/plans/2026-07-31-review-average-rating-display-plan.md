# Review Average Rating Display — Implementation Plan

## 0. 如何閱讀本 plan（給零背景 Builder）

這份 plan 假設你完全沒看過之前的對話。所有你需要知道的背景、決策與理由都寫在這份文件裡。請依序讀完 1–5 節再開始施工，不要跳著讀。`## 3. 產品主人決策 Gate（D1–D7）` 是本輪所有「為什麼這樣做、不那樣做」的權威來源——如果程式碼與 D 項衝突，以 D 項為準並回報，不要自己猜。

## 1. 背景與範圍

`class-session-review` 一輪（`docs/superpowers/plans/2026-07-29-class-session-review-plan.md`）已經讓 `Review` model 落地：Member 對 `completed` 且自己有 `confirmed` enrollment 的 class session 留下一次性 1–5 星評價與選填評語。目前的可見範圍嚴格 own-scoped（見 `docs/domain/permissions-matrix.md` 的 Review 小節）：

- Member 只看得到自己留下的那一則。
- Organizer／Teacher 在自己的 class session 詳情頁（`/organizer/classes/[classSessionId]`、`/teacher/classes`）看得到該堂課收到的**所有**評價（含評語與評價者顯示名稱）。
- Admin 完全不介入——`permissions-matrix.md` 明確標記 Admin 欄位是「完整未來設計，V1 未開放任何 Admin 專用的評價檢視介面」。

`Review` 目前只以「單一 class session 底下的評價清單」形式存在，從來沒有任何地方把一位老師**所有**課程的評價彙整成一個平均分數。這個彙整能力在 v1-scope.md 的 Nice to Have 清單裡（「Basic review system」的延伸），前幾輪 Admin 完整性系列因為優先處理 Admin 缺口而一直延後。

**這輪的目標**：讓老師可以在管理自己個人資料的地方看到自己的平均評分與評價數，並讓 Admin 在既有的老師列表上看到同樣的彙整數字，作為審核／管理時的參考訊號——**不**新增任何可以瀏覽逐筆評價內容（評語、評價者身分）的新介面。

## 2. 範圍界線

### 2.1 本輪要做的事

- 新增一個唯讀的彙整查詢：`getOwnTeacherRatingSummary()`（own-scoped，供 Teacher 自己使用）——計算方式見 D3。
- 擴充既有 `listApprovedAndSuspendedTeacherProfilesForAdmin()`（`src/domain/teacher-profile/service.ts:819-848`）的回傳型別，讓每位老師額外帶上 `averageRating` 與 `reviewCount` 兩個計算欄位。
- 在 `/teacher/profile`（`src/app/teacher/profile/page.tsx`）approved／suspended 兩種狀態下，各自的區塊頂端加一個唯讀的「平均評分」摘要小方塊。
- 在 `/admin/teachers`（`src/app/admin/teachers/page.tsx`）的 Approved／Suspended 兩個卡片列表裡，各自卡片的 `Last updated` 那一行旁邊加上平均評分與評價數。

### 2.2 本輪明確不包含（Non-goals，不得偷偷併入本輪）

- **Admin 逐筆評價檢視介面**：`permissions-matrix.md` 裡 `View class session's reviews` 的 Admin 欄位（完整未來設計）**這輪不落地**——Admin 只看得到一個計算後的平均分數與評價則數，看不到任何評語內容或評價者身分。這是刻意縮小的、獨立的新能力（見 D2），不是把整個 Admin 未來設計一次做完。
- **`/teacher/dashboard` 顯示同樣的摘要**：Dashboard 頁面聚焦在「TeacherProfile 狀態與下一步」，不重複塞入這個新指標，避免同一個數字在兩個頁面各自查詢、未來各自漂移（見 D1）。
- **依評分排序、篩選或任何 marketplace 呈現**：目前沒有任何 Organizer／Member 可瀏覽的老師列表頁存在（已確認 `src/app`下沒有這類 route），這輪不新增。
- **歷史趨勢／分項評分**：只計算「全部評價的算術平均」與「總則數」這兩個最小指標，不做時間趨勢圖或按課程類型拆分。
- **快取或反正規化欄位**：不在 `TeacherProfile` 上新增 `averageRating` 欄位做反正規化儲存，永遠即時計算（理由見 D3——資料量在 V1 規模下即時計算沒有效能疑慮，反正規化只會多一個要保持同步的地方）。

## 3. 產品主人決策 Gate（D1–D7）

### D1 — 顯示位置：`/teacher/profile`（own）＋ `/admin/teachers`（Admin），不含 `/teacher/dashboard`

`/teacher/profile` 是老師管理自己公開個人資料的頁面，在這裡看到「目前的評分表現」最貼近使用情境（比照過去自己編輯完再確認呈現的心智模型）。`/admin/teachers` 是 Admin 目前唯一會看到老師完整資訊的地方，加在既有的 `Last updated` 旁邊，比照 `teacher-profile-edit` 那一輪替 Admin 補充被動可見資訊（不新增互動、不新增查核流程）的既有先例。`/teacher/dashboard` 目前的資訊密度已經是「狀態 + 下一步」，刻意不重複顯示同一個數字，避免兩個頁面各自查詢、未來修改時只改到一邊。

### D2 — Admin 看得到的是「彙整後的兩個數字」，不是評價本身

這是本輪唯一一個**實質擴大 Admin 可見範圍**的決定，需要明確拍板：`permissions-matrix.md` 目前對 `View class session's reviews` 的 Admin 欄位寫的是「完整未來設計，V1 未開放任何 Admin 專用的評價檢視介面」。這輪刻意只開放一個**衍生的計算結果**（平均分數、總則數），不開放任何逐筆評價的內容（評語、評價者身分、對應是哪一堂課）——Admin 拿到的是一個信號數字，不是一個新的資料檢視介面。這個範圍刻意設計得比未來完整設計小很多，兩者是不同顆粒度的能力，文件更新時必須清楚區分（見 D7），不能讓讀者誤以為 Admin 評價檢視介面已經落地。

### D3 — 計算方式：即時查詢，不落地反正規化欄位

`Review` 透過 `classSessionId` 關聯到 `ClassSession`，`ClassSession` 才有 `teacherProfileId`（`prisma/schema.prisma:261-274`、`209-237`），兩者是兩層關聯，Review 沒有直接指向 TeacherProfile 的欄位。

- **Teacher 自己（單一老師）**：`prisma.review.aggregate({ where: { classSession: { teacherProfileId } }, _avg: { rating: true }, _count: { rating: true } })`。Prisma 的 `aggregate` 會直接轉譯成資料庫端的 `AVG()`/`COUNT()` 聚合查詢（連同關聯篩選一起在 SQL 端用 JOIN 完成），**不會**把逐筆 `Review` 撈進應用層，只查一位老師，沒有效能疑慮。
- **Admin 列表（多位老師）**：不對每位老師各自呼叫一次 `aggregate`（會變成 N+1），**也不能**用巢狀 `select`（`classSessions: { select: { reviews: { select: { rating: true } } } }`）把每位老師底下所有課程的逐筆評價分數整包撈進應用層再用 `.map()`/`flatMap` 計算——這個寫法會隨著平台累積的評價總數持續變重（每次載入 `/admin/teachers` 都要把全平台所有已核准/暫停老師的**逐筆**歷史評價分數整包搬進應用層，即使最終只需要兩個彙整數字），是會隨時間惡化的效能債，**不採用**（round 1 codex review 抓到，已修正）。改成**資料庫端聚合**：先照既有邏輯查出 approved/suspended 老師清單（含 `id`），再對這批 `teacherProfileId` 發一個 `prisma.$queryRaw`，用 SQL `JOIN` + `GROUP BY` 直接在資料庫端把 `Review` 經 `ClassSession` 關聯到 `teacherProfileId` 聚合成每位老師一列的 `(averageRating, reviewCount)`，最後在應用層用一個 `Map` 把這批彙整結果併回老師清單（找不到代表沒有任何評價，預設 `{ averageRating: null, reviewCount: 0 }`）。本檔案（`src/domain/teacher-profile/service.ts`）目前沒有 raw SQL 先例，但同一個 codebase 裡 `src/domain/class-session/__internal__/cancel-class-session-core.ts:100-119`、`src/domain/enrollment/__internal__/create-enrollment-core.ts:97-104` 已經確立 `prisma.$queryRaw` + `Prisma.sql` tagged template的既有寫法，這裡是同一套機制的延伸使用（聚合查詢，不是鎖列），不是引入新技術。
- **不落地反正規化欄位**：不在 `TeacherProfile` schema 加 `averageRating`/`reviewCount` 欄位。這兩個值永遠是即時計算的衍生值，沒有寫入路徑需要同步維護，避免「評價被建立後平均分數沒更新」這類新的一致性問題。

### D4 — 顯示文案：四捨五入到小數點後一位；沒有評價時顯示「尚無評價」而不是「0.0」

平均分數顯示格式：`${formatted} 分（${reviewCount} 則評價）`，例如「4.5 分（12 則評價）」。`reviewCount === 0` 時（`averageRating` 為 `null`，因為 Prisma 的 `_avg`／SQL `AVG()` 在沒有符合條件的資料列時回傳 `null`）改顯示「尚無評價」，不要顯示「0.0 分」——一位還沒收到任何評價的老師不應該被呈現成「表現是 0 分」，這會誤導閱讀者。

**四捨五入不可以直接用 `averageRating.toFixed(1)`**：`toFixed()` 是二進位浮點數的字串轉換，不保證十進位四捨五入——例如 `(81 / 20).toFixed(1)` 在 Node.js 實際會得到 `"4.0"` 而不是數學上正確的 `"4.1"`（已用 `node -e` 實測確認，round 1 codex review 抓到）。正確寫法：先用 `Math.round(averageRating * 10) / 10` 取到小數點後一位的精確數值，再對這個結果呼叫 `.toFixed(1)` 轉成顯示字串（`(Math.round(averageRating * 10) / 10).toFixed(1)`）。抽出一個共用的 `formatTeacherRatingSummary(summary: { averageRating: number | null; reviewCount: number }): string` helper（放在 `src/domain/review/read-service.ts`，Teacher 與 Admin 頁面共用同一份格式化與零評價判斷邏輯，避免兩處各自實作、未來規則跑掉）。

### D5 — `/teacher/profile` 的顯示時機：只在 approved／suspended 兩種狀態顯示

`Review` 只可能存在於「曾經 approved 過、且該堂課完成」的老師身上（`draft`/`submitted`/`rejected` 狀態的老師從未進入可授課階段，不可能有 `ClassSession`，見 `docs/specs/class-session-and-enrollment-spec.md` 的落地現況）。`getOwnTeacherRatingSummary()` 只在頁面判斷出 `profile.status` 是 `approved` 或 `suspended` 時才呼叫（跟現有 `isApproved` 分支共用同一個判斷條件），其餘狀態不查詢、不顯示，避免對不可能有資料的狀態做多餘查詢。

### D6 — 不新增 Notification

平均分數是被動查詢顯示的衍生資料，不是任何人主動觸發的動作，沒有「誰需要被通知」的情境，不新增任何 notification type。

### D7 — 文件對齊策略

1. `docs/domain/data-model.md`：Review 小節補一句話，說明平均分數與評價則數是**即時計算的衍生值**（不是新欄位），在 `/teacher/profile`（own）與 `/admin/teachers`（Admin，彙整值）顯示。
2. `docs/domain/permissions-matrix.md`：Review 小節的「V1 落地範圍」段落補充說明——`View class session's reviews` 的 Admin 欄位**逐筆評價檢視**仍是完整未來設計、V1 未開放；但新增一句清楚區隔的說明：V1 額外開放 Admin 在 `/admin/teachers` 看到**衍生的彙整值**（平均分數＋評價則數），不等同於開放逐筆評價檢視能力，兩者顆粒度不同。同時補充 Teacher 欄位：Teacher 本來就看得到自己所有課程的完整評價（既有 `Own`），這輪只是把同一批已經允許看到的資料多做一個彙整摘要顯示在 `/teacher/profile`，不是新增可見範圍。
3. `docs/product/route-map.md`：`/teacher/profile` 與 `/admin/teachers` 現有描述文字仍然準確涵蓋這個新增的顯示內容，不需要修改（比照 `teacher-availability-edit` 一輪「路由描述已涵蓋、不必改字」的判斷方式）。

## 4. 實作切片（Slice 1–3；施工前提：D1–D7 已拍板）

### Slice 1 — Domain 查詢

- `src/domain/review/read-service.ts`：新增
  ```ts
  export type TeacherRatingSummary = {
    averageRating: number | null;
    reviewCount: number;
  };

  export async function getOwnTeacherRatingSummary(): Promise<TeacherRatingSummary | null> {
    const currentUser = await requireUser();

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!teacherProfile) {
      return null;
    }

    const aggregate = await prisma.review.aggregate({
      where: { classSession: { teacherProfileId: teacherProfile.id } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      averageRating: aggregate._avg.rating,
      reviewCount: aggregate._count.rating,
    };
  }

  // D4：共用格式化，Teacher（own）與 Admin 頁面都呼叫這個函式，不各自實作四捨五入／零評價文案。
  // 不可以直接用 averageRating.toFixed(1)——二進位浮點數轉字串不保證十進位四捨五入
  // （例如 (81/20).toFixed(1) 在 Node.js 實測是 "4.0" 不是 "4.1"，round 1 codex review 抓到）。
  export function formatTeacherRatingSummary(summary: TeacherRatingSummary): string {
    if (summary.reviewCount === 0 || summary.averageRating === null) {
      return "尚無評價";
    }

    const rounded = Math.round(summary.averageRating * 10) / 10;
    return `${rounded.toFixed(1)} 分（${summary.reviewCount} 則評價）`;
  }
  ```
  （`requireUser()` 沿用檔案裡既有的 import，找不到自己的 `TeacherProfile` 時回傳 `null`，呼叫端據此判斷不顯示區塊。）
- `src/domain/teacher-profile/service.ts`：
  - `ApprovedOrSuspendedTeacherProfileForAdmin` 型別（`:793-814`）新增 `averageRating: number | null` 與 `reviewCount: number` 兩個欄位。
  - `listApprovedAndSuspendedTeacherProfilesForAdmin()`（`:819-848`）**不**在 `select` 加巢狀 `classSessions.reviews`（會把逐筆評價全部撈進應用層，見 D3 修正說明）。改成：先照既有 `select` 查出老師清單；若清單非空，再對這批老師的 `id` 發一個 `prisma.$queryRaw`（用法比照 `src/domain/class-session/__internal__/cancel-class-session-core.ts:100-119` 的 `Prisma.sql` tagged template 既有寫法），在資料庫端用 `JOIN`＋`GROUP BY` 把 `Review` 經 `ClassSession.teacherProfileId` 聚合成每位老師一列的 `(teacherProfileId, averageRating, reviewCount)`：
    ```ts
    import { Prisma } from "@prisma/client";

    const ratingRows =
      teachers.length === 0
        ? []
        : await prisma.$queryRaw<
            { teacherProfileId: string; averageRating: number | null; reviewCount: bigint }[]
          >(Prisma.sql`
            SELECT cs."teacherProfileId" AS "teacherProfileId",
                   AVG(r.rating)::float AS "averageRating",
                   COUNT(r.rating) AS "reviewCount"
            FROM "Review" r
            JOIN "ClassSession" cs ON cs.id = r."classSessionId"
            WHERE cs."teacherProfileId" IN (${Prisma.join(teachers.map((teacher) => teacher.id))})
            GROUP BY cs."teacherProfileId"
          `);

    const ratingByTeacherProfileId = new Map(
      ratingRows.map((row) => [
        row.teacherProfileId,
        { averageRating: row.averageRating, reviewCount: Number(row.reviewCount) },
      ]),
    );

    return teachers.map((teacher) => ({
      ...teacher,
      averageRating: ratingByTeacherProfileId.get(teacher.id)?.averageRating ?? null,
      reviewCount: ratingByTeacherProfileId.get(teacher.id)?.reviewCount ?? 0,
    }));
    ```
    找不到對應列（`ratingByTeacherProfileId` 沒有這個老師的 key）代表這位老師完全沒有評價，預設 `{ averageRating: null, reviewCount: 0 }`。`COUNT()` 在 PostgreSQL 回傳 `bigint`，node-postgres 會轉成 JS `BigInt`，必須用 `Number()` 轉型後才能跟其他地方的 `number` 型別一致（否則會是 `bigint` 型別，JSON 序列化與既有型別定義都會出問題）。
- **驗證**：throwaway `tsx` script 直接對本機 dev DB 驗證兩種查詢語法本身正確：
  1. 建立一位有 2 堂 `completed` class session、分別有評價（例如 5 分與 3 分）的老師，呼叫等價的 `aggregate` 查詢確認平均是 4、則數是 2。
  2. 建立一位完全沒有評價的老師，確認 `_avg.rating` 為 `null`、`_count.rating` 為 0。
  3. 建立至少兩位老師（其中一位有多筆評價、平均值不是整數，例如總分 81 分共 20 則評價），驗證上方 `$queryRaw` 的 `GROUP BY` 查詢語法可以正確執行，回傳的每一列數字跟手動計算一致，且沒有評價的老師完全不會出現在 `ratingRows` 裡（驗證「找不到 key → 預設 0」這個分支邏輯正確）。
  4. 額外驗證 `formatTeacherRatingSummary()` 對 `81/20 = 4.05` 這個邊界值輸出 `"4.1 分（20 則評價）"`（不是 `"4.0 分"`），確認 D4 的四捨五入修正確實生效。
  完成後清空所有測試用資料（老師、老師的 class session、review）。

### Slice 2 — UI

- `src/app/teacher/profile/page.tsx`：
  - 在 `isApproved`（或 `suspended`）分支成立時，額外呼叫 `getOwnTeacherRatingSummary()`（跟既有的 `getOwnTeacherProfileApplicationSnapshot()` 一起用 `Promise.all` 平行查詢，只在確認 `profile.status` 是 approved/suspended 後才呼叫——因為在同一次 request 裡已經知道狀態，可以用一個 if 包住，不需要在不必要的狀態下發出這個查詢）。
  - approved 與 suspended 兩個分支各自的區塊頂端（表單／唯讀區塊之前）加一個小的唯讀方塊，顯示「平均評分：{`formatTeacherRatingSummary(ratingSummary)`}」（從 `src/domain/review/read-service.ts` import，不在頁面重新實作格式化邏輯）。
- `src/app/admin/teachers/page.tsx`：
  - Approved 與 Suspended 兩個 `.map()` 迴圈裡，`Last updated: {formatDateTime(teacher.updatedAt)}` 那一行下面各自加一行，顯示 `formatTeacherRatingSummary({ averageRating: teacher.averageRating, reviewCount: teacher.reviewCount })`（同一個 Slice 1 的共用 helper，沿用 `teacher.averageRating`／`teacher.reviewCount`，因為 Slice 1 已經讓 `listApprovedAndSuspendedTeacherProfilesForAdmin()` 直接回傳這兩個欄位，不需要頁面自己計算平均值）。
- **驗證**：瀏覽器實際操作（用 throwaway seed script 建立測試資料，操作完畢後清空）——
  1. 一位有評價的 approved 老師：`/teacher/profile` 與 `/admin/teachers` 都顯示正確的平均分數與則數，兩處數字一致。
  2. 一位完全沒有評價的 approved 老師：兩處都顯示「尚無評價」，不是「0.0 分」。
  3. 一位有評價的 suspended 老師：`/teacher/profile` 唯讀分支與 `/admin/teachers` 的 Suspended 卡片都正確顯示。
  4. draft／submitted／rejected 狀態的老師：`/teacher/profile` 不顯示評分區塊（也不應該因為這個新查詢而報錯或整頁壞掉）。
  5. `resize_window` 確認新增的文字在既有版型下沒有造成 360px/390px 水平溢出（比照既有 RWD 驗證慣例）。

### Slice 3 — Tests + Docs 對齊

- `tests/smoke/review-average-rating-display.spec.ts`（新檔案）：
  - **`getOwnTeacherRatingSummary()` 不安排 Node context 直接呼叫測試**：這個函式內部呼叫 `requireUser()`，而 `requireUser()` 依賴 NextAuth 的 `auth()` 解析真實 HTTP request 的 session cookie，在 Playwright 測試檔案的 Node context 裡直接 `import` 並呼叫會因為沒有 request context 而丟出例外（跟這一輪稍早 `organizer-profile-edit` 的既有先例完全一致——`updateOwnOrganizerProfile()` 同樣因為依賴 `requireUser()`，plan 明確寫「驗證延到 Slice 2 的瀏覽器操作」，不是直接呼叫）。這個函式的正確性完全交給下面的瀏覽器端 UI 測試涵蓋，不重複安排一組會直接失敗的 Node 呼叫測試。
  - `formatTeacherRatingSummary()` 直接呼叫（no UI，純函式沒有 `requireUser()` 依賴，可以安全直接測試）：確認零評價回傳「尚無評價」；確認 `{ averageRating: 4.05, reviewCount: 20 }` 這個邊界值輸出 `"4.1 分（20 則評價）"`（不是 `"4.0 分"`，見 D4 的 rounding 修正）；確認一般整數平均（例如 4 分 2 則）輸出 `"4.0 分（2 則評價）"`。
  - `/teacher/profile` UI：approved 老師建立 2 筆評價（不同分數）後頁面顯示正確平均；沒有評價的老師顯示「尚無評價」；draft／submitted／rejected 狀態的老師頁面正常顯示，不因為這個新查詢報錯。**必須同時建立第二位老師（sentinel）**，給予刻意不同的評分（例如老師 A 平均 4 分、老師 B 全部給 1 分），登入老師 A 後斷言 `/teacher/profile` 顯示的平均沒有被老師 B 的評價污染（round 2 codex review 抓到：`getOwnTeacherRatingSummary()` 的 `where: { classSession: { teacherProfileId } }` relation filter 如果寫錯，Teacher 有可能看到混入其他老師評價的全域平均，若沒有刻意分數不同的第二位老師，這種 bug 不會被任何既有斷言抓到）。
  - `/admin/teachers` UI：同一批老師在 Admin 列表上顯示一致的平均分數與則數，且**必須包含一位有多筆評價的第二位老師（sentinel）**，確認第一位老師的平均分數計算沒有被第二位老師的評價污染（own-scope／資料隔離回歸測試，比照這一輪 `organizer-profile-edit` sentinel 先例——這裡額外驗證的是 Slice 1 `$queryRaw` 的 `GROUP BY` 沒有把兩位老師的評價混在一起算成同一個平均值）。
  - suspended 老師：`/teacher/profile` 與 `/admin/teachers` 都正確顯示既有評價的彙整值。
- 更新 `docs/domain/data-model.md`、`docs/domain/permissions-matrix.md`（見 D7）。
- 最終：`npm run lint` + 乾淨的 `npm run build`（先確認 port 3000 沒有殘留 process）+ 全套 `npm run test:smoke`。

### Slice 順序

Slice 1 必須先完成（domain 查詢先於 UI）。Slice 3 排最後。

## 5. Verification Planning

- Domain 層（Slice 1）：throwaway script 對本機 dev DB 直接驗證兩種查詢寫法的計算結果正確，含零評價邊界。
- UI 層（Slice 2）：瀏覽器手動驅動 + 對照 DB 實際資料，涵蓋有評價／零評價／approved／suspended／非 approved-or-suspended 五種情境，以及 RWD。
- 測試層（Slice 3）：Playwright smoke test，涵蓋 `formatTeacherRatingSummary()` 純函式的直接呼叫（含 rounding 邊界值）、UI 顯示正確性、零評價文案、以及 Admin 列表下的多老師資料隔離（sentinel，驗證 `$queryRaw` 的 `GROUP BY` 沒有跨老師混算）。`getOwnTeacherRatingSummary()` 因依賴 `requireUser()`，正確性完全透過 UI 測試涵蓋，不安排 Node context 直接呼叫。

<!-- codex-peer-reviewed: 2026-07-30T21:02:37Z rounds=3 verdict=approved -->
