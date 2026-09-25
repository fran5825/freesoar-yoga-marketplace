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
  test("lets a signed-in user sign up as an organizer on one page and land on the new demand form", async ({
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

    // 聯絡信箱預填登入 email；聯絡窗口姓名預設跟著顯示名稱同步。
    await expect(page.getByLabel("聯絡信箱")).toHaveValue(email);
    await page.getByLabel("團主顯示名稱").fill(displayName);
    await expect(page.getByLabel("聯絡窗口姓名")).toHaveValue(displayName);

    await page.getByLabel("組織名稱").fill(organizationName);
    await page.getByLabel("組織類型").selectOption("company");
    await page.getByLabel("聯絡電話").fill("0912345678");
    await page.getByRole("button", { name: "建立團主資料並開始整理需求" }).click();

    // 送出後直接進新需求表單，而且聯絡資料已齊，不會出現補資料提醒。
    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);
    await expect(page.getByRole("heading", { name: "建立新的團課需求" })).toBeVisible();
    await expect(page.getByText("送出需求審核前，需要先補齊組織聯絡資料")).toHaveCount(0);

    const created = await prisma.organizerProfile.findFirstOrThrow({
      where: { user: { email } },
      select: {
        displayName: true,
        organization: {
          select: {
            name: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
          },
        },
      },
    });
    expect(created.displayName).toBe(displayName);
    expect(created.organization).toEqual({
      name: organizationName,
      contactName: displayName,
      contactEmail: email,
      contactPhone: "0912345678",
    });
  });

  test("stops syncing the contact name once the user edits it by hand", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-sync-${Date.now()}`,
    );
    const email = `sync-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/profile");
    await page.getByLabel("團主顯示名稱").fill("王小明");
    await page.getByLabel("聯絡窗口姓名").fill("陳窗口");
    await page.getByLabel("團主顯示名稱").fill("王小明二號");

    await expect(page.getByLabel("聯絡窗口姓名")).toHaveValue("陳窗口");
  });

  test("rejects a one-page sign-up with missing contact info on the server", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-signup-missing-${Date.now()}`,
    );
    const email = `signup-missing-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/profile");
    await page.getByLabel("團主顯示名稱").fill(`Signup Missing ${testRunId}`);
    await page.getByLabel("組織名稱").fill(`Signup Missing Org ${testRunId}`);
    await page.getByLabel("組織類型").selectOption("company");
    // 留空聯絡電話，並關掉瀏覽器原生 required，證明伺服器端才是權威。
    await page.getByLabel("聯絡電話").evaluate((el: HTMLInputElement) => {
      el.required = false;
      el.form?.setAttribute("novalidate", "true");
    });
    await page.getByRole("button", { name: "建立團主資料並開始整理需求" }).click();

    await expect(page.getByText("聯絡電話為必填欄位。")).toBeVisible();
    expect(
      await prisma.organizerProfile.count({ where: { user: { email } } }),
    ).toBe(0);
  });

  test("shows a contact-info banner on the new demand form and returns to it after the profile is completed", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-banner-${Date.now()}`,
    );
    const email = `banner-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Banner Organizer ${testRunId}`,
      organizationName: `Banner Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: null,
      contactPhone: null,
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/demands/new");
    await expect(page.getByText("送出需求審核前，需要先補齊組織聯絡資料")).toBeVisible();

    await page.getByRole("link", { name: "前往補齊聯絡資料" }).click();
    await expect(page).toHaveURL(/\/organizer\/profile\?next=/);
    await expect(page.getByText("還缺 2 項聯絡資料")).toBeVisible();

    await page.getByLabel("聯絡信箱").fill(`banner-${testRunId}@example.com`);
    await page.getByLabel("聯絡電話").fill("0911222333");
    await page.getByRole("button", { name: "儲存並回到剛剛的頁面" }).click();

    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);
    await expect(page.getByText("送出需求審核前，需要先補齊組織聯絡資料")).toHaveCount(0);
  });

  test("ignores an external next parameter on the profile page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-next-${Date.now()}`,
    );
    const email = `next-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Next Organizer ${testRunId}`,
      organizationName: `Next Org ${testRunId}`,
      contactName: "聯絡人",
      contactEmail: `next-${testRunId}@example.com`,
      contactPhone: "0900000000",
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto(
      `/organizer/profile?next=${encodeURIComponent("https://example.com/evil")}`,
    );
    await page.getByRole("button", { name: "儲存", exact: true }).click();

    await expect(page).toHaveURL(/\/organizer\/profile\?result=success/);
    await expect(page.getByText("團主資料已儲存。")).toBeVisible();
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
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();

    const draft = await prisma.demandRequest.findFirstOrThrow({
      where: { organizerProfileId, status: "draft" },
      select: { id: true },
    });

    await page.goto(`/organizer/demands/${draft.id}/edit`);

    // 續編：重新開啟既有 draft 應該把先前存的欄位值 hydrate 回表單。
    await expect(page.getByLabel("需求標題")).toHaveValue(draftTitle);

    // 勾選框本身是 sr-only（只給螢幕閱讀器），跟真人一樣點方塊上的文字。
    await page.getByText("伸展與身體保養", { exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: /^伸展與身體保養/ }),
    ).toBeChecked();
    await page
      // 「特定對象與主題」的說明文字也提到「需求說明」，所以指定文字輸入框。
      .getByRole("textbox", { name: /^需求說明/ })
      .fill(
        "希望帶領辦公室同仁在下班前放鬆身心，適合久坐族群，希望老師著重呼吸與伸展。",
      );
    await page.getByLabel("適合對象").selectOption("general");
    await page.getByLabel("預計參與人數").fill("15");
    await page.getByLabel("期望地點").fill("台北市信義區");
    await page.getByText("平日晚上", { exact: true }).click();
    await page.getByLabel("單堂課程長度（分鐘）").fill("60");
    await page.getByLabel("上課頻率").selectOption("weekly");

    await page.getByRole("button", { name: "送出審核" }).first().click();
    await expect(page.getByText("確認送出需求").first()).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).first().click();

    await expect(
      page.getByText("需求已收到，待平台審核後才會公開給合適的老師。").first(),
    ).toBeVisible();

    const submitted = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: draft.id },
      select: {
        status: true,
        title: true,
        serviceType: true,
        serviceTypes: true,
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
      serviceType: "伸展與身體保養",
      serviceTypes: ["伸展與身體保養"],
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
    await page.getByRole("button", { name: "送出審核" }).first().click();
    await expect(page.getByText("確認送出需求").first()).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).first().click();

    await expect(
      page.getByText(
        "請先至團主資料頁補齊組織聯絡資訊，才能送出需求。",
      ).first(),
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

    // 2026-09-21 服務類型改成單選方塊後，選項值寫死在元件裡，無法再從 DOM 注入假選項；
    // 改成直接在資料庫放一筆帶非法值的草稿，表單載入後原封不動送出。
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "draft",
      data: completeDemandRequestData({
        title: `合法草稿待注入非法值 ${testRunId}`,
        serviceType: "Not A Real Service Type",
        serviceTypes: ["Not A Real Service Type"],
      }),
    });

    await page.goto(`/organizer/demands/${demand.id}/edit`);

    await page.getByRole("button", { name: "送出審核" }).first().click();
    await expect(page.getByText("確認送出需求").first()).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).first().click();

    // 前端選單本身不會提供這個值；此處證明伺服器端獨立驗證受控字串，不只是信任 UI。
    await expect(
      page.getByText("服務類型不在允許的選項內。").first(),
    ).toBeVisible();

    const stillDraft = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true, serviceTypes: true },
    });
    expect(stillDraft.status).toBe("draft");
    expect(stillDraft.serviceTypes).toEqual(["Not A Real Service Type"]);
  });

  test("lets an online demand be submitted without a location, but requires one otherwise", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-online-${Date.now()}`,
    );
    const email = `online-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email,
        displayName: `Online Organizer ${testRunId}`,
        organizationName: `Online Org ${testRunId}`,
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
        title: `線上課程不用填地點 ${testRunId}`,
        preferredAreas: [],
      }),
    });

    await page.goto(`/organizer/demands/${demand.id}/edit`);

    // 沒勾線上課程、地點又空著：必填檢查會鎖住送出按鈕。
    await expect(page.getByText("還缺 1 項才能送審：期望地點").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "送出審核" }).first(),
    ).toBeDisabled();

    await page.getByLabel("這是線上課程").check();
    await expect(page.getByText("期望地點（選填）")).toBeVisible();

    await page.getByRole("button", { name: "送出審核" }).first().click();
    await page.getByRole("button", { name: "確認送出" }).first().click();
    await expect(
      page.getByText("需求已收到，待平台審核後才會公開給合適的老師。").first(),
    ).toBeVisible();

    const submitted = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true, isOnline: true, preferredAreas: true },
    });
    expect(submitted).toEqual({
      status: "submitted",
      isOnline: true,
      preferredAreas: [],
    });
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
    await pageA.getByRole("button", { name: "送出審核" }).first().click();
    await expect(pageA.getByText("確認送出需求").first()).toBeVisible();
    await pageA.getByRole("button", { name: "確認送出" }).first().click();
    await expect(
      pageA.getByText("需求已收到，待平台審核後才會公開給合適的老師。").first(),
    ).toBeVisible();

    const afterSubmit = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true, title: true },
    });
    expect(afterSubmit).toEqual({ status: "submitted", title: submittedTitle });

    // 分頁 B 完全不知道分頁 A 已經送出，仍拿著舊表單按「儲存草稿」。
    await pageB.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(
      pageB.getByText(
        "找不到這筆需求草稿，或目前狀態不允許編輯。",
      ).first(),
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
