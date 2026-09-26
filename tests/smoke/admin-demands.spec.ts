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
    await expect(page.getByRole("button", { name: "公開需求" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "退回需求" })).toHaveCount(0);

    // 已公開：已處理，沒有審核按鈕。
    await page.goto(`/admin/demands/${published.id}`);
    await expect(page.getByRole("heading", { name: "這筆需求已處理" })).toBeVisible();
    await expect(page.getByRole("button", { name: "公開需求" })).toHaveCount(0);

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
    await expect(page.getByRole("link", { name: new RegExp(demandTitle) })).toHaveCount(0);

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

    // 原因必填：空白時 native required 擋下，仍停在詳情頁。
    await page.getByRole("button", { name: "退回需求" }).click();
    await expect(page.getByRole("heading", { level: 1, name: demandTitle })).toBeVisible();

    // 繞過前端 minlength/required，證明伺服器端仍會權威地擋下過短原因。
    const reasonField = page.getByLabel("退回原因");
    await reasonField.evaluate((el: HTMLTextAreaElement) => {
      el.removeAttribute("required");
      el.removeAttribute("minlength");
      el.removeAttribute("maxlength");
    });
    await reasonField.fill("太短");
    await page.getByRole("button", { name: "退回需求" }).click();

    // 失敗時留在這筆需求的詳情頁並顯示原因。
    await expect(page).toHaveURL(new RegExp(`/admin/demands/${demand.id}\\?result=error`));
    await expect(page.getByRole("heading", { level: 1, name: demandTitle })).toBeVisible();

    const stillSubmitted = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(stillSubmitted.status).toBe("submitted");

    // 正常填寫合法長度的 reason，才能真正退回。
    const reason = `需求說明過於簡略，請補充上課對象與希望呈現的課程樣貌 ${testRunId}。`;
    await page.getByLabel("退回原因").fill(`  ${reason}  `);
    await page.getByRole("button", { name: "退回需求" }).click();

    await expect(page.getByText("需求已退回，退回原因會顯示給團主。")).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(demandTitle) })).toHaveCount(0);

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
