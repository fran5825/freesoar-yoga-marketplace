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

    await createDemandRequest({
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

    await page.goto("/admin/demands");

    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: `Review Detail Demand ${testRunId}`,
      }),
    });

    // 防 title-only 回歸：admin 必須在做決定前就看得到完整需求說明、
    // organization contact email、以及 organizer displayName。
    await expect(card.getByText(distinctiveDescription)).toBeVisible();
    await expect(card.getByText(distinctiveContactEmail)).toBeVisible();
    await expect(card.getByText(organizerDisplayName)).toBeVisible();
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
    await page.goto("/admin/demands");

    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: demandTitle }),
    });
    await expect(card.getByRole("heading", { name: demandTitle })).toBeVisible();

    await card.getByRole("button", { name: "Publish" }).click();

    await expect(page.getByText("需求已公開。")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: demandTitle }),
    ).toBeHidden();

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
    await page.goto("/admin/demands");

    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: demandTitle }),
    });
    await card.locator("summary").click();

    // 二次確認：空白 reason + 未勾選 confirm，native required 應擋下空白送出。
    await card.getByRole("button", { name: "確認退回" }).click();
    await expect(
      card.getByRole("heading", { name: demandTitle }),
    ).toBeVisible();

    // 繞過前端 minlength/required，證明伺服器端仍會權威地擋下過短原因。
    const reasonField = card.getByLabel("退回原因");
    await reasonField.evaluate((el: HTMLTextAreaElement) => {
      el.removeAttribute("required");
      el.removeAttribute("minlength");
      el.removeAttribute("maxlength");
    });
    await reasonField.fill("太短");
    await card.getByRole("checkbox").check();
    await card.getByRole("button", { name: "確認退回" }).click();
    await expect(
      card.getByRole("heading", { name: demandTitle }),
    ).toBeVisible();

    const stillSubmitted = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(stillSubmitted.status).toBe("submitted");

    // 正常填寫合法長度的 reason 且勾選確認，才能真正退回。
    const reason = `需求說明過於簡略，請補充上課對象與希望呈現的課程樣貌 ${testRunId}。`;
    await reasonField.fill(`  ${reason}  `);
    await card.getByRole("button", { name: "確認退回" }).click();

    await expect(page.getByText("需求已退回。")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: demandTitle }),
    ).toBeHidden();

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
