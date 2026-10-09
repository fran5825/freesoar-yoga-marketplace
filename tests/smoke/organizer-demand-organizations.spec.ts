import { chromium, expect, test, type Page } from "@playwright/test";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 04：需求表單選團體、草稿穩定網址、補資料返回、離開保護。
const testEmailDomain = "organizer-demand-orgs-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

async function createOrganizerWithTwoOrganizations(id: string) {
  const email = `two-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  const organizer = await createOrganizerProfileWithOrganization({
    email,
    displayName: `Organizer ${id}`,
    organizationName: `Alpha Org ${id}`,
    contactName: "Alpha 聯絡人",
    contactEmail: `alpha-${id}@example.com`,
    contactPhone: "0900000001",
  });
  const second = await prisma.organization.create({
    data: {
      name: `Beta Org ${id}`,
      type: "community",
      contactName: "Beta 聯絡人",
      contactEmail: `beta-${id}@example.com`,
      contactPhone: "0900000002",
      ownerOrganizerProfileId: organizer.organizerProfileId,
    },
    select: { id: true },
  });
  return { ...organizer, email, secondOrganizationId: second.id };
}

async function fillCompleteDemand(page: Page, title: string) {
  await page.getByLabel("需求標題").fill(title);
  await page.getByText("伸展與身體保養", { exact: true }).click();
  await page
    // 「特定對象與主題」的說明文字也提到「需求說明」，所以指定文字輸入框。
    .getByRole("textbox", { name: /^需求說明/ })
    .fill("希望帶領辦公室同仁在下班前放鬆身心，適合久坐族群，希望老師著重呼吸與伸展。");
  await page.getByLabel("適合對象").selectOption("general");
  await page.getByLabel("預計參與人數").fill("15");
  await page.getByLabel("期望地點").fill("台北市信義區");
  await page.getByText("平日晚上", { exact: true }).click();
  await page.getByLabel("單堂課程長度（分鐘）").fill("60");
  await page.getByLabel("上課頻率").selectOption("weekly");
}

test.describe("organizer demand organizations smoke", () => {
  test("chooses a second organization, keeps one stable draft URL, and can switch organizations while still a draft", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "choose");
    const organizer = await createOrganizerWithTwoOrganizations(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands/new");
    const organizationSelect = page.getByLabel("為哪個團體提出需求");
    // owner-only fixture 的預設團體是本人最早建立的團體。
    await expect(organizationSelect).toHaveValue(organizer.organizationId);
    await organizationSelect.selectOption(organizer.secondOrganizationId);
    await page.getByLabel("需求標題").fill(`Beta 的需求 ${id}`);
    await page.getByRole("button", { name: "儲存草稿" }).first().click();

    // 第一次儲存後網址換成這筆草稿的編輯頁。
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/]+\/edit$/);
    const draftId = page.url().match(/\/organizer\/demands\/([^/]+)\/edit$/)?.[1];
    expect(draftId).toBeTruthy();

    const saved = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: draftId! },
      select: { organizationId: true, title: true },
    });
    expect(saved).toEqual({ organizationId: organizer.secondOrganizationId, title: `Beta 的需求 ${id}` });

    // 重新整理後仍是同一筆、同一個團體。
    await page.reload();
    await expect(page.getByLabel("為哪個團體提出需求")).toHaveValue(organizer.secondOrganizationId);

    // 草稿可以換回第一個團體；再存一次不會多出新的需求。
    await page.getByLabel("為哪個團體提出需求").selectOption(organizer.organizationId);
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();

    const [after, count] = await Promise.all([
      prisma.demandRequest.findUniqueOrThrow({ where: { id: draftId! }, select: { organizationId: true } }),
      prisma.demandRequest.count({ where: { organizerProfileId: organizer.organizerProfileId } }),
    ]);
    expect(after.organizationId).toBe(organizer.organizationId);
    expect(count).toBe(1);
  });

  test("rejects a forged organization id and never lets a submitted demand change organization", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "forge");
    const organizer = await createOrganizerWithTwoOrganizations(id);
    const otherEmail = `other-${id}@${testEmailDomain}`;
    createdEmails.push(otherEmail);
    const other = await createOrganizerProfileWithOrganization({
      email: otherEmail,
      displayName: `Other ${id}`,
      organizationName: `Other Org ${id}`,
    });
    const draft = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      data: { title: `草稿 ${id}` },
    });
    const submitted = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: `已送出 ${id}` }),
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    // 在合法的編輯表單裡塞入別人的團體 id。
    await page.goto(`/organizer/demands/${draft.id}/edit`);
    await page.getByLabel("為哪個團體提出需求").evaluate((select: HTMLSelectElement, forgedId: string) => {
      const option = document.createElement("option");
      option.value = forgedId;
      option.textContent = "偽造的團體";
      select.appendChild(option);
    }, other.organizationId);
    await page.getByLabel("為哪個團體提出需求").selectOption(other.organizationId);
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("找不到這個團體，或你沒有權限使用，請重新選擇團體。").first()).toBeVisible();

    const draftAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: draft.id },
      select: { organizationId: true },
    });
    expect(draftAfter.organizationId).toBe(organizer.organizationId);

    // 已送出的需求沒有可編輯的表單：編輯網址導回詳情，團體不變。
    await page.goto(`/organizer/demands/${submitted.id}/edit`);
    await expect(page).toHaveURL(new RegExp(`/organizer/demands/${submitted.id}$`));
    const submittedAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: submitted.id },
      select: { organizationId: true, status: true },
    });
    expect(submittedAfter).toEqual({ organizationId: organizer.organizationId, status: "submitted" });
  });

  test("adds a new organization from the demand form and comes back to the same draft with it selected", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "add-org");
    const email = `add-org-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${id}`,
      organizationName: `First Org ${id}`,
      contactName: "聯絡人",
      contactEmail: `first-${id}@example.com`,
      contactPhone: "0900000000",
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands/new");
    await page.getByLabel("需求標題").fill(`新團體的需求 ${id}`);
    await page.getByRole("button", { name: "儲存草稿並新增其他團體" }).click();

    await expect(page).toHaveURL(/\/organizer\/organizations\/new\?returnTo=/);
    await page.getByLabel("組織名稱").fill(`Added Org ${id}`);
    await page.getByLabel("組織類型").selectOption("company_club");
    await page.getByRole("button", { name: "儲存並回到剛剛的頁面" }).click();

    // 一次性的 ?organizationId= 在頁面顯示後會從網址清掉，預選結果以下拉選單為準。
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/?]+\/edit(\?organizationId=[^&]+)?$/);
    await expect(page.getByLabel("需求標題")).toHaveValue(`新團體的需求 ${id}`);
    const added = await prisma.organization.findFirstOrThrow({
      where: { name: `Added Org ${id}` },
      select: { id: true },
    });
    await expect(page.getByLabel("為哪個團體提出需求")).toHaveValue(added.id);
    // 新團體聯絡資料還不完整，表單提示補齊。
    await expect(page.getByRole("button", { name: "儲存草稿並補齊聯絡資料" })).toBeVisible();

    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();
    const demands = await prisma.demandRequest.findMany({
      where: { organizerProfileId: organizer.organizerProfileId },
      select: { organizationId: true },
    });
    expect(demands).toEqual([{ organizationId: added.id }]);

    // 改回第一個團體並儲存：網址上過期的 ?organizationId= 被清掉，重新整理仍是剛存的團體。
    await page.getByLabel("為哪個團體提出需求").selectOption(organizer.organizationId);
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/?]+\/edit$/);
    await page.reload();
    await expect(page.getByLabel("為哪個團體提出需求")).toHaveValue(organizer.organizationId);
  });

  test("going back from the contact-info page returns to the same draft, not a blank new form", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "back");
    const email = `back-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${id}`,
      organizationName: `Back Org ${id}`,
      contactName: "聯絡人",
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands/new");
    await page.getByLabel("需求標題").fill(`回上一頁的需求 ${id}`);
    await page.getByRole("button", { name: "儲存草稿並補齊聯絡資料" }).click();
    await expect(page).toHaveURL(/\/organizer\/organizations\/[^/?]+\?returnTo=/);

    await page.goBack();
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/?]+\/edit$/);
    await expect(page.getByLabel("需求標題")).toHaveValue(`回上一頁的需求 ${id}`);
    // 回來後可以繼續編輯與存檔。
    await expect(page.getByLabel("需求標題")).toBeEnabled();
    await expect(page.getByRole("button", { name: "儲存草稿", exact: true }).first()).toBeEnabled();
    const count = await prisma.demandRequest.count({
      where: { organizerProfileId: organizer.organizerProfileId },
    });
    expect(count).toBe(1);
  });

  test("going back with the back-forward cache enabled still leaves an editable draft", async ({}, testInfo) => {
    const id = runId(testInfo, "bfcache");
    const email = `bfcache-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${id}`,
      organizationName: `Cache Org ${id}`,
      contactName: "聯絡人",
    });

    // Playwright 的 Chromium 預設帶 --disable-back-forward-cache；這個測試自己開一個打開快取的瀏覽器。
    const browser = await chromium.launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] });
    try {
      const context = await browser.newContext({
        baseURL: testInfo.project.use.baseURL,
        viewport: testInfo.project.use.viewport ?? undefined,
      });
      await context.addInitScript(() => {
        window.addEventListener("pageshow", (event) => {
          if (event.persisted) {
            (window as unknown as { __restoredFromCache?: boolean }).__restoredFromCache = true;
          }
        });
      });
      await addAuthSessionCookie(context, organizer.sessionToken);
      const page = await context.newPage();

      await page.goto("/organizer/demands/new");
      await page.getByLabel("需求標題").fill(`快取還原的需求 ${id}`);
      await page.getByRole("button", { name: "儲存草稿並補齊聯絡資料" }).click();
      await expect(page).toHaveURL(/\/organizer\/organizations\/[^/?]+\?returnTo=/);

      await page.goBack();
      await expect(page).toHaveURL(/\/organizer\/demands\/[^/?]+\/edit$/);
      const restoredFromCache = await page.evaluate(
        () => (window as unknown as { __restoredFromCache?: boolean }).__restoredFromCache === true,
      );
      const notRestoredReasons = await page.evaluate(() => {
        const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming & {
          notRestoredReasons?: unknown;
        };
        return JSON.stringify(entry?.notRestoredReasons ?? null);
      });
      // 這些頁面回應 Cache-Control: no-store，Chromium 不會放進 back-forward cache（會記錄原因），
      // 按上一頁一律重新載入；會還原的瀏覽器由表單的 pageshow 處理解鎖。兩種情況都必須能繼續編輯。
      testInfo.annotations.push({
        type: "bfcache",
        description: `restored=${restoredFromCache} reasons=${notRestoredReasons}`,
      });
      await expect(page.getByLabel("需求標題")).toHaveValue(`快取還原的需求 ${id}`);
      await expect(page.getByLabel("需求標題")).toBeEnabled();
      await expect(page.getByRole("button", { name: "儲存草稿", exact: true }).first()).toBeEnabled();
    } finally {
      await browser.close();
    }
  });

  test("locks the form while a draft save is in flight so save and submit cannot overlap", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "busy");
    const organizer = await createOrganizerWithTwoOrganizations(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands/new");
    await fillCompleteDemand(page, `等待中的需求 ${id}`);
    await expect(page.getByRole("button", { name: "送出審核" }).first()).toBeEnabled();

    // 讓 server action 晚一點回應，觀察等待中的畫面。
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/organizer/demands/new", async (route) => {
      if (route.request().method() === "POST") {
        await held;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByRole("button", { name: "送出審核" }).first()).toBeDisabled();
    await expect(page.getByLabel("需求標題")).toBeDisabled();
    await expect(page.getByLabel("為哪個團體提出需求")).toBeDisabled();
    release();

    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();
    await page.unroute("**/organizer/demands/new");
    const count = await prisma.demandRequest.count({
      where: { organizerProfileId: organizer.organizerProfileId },
    });
    expect(count).toBe(1);
  });

  test("sends a signed-out visitor to sign-in with a callback to the same draft", async ({ page }, testInfo) => {
    const id = runId(testInfo, "signin");
    const organizer = await createOrganizerWithTwoOrganizations(id);
    const draft = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      data: { title: `登入返回 ${id}` },
    });

    await page.goto(`/organizer/demands/${draft.id}/edit`);
    await expect(page).toHaveURL(
      new RegExp(`/sign-in\\?callbackUrl=${encodeURIComponent(`/organizer/demands/${draft.id}/edit`)}$`),
    );

    // 從新增團體返回時帶的預選也一起保留；其他 query 不帶。
    await page.goto(
      `/organizer/demands/${draft.id}/edit?organizationId=${organizer.secondOrganizationId}&evil=1`,
    );
    const callback = new URL(page.url()).searchParams.get("callbackUrl");
    expect(callback).toBe(
      `/organizer/demands/${draft.id}/edit?organizationId=${organizer.secondOrganizationId}`,
    );
  });

  test("keeps the form locked while the edit page is loading after the first save", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "nav-lock");
    const organizer = await createOrganizerWithTwoOrganizations(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands/new");
    await page.getByLabel("需求標題").fill(`換頁中的需求 ${id}`);

    // 讓編輯頁的載入（RSC 請求）晚一點回應，觀察換頁等待中的畫面。
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/organizer\/demands\/[^/]+\/edit/, async (route) => {
      if (route.request().method() === "GET") {
        await held;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect.poll(() => prisma.demandRequest.count({
      where: { organizerProfileId: organizer.organizerProfileId },
    })).toBe(1);
    await expect(page.getByLabel("需求標題")).toBeDisabled();
    await expect(page.getByRole("button", { name: "送出審核" }).first()).toBeDisabled();
    release();

    await expect(page).toHaveURL(/\/organizer\/demands\/[^/?]+\/edit$/);
    await expect(page.getByLabel("需求標題")).toBeEnabled();
    await expect(page.getByLabel("需求標題")).toHaveValue(`換頁中的需求 ${id}`);
    await page.unroute(/\/organizer\/demands\/[^/]+\/edit/);
  });

  test("warns before leaving with unsaved changes and keeps the typed values when staying", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "leave");
    const organizer = await createOrganizerWithTwoOrganizations(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands/new");
    await page.getByLabel("需求標題").fill(`還沒存的標題 ${id}`);

    const dialogs: string[] = [];
    page.once("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    // 站內連結（導覽列）被攔下來，選擇留下。
    await page.locator('a[href="/organizer/demands"]').first().evaluate((anchor: HTMLAnchorElement) => anchor.click());
    expect(dialogs).toEqual(["還有尚未儲存的修改，確定要離開這一頁嗎？"]);
    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);
    await expect(page.getByLabel("需求標題")).toHaveValue(`還沒存的標題 ${id}`);

    // 儲存後再離開就不會詢問。
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/]+\/edit$/);
    let askedAgain = false;
    page.once("dialog", async (dialog) => {
      askedAgain = true;
      await dialog.dismiss();
    });
    await page.locator('a[href="/organizer/demands"]').first().evaluate((anchor: HTMLAnchorElement) => anchor.click());
    await expect(page).toHaveURL(/\/organizer\/demands$/);
    expect(askedAgain).toBe(false);
  });

  test("keeps every field after a server-side submit rejection, points to missing fields, and lands on the detail page after a successful submit", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "submit");
    const organizer = await createOrganizerWithTwoOrganizations(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands/new");

    // 缺項定位：點摘要裡的欄位名稱，焦點移到該欄位。
    await page.getByRole("button", { name: "需求標題" }).first().click();
    await expect(page.getByLabel("需求標題")).toBeFocused();

    // 送審準備狀態與伺服器規則一致：標題太短時「送出審核」不能按。
    await fillCompleteDemand(page, "短");
    await expect(page.getByRole("button", { name: "送出審核" }).first()).toBeDisabled();
    await page.getByLabel("需求標題").fill(`完整的需求 ${id}`);

    // 頁面載入後團體聯絡資料才被清掉：伺服器在送出時重新檢查並擋下，欄位內容都保留。
    await prisma.organization.update({
      where: { id: organizer.organizationId },
      data: { contactPhone: null },
    });
    await page.getByRole("button", { name: "送出審核" }).first().click();
    // 確認畫面列出團體與時間，讓使用者核對送出後不能更改的歸屬。
    await expect(page.getByText(`Alpha Org ${id}`).first()).toBeVisible();
    await expect(page.getByText("平日晚上").first()).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).first().click();
    // 新需求送出前已先存成草稿：換到這筆的編輯頁並顯示原因，欄位內容都保留。
    await expect(page.getByText(/這個團體的聯絡資料還沒補齊/).first()).toBeVisible();
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/?]+\/edit$/);
    await expect(page.getByLabel("需求標題")).toHaveValue(`完整的需求 ${id}`);
    await expect(page.getByLabel("預計參與人數")).toHaveValue("15");
    await expect(page.getByLabel("期望地點")).toHaveValue("台北市信義區");

    // 補回聯絡資料後送出成功：前往這筆需求的詳情，看到已收到與下一步。
    await prisma.organization.update({
      where: { id: organizer.organizationId },
      data: { contactPhone: "0900000001" },
    });
    await page.reload();
    await page.getByRole("button", { name: "送出審核" }).first().click();
    await page.getByRole("button", { name: "確認送出" }).first().click();
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/]+\?submitted=1$/);
    await expect(page.getByText("需求已收到，待平台審核後才會公開給合適的老師。")).toBeVisible();
    await expect(page.getByRole("region", { name: "下一步提示" })).toBeVisible();

    const demands = await prisma.demandRequest.findMany({
      where: { organizerProfileId: organizer.organizerProfileId },
      select: { status: true, title: true, organizationId: true },
    });
    expect(demands).toEqual([
      { status: "submitted", title: `完整的需求 ${id}`, organizationId: organizer.organizationId },
    ]);
  });
});
