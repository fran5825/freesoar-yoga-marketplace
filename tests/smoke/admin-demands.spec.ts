import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

const testEmailDomain = "admin-demands-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

test.describe("/admin/demands smoke", () => {
  test("searches contact details, separates lifecycle categories, and preserves context after publishing", async ({ context, page }, testInfo) => {
    const runId = normalizeForEmail(`${testInfo.project.name}-search-${Date.now()}`);
    const organizerEmail = `organizer-search-${runId}@${testEmailDomain}`;
    const adminEmail = `admin-search-${runId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail);
    const contact = `contact-${runId}@example.com`;
    const organizer = await createOrganizerProfileWithOrganization({ email: organizerEmail, displayName: `團主 ${runId}`, organizationName: `團體 ${runId}`, contactName: `聯絡 ${runId}`, contactEmail: contact });
    const title = `春日需求 ${runId}`;
    for (const [status, label] of [["submitted", title], ["published", `公開 ${runId}`], ["matched", `媒合 ${runId}`], ["converted_to_class", `建課 ${runId}`], ["cancelled", `取消 ${runId}`], ["draft", `草稿 ${runId}`]] as const) {
      await createDemandRequest({ organizerProfileId: organizer.organizerProfileId, organizationId: organizer.organizationId, status, data: completeDemandRequestData({ title: label }) });
    }
    await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);
    await page.goto("/admin/demands");
    await page.getByRole("searchbox", { name: "搜尋需求" }).fill(contact);
    await page.getByRole("searchbox").press("Enter");
    await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
    for (const label of ["已公開・1", "已媒合・1", "已建課・1", "已取消・1", "全部・5"]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("searchbox")).toHaveValue(contact);
    }
    await expect(page.getByRole("heading", { name: `草稿 ${runId}`, exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "待審・1", exact: true }).click();
    await expect(page.getByRole("link", { name: "待審・1", exact: true })).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-demands.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).click();
    await page.getByRole("button", { name: "公開需求", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/demands" && url.searchParams.get("q") === contact && url.searchParams.get("result") === "success");
    await expect(page.getByText("搜尋結果：0 筆", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `查看 ${title}`, exact: true }).click();
    await page.getByRole("link", { name: "← 回需求列表" }).click();
    await expect(page.getByRole("searchbox")).toHaveValue(contact);
    for (const keyword of [title, `團體 ${runId}`, `團主 ${runId}`, `聯絡 ${runId}`]) {
      await page.goto(`/admin/demands?status=all&q=${encodeURIComponent(keyword)}`);
      await expect(page.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
    }
    await page.getByRole("searchbox").fill(`missing-${runId}`);
    await page.getByRole("button", { name: "搜尋", exact: true }).click();
    await expect(page.getByText("搜尋結果：0 筆", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "清除全部條件", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/demands$/);
  });
  test("blocks non-admin sessions from the review route", async ({
    context,
    page,
  }, testInfo) => {
    const email = `non-admin-${normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    )}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({
      email,
      isAdmin: false,
    });
    await addAuthSessionCookie(context, sessionToken);

    const response = await page.goto("/admin/demands");
    expect(response?.status()).toBe(404);
  });

  test("shows admin enough detail to review before deciding (not just a title)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-review-detail-${Date.now()}`,
    );
    const organizerEmail = `review-detail-organizer-${testRunId}@${testEmailDomain}`;
    const adminEmail = `review-detail-admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail);

    const organizerDisplayName = `Review Detail Organizer ${testRunId}`;
    const distinctiveContactEmail = `distinctive-contact-${testRunId}@example.com`;
    const distinctiveDescription = `這是需要具體審核的需求說明內容 ${testRunId}，內容夠長也夠獨特。`;

    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: organizerDisplayName,
        organizationName: `Review Detail Org ${testRunId}`,
        contactName: "聯絡人",
        contactEmail: distinctiveContactEmail,
        contactPhone: "0900000000",
      });

    const reviewDemand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "submitted",
      data: completeDemandRequestData({
        title: `Review Detail Demand ${testRunId}`,
        description: distinctiveDescription,
      }),
    });

    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSessionToken);

    // 列表只放摘要，點進詳情頁才有完整內容。
    await page.goto("/admin/demands");
    await page.getByRole("link").filter({ hasText: `Review Detail Demand ${testRunId}` }).first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/demands/${reviewDemand.id}$`));

    // 防 title-only 回歸：admin 必須在做決定前就看得到完整需求說明、
    // organization contact email、以及 organizer displayName。
    await expect(page.getByText(distinctiveDescription)).toBeVisible();
    await expect(page.getByText(distinctiveContactEmail)).toBeVisible();
    await expect(page.getByText(organizerDisplayName)).toBeVisible();
  });

  test("demand detail page: 404 for non-admin, drafts and unknown ids; processed demands show results only; filter tabs split by status", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-detail-tabs-${Date.now()}`,
    );
    const organizerEmail = `detail-organizer-${testRunId}@${testEmailDomain}`;
    const adminEmail = `detail-admin-${testRunId}@${testEmailDomain}`;
    const plainEmail = `detail-plain-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail, plainEmail);

    const { organizerProfileId, organizationId } = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Detail Organizer ${testRunId}`,
      organizationName: `Detail Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `detail-contact-${testRunId}@example.com`,
      contactPhone: "0900000000",
    });
    const make = (status: "draft" | "submitted" | "published" | "rejected", label: string) =>
      createDemandRequest({
        organizerProfileId,
        organizationId,
        status,
        data: completeDemandRequestData({
          title: `Detail ${label} ${testRunId}`,
          ...(status === "rejected" ? { rejectionReason: "需求說明過於簡略，請補充後重新送審。" } : {}),
        }),
      });
    const draft = await make("draft", "Draft");
    const published = await make("published", "Published");
    const rejected = await make("rejected", "Rejected");

    const { sessionToken: plainToken } = await createUserSession({ email: plainEmail, isAdmin: false });
    await addAuthSessionCookie(context, plainToken);
    const forbidden = await page.goto(`/admin/demands/${rejected.id}`);
    expect(forbidden?.status()).toBe(404);

    await context.clearCookies();
    const { sessionToken: adminToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, adminToken);

    // 草稿是團主私人資料、不存在的 id：都是 404。
    expect((await page.goto(`/admin/demands/${draft.id}`))?.status()).toBe(404);
    expect((await page.goto("/admin/demands/does-not-exist"))?.status()).toBe(404);

    // 已退回：只顯示結果與原因，沒有審核按鈕。
    await page.goto(`/admin/demands/${rejected.id}`);
    await expect(page.getByRole("heading", { name: "這筆需求已退回" })).toBeVisible();
    await expect(page.getByText("退回原因：需求說明過於簡略，請補充後重新送審。")).toBeVisible();
    // 票 06：需求退回是終局，結果一律說明另建需求。
    await expect(page.getByText(/團主需要另建一筆需求送審，原需求不能修改後重新送出/)).toBeVisible();
    await expect(page.getByText("團主修改後可以重新送審。")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "公開需求" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "退回需求" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "前往審核操作" })).toHaveCount(0);

    // 已公開：已處理，沒有審核按鈕。
    await page.goto(`/admin/demands/${published.id}`);
    await expect(page.getByRole("heading", { name: "這筆需求已處理" })).toBeVisible();
    await expect(page.getByRole("button", { name: "公開需求" })).toHaveCount(0);

    // 無原因的舊退回資料也要有另建需求的 fallback。
    const rejectedWithoutReason = await make("rejected", "NoReason");
    await prisma.demandRequest.update({ where: { id: rejectedWithoutReason.id }, data: { rejectionReason: null } });
    await page.goto(`/admin/demands/${rejectedWithoutReason.id}`);
    await expect(page.getByText(/團主需要另建一筆需求送審/)).toBeVisible();
    await expect(page.getByText(/退回原因：/)).toHaveCount(0);

    // 篩選分頁：預設「待審」看不到已公開／已退回；草稿在任何分頁都看不到。
    await page.goto("/admin/demands");
    await expect(page.getByText(`Detail Published ${testRunId}`)).toBeHidden();
    await page.goto("/admin/demands?status=published");
    await expect(page.getByText(`Detail Published ${testRunId}`)).toBeVisible();
    await page.goto("/admin/demands?status=rejected");
    await expect(page.getByText(`Detail Rejected ${testRunId}`)).toBeVisible();
    await page.goto("/admin/demands?status=all");
    await expect(page.getByText(`Detail Published ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Detail Draft ${testRunId}`)).toBeHidden();
  });

  test("lets admin publish a submitted demand, visible afterwards to the organizer", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-publish-${Date.now()}`,
    );
    const organizerEmail = `publish-organizer-${testRunId}@${testEmailDomain}`;
    const adminEmail = `publish-admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail);

    const { organizerProfileId, organizationId, sessionToken: organizerSessionToken } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Publish Organizer ${testRunId}`,
        organizationName: `Publish Org ${testRunId}`,
        contactName: "聯絡人",
        contactEmail: `publish-contact-${testRunId}@example.com`,
        contactPhone: "0900000000",
      });

    const demandTitle = `Publish Target ${testRunId}`;
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: demandTitle }),
    });

    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto(`/admin/demands/${demand.id}`);
    await expect(page.getByRole("heading", { level: 1, name: demandTitle })).toBeVisible();

    await page.getByRole("button", { name: "公開需求" }).click();

    // 審核完回到列表（停在待審）並顯示成功提示，這筆需求已離開待審。
    await expect(page).toHaveURL(/\/admin\/demands\?result=success/);
    await expect(page.getByText("需求已公開。")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: demandTitle, exact: true })).toHaveCount(0);

    const publishedDemand = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(publishedDemand.status).toBe("published");

    await context.clearCookies();
    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);
    await expect(page.getByText("已公開")).toBeVisible();
  });

  test("keeps the typed reason and disables review when the demand was handled or deleted meanwhile", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-stale-${Date.now()}`,
    );
    const organizerEmail = `stale-organizer-${testRunId}@${testEmailDomain}`;
    const adminEmail = `stale-admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail);
    const { organizerProfileId, organizationId } = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Stale Organizer ${testRunId}`,
      organizationName: `Stale Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `stale.contact.${"x".repeat(50)}-${testRunId}@example.com`,
      contactPhone: "0900000000",
    });
    const handled = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: `Stale Handled ${testRunId}` }),
    });
    const deleted = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: `Stale Deleted ${testRunId}` }),
    });
    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    // 從搜尋後的列表進入，摘要與跳轉連結在頁首。
    await page.goto(`/admin/demands?q=${encodeURIComponent(testRunId)}`);
    await page.getByRole("link").filter({ hasText: `Stale Handled ${testRunId}` }).first().click();
    await expect(page.getByRole("button", { name: "公開需求" })).toBeEnabled();
    await expect(page.getByText(new RegExp(`Stale Org ${testRunId}・預期`))).toBeVisible();
    await page.getByRole("link", { name: "前往審核操作" }).click();
    await expect(page).toHaveURL(/#demand-actions$/);

    // 已被別人公開：退回失敗，原因保留、審核停用，可重新載入看目前狀態。
    const reason = "請另建一筆需求，補充上課對象、人數與希望呈現的課程樣貌後送審。";
    await page.getByRole("button", { name: "退回需求" }).click();
    await page.getByLabel("退回原因").fill(reason);
    await prisma.demandRequest.update({ where: { id: handled.id }, data: { status: "published" } });
    await page.getByRole("button", { name: "送出退回" }).click();
    const stale = page.getByRole("alert").filter({ hasText: "這頁的審核操作已停用" });
    await expect(stale).toContainText("這筆需求已不是待審狀態");
    await expect(page.getByLabel("退回原因")).toHaveValue(reason);
    await expect(page.getByRole("button", { name: "送出退回" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "公開需求" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-demand-review-stale.png`, fullPage: true });
    await page.getByRole("link", { name: "重新載入，查看目前狀態" }).click();
    await expect(page.getByRole("heading", { name: "這筆需求已處理" })).toBeVisible();
    expect((await prisma.demandRequest.findUniqueOrThrow({ where: { id: handled.id }, select: { status: true } })).status).toBe("published");

    // 已被刪除：顯示找不到並提供回到原搜尋的列表，不落入 404。
    await page.goto(`/admin/demands?q=${encodeURIComponent(testRunId)}`);
    await page.getByRole("link").filter({ hasText: `Stale Deleted ${testRunId}` }).first().click();
    await expect(page.getByRole("button", { name: "公開需求" })).toBeEnabled();
    await prisma.demandRequest.delete({ where: { id: deleted.id } });
    await page.getByRole("button", { name: "公開需求" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "找不到這筆需求" })).toBeVisible();
    await page.getByRole("link", { name: "回需求列表", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/demands" && url.searchParams.get("q") === testRunId);
  });

  test("lets admin reject a submitted demand with a required reason and confirmation, visible afterwards to the organizer", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-reject-${Date.now()}`,
    );
    const organizerEmail = `reject-organizer-${testRunId}@${testEmailDomain}`;
    const adminEmail = `reject-admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail);

    const { organizerProfileId, organizationId, sessionToken: organizerSessionToken } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Reject Organizer ${testRunId}`,
        organizationName: `Reject Org ${testRunId}`,
        contactName: "聯絡人",
        contactEmail: `reject-contact-${testRunId}@example.com`,
        contactPhone: "0900000000",
      });

    const demandTitle = `Reject Target ${testRunId}`;
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: demandTitle }),
    });

    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto(`/admin/demands/${demand.id}`);

    // 票 06：退回先展開才有原因欄；原因必填，空白時 native required 擋下，仍停在詳情頁。
    await expect(page.getByLabel("退回原因")).toHaveCount(0);
    await page.getByRole("button", { name: "退回需求" }).click();
    await expect(page.getByLabel("退回原因")).toBeFocused();
    await page.getByRole("button", { name: "送出退回" }).click();
    await expect(page.getByRole("heading", { level: 1, name: demandTitle })).toBeVisible();

    // 範本逐字使用規格第 9 節，三句都說明另建需求。
    const reasonField = page.getByLabel("退回原因");
    for (const [label, text] of [
      ["說明不足", "請另建一筆需求，補充上課對象、人數與希望呈現的課程樣貌後送審，讓老師更容易評估。"],
      ["安排不明", "請另建一筆需求，說明可配合的時段、地點與預算範圍後送審，讓老師判斷是否能配合。"],
      ["聯絡資料", "請先確認團體的聯絡人與聯絡方式，再另建一筆需求送審，方便後續聯繫。"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(reasonField).toHaveValue(text);
    }

    // 繞過前端 minlength/required 與 trim 後字數檢查，證明伺服器端仍會權威地擋下過短原因；
    // 失敗留在本頁、保留原因、不進 URL。
    await reasonField.evaluate((el: HTMLTextAreaElement) => {
      el.removeAttribute("required");
      el.removeAttribute("minlength");
      el.removeAttribute("maxlength");
      el.setCustomValidity = () => {};
      HTMLTextAreaElement.prototype.setCustomValidity.call(el, "");
    });
    await reasonField.fill("太短");
    await page.getByRole("button", { name: "送出退回" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "已填的原因仍保留" })).toBeVisible();
    await expect(reasonField).toHaveValue("太短");
    await expect(page.getByRole("heading", { level: 1, name: demandTitle })).toBeVisible();
    expect(page.url()).not.toContain(encodeURIComponent("太短"));

    const stillSubmitted = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(stillSubmitted.status).toBe("submitted");

    // 修正後重試，才能真正退回。
    const reason = `需求說明過於簡略，請補充上課對象與希望呈現的課程樣貌 ${testRunId}。`;
    await page.getByLabel("退回原因").fill(`  ${reason}  `);
    await page.getByRole("button", { name: "送出退回" }).click();

    await expect(page.getByText("需求已退回，退回原因會顯示給團主，團主需另建一筆需求。")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: demandTitle, exact: true })).toHaveCount(0);

    const rejectedDemand = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true, rejectionReason: true },
    });
    expect(rejectedDemand.status).toBe("rejected");
    expect(rejectedDemand.rejectionReason).toBe(reason);

    await context.clearCookies();
    await addAuthSessionCookie(context, organizerSessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);
    await expect(page.getByText("已退回")).toBeVisible();
    await expect(page.getByText("平台的退回說明")).toBeVisible();
    await expect(page.getByText(reason)).toBeVisible();
  });
});
