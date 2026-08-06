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

const testEmailDomain = "organizer-demand-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

test.describe("organizer demand smoke", () => {
  test("lets a signed-in user create an organizer profile and organization, then edit the organization's contact info", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-bootstrap-${Date.now()}`,
    );
    const email = `bootstrap-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    const displayName = `Bootstrap Organizer ${testRunId}`;
    const organizationName = `Bootstrap Org ${testRunId}`;

    await page.goto("/organizer/profile");
    await page.getByLabel("團主顯示名稱").fill(displayName);
    await page.getByLabel("組織名稱").fill(organizationName);
    await page.getByLabel("組織類型").selectOption("company");
    await page.getByRole("button", { name: "建立團主資料" }).click();

    await expect(
      page.getByText("團主資料已建立，你可以開始整理需求。"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: displayName }),
    ).toBeVisible();

    const createdProfile = await prisma.organizerProfile.findFirstOrThrow({
      where: { user: { email } },
      select: { displayName: true, organization: { select: { name: true } } },
    });
    expect(createdProfile.displayName).toBe(displayName);
    expect(createdProfile.organization?.name).toBe(organizationName);

    // 已建立團主資料後，重複再送一次建立表單應被擋（此頁面已改為編輯模式，
    // 這裡改以編輯組織資訊表單驗證 own-scoped 更新）。
    await page.getByLabel("聯絡窗口姓名").fill("王小明");
    await page.getByLabel("聯絡信箱").fill(`contact-${testRunId}@example.com`);
    await page.getByLabel("聯絡電話").fill("0912345678");
    await page.getByRole("button", { name: "儲存組織資訊" }).click();

    await expect(page.getByText("組織資訊已更新。")).toBeVisible();

    const updatedOrganization = await prisma.organization.findFirstOrThrow({
      where: { organizerProfiles: { some: { user: { email } } } },
      select: { contactName: true, contactEmail: true, contactPhone: true },
    });
    expect(updatedOrganization).toEqual({
      contactName: "王小明",
      contactEmail: `contact-${testRunId}@example.com`,
      contactPhone: "0912345678",
    });
  });

  test("lets an organizer create a draft, reopen it, and submit; submitted content matches exactly what was filled", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-draft-submit-${Date.now()}`,
    );
    const email = `draft-submit-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, organizerProfileId } =
      await createOrganizerProfileWithOrganization({
        email,
        displayName: `Draft Submit Organizer ${testRunId}`,
        organizationName: `Draft Submit Org ${testRunId}`,
        contactName: "聯絡人",
        contactEmail: `contact-${testRunId}@example.com`,
        contactPhone: "0900000000",
      });
    await addAuthSessionCookie(context, sessionToken);

    const draftTitle = `草稿標題 ${testRunId}`;

    await page.goto("/organizer/demands/new");
    await page.getByLabel("需求標題").fill(draftTitle);
    await page.getByRole("button", { name: "儲存草稿" }).click();
    await expect(page.getByText("草稿已儲存。")).toBeVisible();

    const draft = await prisma.demandRequest.findFirstOrThrow({
      where: { organizerProfileId, status: "draft" },
      select: { id: true },
    });

    await page.goto(`/organizer/demands/${draft.id}/edit`);

    // 續編：重新開啟既有 draft 應該把先前存的欄位值 hydrate 回表單。
    await expect(page.getByLabel("需求標題")).toHaveValue(draftTitle);

    await page.getByLabel("服務類型").selectOption("Hatha Yoga");
    await page
      .getByLabel("需求說明")
      .fill(
        "希望帶領辦公室同仁在下班前放鬆身心，適合久坐族群，希望老師著重呼吸與伸展。",
      );
    await page.getByLabel("適合對象").selectOption("general");
    await page.getByLabel("預計參與人數").fill("15");
    await page.getByLabel("期望地區").fill("台北市信義區");
    await page.getByLabel("平日晚上").check();
    await page.getByLabel("單堂課程長度（分鐘）").fill("60");
    await page.getByLabel("上課頻率").selectOption("weekly");

    await page.getByRole("button", { name: "送出審核" }).click();
    await expect(page.getByText("確認送出需求")).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).click();

    await expect(
      page.getByText("需求已收到，待平台審核後才會公開給合適的老師。"),
    ).toBeVisible();

    const submitted = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: draft.id },
      select: {
        status: true,
        title: true,
        serviceType: true,
        description: true,
        targetLevel: true,
        expectedParticipants: true,
        preferredAreas: true,
        preferredTimeSlots: true,
        classLengthMinutes: true,
        frequency: true,
      },
    });

    // 提交必須原子地一併寫入已驗證的表單值與 status（submit atomicity）。
    expect(submitted).toEqual({
      status: "submitted",
      title: draftTitle,
      serviceType: "Hatha Yoga",
      description:
        "希望帶領辦公室同仁在下班前放鬆身心，適合久坐族群，希望老師著重呼吸與伸展。",
      targetLevel: "general",
      expectedParticipants: 15,
      preferredAreas: ["台北市信義區"],
      preferredTimeSlots: ["平日晚上"],
      classLengthMinutes: 60,
      frequency: "weekly",
    });
  });

  test("blocks submit when the organization's contact info is incomplete", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-contact-incomplete-${Date.now()}`,
    );
    const email = `contact-incomplete-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email,
        displayName: `Contact Incomplete Organizer ${testRunId}`,
        organizationName: `Contact Incomplete Org ${testRunId}`,
        // contactEmail 故意留空，模擬尚未補齊組織聯絡資訊。
        contactName: "聯絡人",
        contactEmail: null,
        contactPhone: "0900000000",
      });
    await addAuthSessionCookie(context, sessionToken);

    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "draft",
      data: completeDemandRequestData({
        title: `完整草稿但組織資訊不全 ${testRunId}`,
      }),
    });

    await page.goto(`/organizer/demands/${demand.id}/edit`);
    await page.getByRole("button", { name: "送出審核" }).click();
    await expect(page.getByText("確認送出需求")).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).click();

    await expect(
      page.getByText(
        "請先至團主資料頁補齊組織聯絡資訊，才能送出需求。",
      ),
    ).toBeVisible();

    const stillDraft = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(stillDraft.status).toBe("draft");
  });

  test("rejects a submit with a controlled-vocabulary value injected outside the UI's own options", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-invalid-vocab-${Date.now()}`,
    );
    const email = `invalid-vocab-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email,
        displayName: `Invalid Vocab Organizer ${testRunId}`,
        organizationName: `Invalid Vocab Org ${testRunId}`,
        contactName: "聯絡人",
        contactEmail: `contact-${testRunId}@example.com`,
        contactPhone: "0900000000",
      });
    await addAuthSessionCookie(context, sessionToken);

    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "draft",
      data: completeDemandRequestData({
        title: `合法草稿待注入非法值 ${testRunId}`,
      }),
    });

    await page.goto(`/organizer/demands/${demand.id}/edit`);

    const serviceTypeSelect = page.getByLabel("服務類型");
    // 先與這個 select 互動一次，確保 React hydration 已完成，
    // 避免下面手動注入的 <option> 在 hydration reconcile 時被清掉。
    await serviceTypeSelect.selectOption("Yin Yoga");
    await serviceTypeSelect.evaluate((select: HTMLSelectElement) => {
      const bogusOption = document.createElement("option");
      bogusOption.value = "Not A Real Service Type";
      bogusOption.textContent = "Not A Real Service Type";
      select.appendChild(bogusOption);
    });
    await serviceTypeSelect.selectOption("Not A Real Service Type");

    await page.getByRole("button", { name: "送出審核" }).click();
    await expect(page.getByText("確認送出需求")).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).click();

    // 前端選單本身不會提供這個值；此處證明伺服器端獨立驗證受控字串，不只是信任 UI。
    await expect(
      page.getByText("服務類型不在允許的選項內。"),
    ).toBeVisible();

    const stillDraft = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true, serviceType: true },
    });
    expect(stillDraft.status).toBe("draft");
    expect(stillDraft.serviceType).toBe("Hatha Yoga");
  });

  test("prevents a stale draft-save in another tab from overwriting an already-submitted demand", async ({
    context,
  }, testInfo) => {
    test.setTimeout(60_000);

    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-stale-draft-${Date.now()}`,
    );
    const email = `stale-draft-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email,
        displayName: `Stale Draft Organizer ${testRunId}`,
        organizationName: `Stale Draft Org ${testRunId}`,
        contactName: "聯絡人",
        contactEmail: `contact-${testRunId}@example.com`,
        contactPhone: "0900000000",
      });
    await addAuthSessionCookie(context, sessionToken);

    const originalTitle = `原始標題 ${testRunId}`;
    const submittedTitle = `已送出的標題 ${testRunId}`;

    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: originalTitle }),
    });

    // 模擬使用者開了兩個分頁，都停留在同一筆 draft 的編輯畫面。
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await Promise.all([
      pageA.goto(`/organizer/demands/${demand.id}/edit`),
      pageB.goto(`/organizer/demands/${demand.id}/edit`),
    ]);
    await expect(pageA.getByLabel("需求標題")).toHaveValue(originalTitle, {
      timeout: 15_000,
    });
    await expect(pageB.getByLabel("需求標題")).toHaveValue(originalTitle, {
      timeout: 15_000,
    });

    // 分頁 A 送出審核成功。
    await pageA.getByLabel("需求標題").fill(submittedTitle);
    await pageA.getByRole("button", { name: "送出審核" }).click();
    await expect(pageA.getByText("確認送出需求")).toBeVisible();
    await pageA.getByRole("button", { name: "確認送出" }).click();
    await expect(
      pageA.getByText("需求已收到，待平台審核後才會公開給合適的老師。"),
    ).toBeVisible();

    const afterSubmit = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true, title: true },
    });
    expect(afterSubmit).toEqual({ status: "submitted", title: submittedTitle });

    // 分頁 B 完全不知道分頁 A 已經送出，仍拿著舊表單按「儲存草稿」。
    await pageB.getByRole("button", { name: "儲存草稿" }).click();
    await expect(
      pageB.getByText(
        "找不到這筆需求草稿，或目前狀態不允許編輯。",
      ),
    ).toBeVisible();

    const afterStaleSave = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true, title: true },
    });
    // 狀態守衛必須擋下分頁 B 的舊草稿寫入，已送出的內容不可被覆寫。
    expect(afterStaleSave).toEqual({
      status: "submitted",
      title: submittedTitle,
    });

    await pageA.close();
    await pageB.close();
  });

  test("keeps organizations and demands private to their own organizer (IDOR + visibility)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const emailA = `idor-owner-${testRunId}@${testEmailDomain}`;
    const emailB = `idor-other-${testRunId}@${testEmailDomain}`;
    createdEmails.push(emailA, emailB);

    const ownerA = await createOrganizerProfileWithOrganization({
      email: emailA,
      displayName: `Owner A ${testRunId}`,
      organizationName: `Owner A Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `contact-a-${testRunId}@example.com`,
      contactPhone: "0900000001",
    });
    const otherB = await createOrganizerProfileWithOrganization({
      email: emailB,
      displayName: `Other B ${testRunId}`,
      organizationName: `Other B Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `contact-b-${testRunId}@example.com`,
      contactPhone: "0900000002",
    });

    const privateDemandTitle = `A 的私密需求 ${testRunId}`;
    const demandA = await createDemandRequest({
      organizerProfileId: ownerA.organizerProfileId,
      organizationId: ownerA.organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: privateDemandTitle }),
    });

    await addAuthSessionCookie(context, otherB.sessionToken);

    const editResponse = await page.goto(
      `/organizer/demands/${demandA.id}/edit`,
    );
    expect(editResponse?.status()).toBe(404);

    const detailResponse = await page.goto(`/organizer/demands/${demandA.id}`);
    expect(detailResponse?.status()).toBe(404);

    await page.goto("/organizer/profile");
    await expect(
      page.getByRole("heading", { name: `Other B ${testRunId}` }),
    ).toBeVisible();
    await expect(page.getByText(`Owner A Org ${testRunId}`)).toBeHidden();

    await page.goto("/organizer/demands");
    await expect(page.getByText(privateDemandTitle)).toBeHidden();
  });
});
