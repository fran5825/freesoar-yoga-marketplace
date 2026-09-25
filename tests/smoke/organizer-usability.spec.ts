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

// organizer-usability 票 08–11：詳情頁下一步、總覽「待你處理」、需求列表篩選、通知連結。
const testEmailDomain = "organizer-usability-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

async function createOrganizer(
  testInfo: { project: { name: string }; workerIndex: number },
  label: string,
) {
  const testRunId = normalizeForEmail(
    `${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`,
  );
  const email = `${label}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);

  const organizer = await createOrganizerProfileWithOrganization({
    email,
    displayName: `Usability ${label} ${testRunId}`,
    organizationName: `Usability Org ${label} ${testRunId}`,
    contactName: "聯絡人",
    contactEmail: `contact-${testRunId}@example.com`,
    contactPhone: "0900000000",
  });

  return { ...organizer, email, testRunId };
}

test.describe("organizer usability", () => {
  test("the dashboard lists demands that need action under 待你處理, and shows an empty state otherwise", async ({
    context,
    page,
  }, testInfo) => {
    const empty = await createOrganizer(testInfo, "pending-empty");
    await addAuthSessionCookie(context, empty.sessionToken);
    await page.goto("/organizer/dashboard");

    await expect(page.getByRole("heading", { name: "待你處理" })).toBeVisible();
    await expect(page.getByText("目前沒有待處理事項。")).toBeVisible();

    const withDraft = await createOrganizer(testInfo, "pending-draft");
    await createDemandRequest({
      organizerProfileId: withDraft.organizerProfileId,
      organizationId: withDraft.organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: `待處理草稿 ${withDraft.testRunId}` }),
    });
    await context.clearCookies();
    await addAuthSessionCookie(context, withDraft.sessionToken);
    await page.goto("/organizer/dashboard");

    const pendingSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "待你處理" }) });
    await expect(pendingSection.getByText("1 筆草稿還沒送出")).toBeVisible();
    await expect(
      pendingSection.getByRole("link", { name: /草稿還沒送出/ }),
    ).toHaveAttribute("href", "/organizer/demands?status=draft");
    await expect(page.getByText("目前沒有待處理事項。")).toHaveCount(0);
  });

  test("the demand list filters by status group and each card links to the detail page with a next-step line", async ({
    context,
    page,
  }, testInfo) => {
    const organizer = await createOrganizer(testInfo, "list");
    const draft = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: `列表草稿 ${organizer.testRunId}` }),
    });
    await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: `列表審核中 ${organizer.testRunId}` }),
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands");
    await expect(page.getByRole("link", { name: /全部・2/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /草稿・1/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /審核中・1/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /已公開・0/ })).toBeVisible();

    // 整張卡片可點，顯示一句話下一步；列表不再放「繼續編輯草稿」小連結。
    const draftCard = page.getByRole("link", { name: /列表草稿/ });
    await expect(draftCard).toHaveAttribute("href", `/organizer/demands/${draft.id}`);
    await expect(draftCard.getByText("草稿：補齊欄位後送出審核")).toBeVisible();
    await expect(page.getByRole("link", { name: "繼續編輯草稿" })).toHaveCount(0);

    await page.getByRole("link", { name: /草稿・1/ }).click();
    await expect(page).toHaveURL(/status=draft/);
    await expect(page.getByRole("link", { name: /列表草稿/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /列表審核中/ })).toHaveCount(0);

    await page.getByRole("link", { name: /已公開・0/ }).click();
    await expect(page.getByText("這個分類目前沒有需求。")).toBeVisible();
  });

  test("the detail page leads with the next step and keeps the demand content collapsed", async ({
    context,
    page,
  }, testInfo) => {
    const organizer = await createOrganizer(testInfo, "detail");
    const draft = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: `詳情草稿 ${organizer.testRunId}` }),
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto(`/organizer/demands/${draft.id}`);

    const nextStep = page.getByRole("region", { name: "下一步提示" });
    await expect(nextStep).toBeVisible();
    await expect(
      nextStep.getByText("這筆需求還是草稿。補齊必填欄位後，就可以送出審核。"),
    ).toBeVisible();
    await expect(nextStep.getByRole("link", { name: "繼續編輯草稿" })).toHaveAttribute(
      "href",
      `/organizer/demands/${draft.id}/edit`,
    );

    // 需求內容預設收合，點開才看得到。
    const summary = page.getByText("需求內容（點開查看）");
    await expect(page.getByText("預計參與人數")).toBeHidden();
    await summary.click();
    await expect(page.getByText("預計參與人數")).toBeVisible();
  });

  test("notifications link to the matching list page for the recipient's identity", async ({
    context,
    page,
  }, testInfo) => {
    const organizer = await createOrganizer(testInfo, "notify");
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: organizer.email },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "demand_request_published",
        channel: "in_app",
        status: "sent",
        title: "需求已公開",
        body: "你的需求已公開給合適的老師。",
      },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "teacher_application_rejected",
        channel: "in_app",
        status: "sent",
        title: "老師申請未通過",
        body: "這則通知對沒有老師身分的人沒有可去的頁面。",
      },
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/notifications");

    // 團主開通知頁時，仍看得到團主導覽列。
    await expect(page.getByRole("banner").getByText("團主專區")).toBeVisible();
    await expect(page.getByRole("link", { name: "前往我的需求 →" })).toHaveAttribute(
      "href",
      "/organizer/demands",
    );
    const rejectedCard = page.locator("article").filter({ hasText: "老師申請未通過" });
    await expect(rejectedCard.getByRole("link")).toHaveCount(0);
  });

  test("the collapsed menu on a narrow screen opens and closes, and its links work", async ({
    context,
    page,
  }, testInfo) => {
    const organizer = await createOrganizer(testInfo, "menu");
    await addAuthSessionCookie(context, organizer.sessionToken);
    await page.setViewportSize({ width: 375, height: 800 });

    await page.goto("/organizer/profile");

    const menuButton = page.getByRole("button", { name: "選單" });
    const navLinks = page.getByRole("navigation", { name: "團主專區導覽" });
    await expect(menuButton).toBeVisible();
    await expect(navLinks).toBeHidden();

    await menuButton.click();
    await expect(page.getByRole("button", { name: "關閉選單" })).toBeVisible();
    await expect(navLinks).toBeVisible();

    await navLinks.getByRole("link", { name: "我的需求" }).click();
    await expect(page).toHaveURL(/\/organizer\/demands$/);
    // 換頁後選單收回去。
    await expect(page.getByRole("navigation", { name: "團主專區導覽" })).toBeHidden();
  });

  test("a start date in the past shows an inline error and blocks submitting", async ({
    context,
    page,
  }, testInfo) => {
    const organizer = await createOrganizer(testInfo, "past-date");
    const draft = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "draft",
      data: completeDemandRequestData({ title: `過期日期 ${organizer.testRunId}` }),
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto(`/organizer/demands/${draft.id}/edit`);
    await expect(
      page.getByText("必填欄位都填好了，可以送出審核。").first(),
    ).toBeVisible();

    await page.getByLabel("期望開課日期").fill("2020-01-01");
    await expect(page.getByText("期望開課日期不可早於今天，請重新選擇。")).toBeVisible();
    await expect(
      page.getByText("還缺 1 項才能送審：期望開課日期（不可早於今天）").first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "送出審核" }).first()).toBeDisabled();

    await page.getByLabel("期望開課日期").fill("2099-01-01");
    await expect(page.getByText("期望開課日期不可早於今天，請重新選擇。")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "送出審核" }).first()).toBeEnabled();
  });

  test("teacher pages and the notifications page show the teacher area navigation", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-teacher-nav-${Date.now()}`,
    );
    const email = `teacher-nav-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.teacherProfile.create({
      data: { userId: user.id, displayName: `Teacher Nav ${testRunId}` },
    });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/teacher/profile");
    await expect(page.getByRole("banner").getByText("老師專區")).toBeVisible();

    await page.goto("/notifications");
    await expect(page.getByRole("banner").getByText("老師專區")).toBeVisible();
    await expect(page.getByText("Notifications")).toHaveCount(0);
  });

  test("service types are multi-select: at most 3, 'not sure' is exclusive, and the first pick is stored as the primary type", async ({
    context,
    page,
  }, testInfo) => {
    const organizer = await createOrganizer(testInfo, "multi-type");
    const draft = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "draft",
      data: completeDemandRequestData({
        title: `多選類型 ${organizer.testRunId}`,
        serviceType: null,
        serviceTypes: [],
      }),
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto(`/organizer/demands/${draft.id}/edit`);
    await expect(page.getByText("還缺 1 項才能送審：服務類型").first()).toBeVisible();

    const box = (name: string) =>
      page.getByRole("checkbox", { name: new RegExp(`^${name}`) });
    const card = (name: string) => page.getByText(name, { exact: true });

    await card("放鬆紓壓").click();
    await card("流汗活力").click();
    await card("核心與體態").click();
    await expect(page.getByText("已選 3／3")).toBeVisible();

    // 已滿 3 個：其他選項不能再選，但已選的仍可取消。
    await expect(box("冥想與呼吸")).toBeDisabled();
    await expect(box("放鬆紓壓")).toBeEnabled();

    // 「還不確定」會清掉其他選項；再選別的會取消「還不確定」。
    await card("還不確定，請老師建議").click();
    await expect(box("還不確定")).toBeChecked();
    await expect(box("放鬆紓壓")).not.toBeChecked();
    await card("冥想與呼吸").click();
    await expect(box("還不確定")).not.toBeChecked();
    await card("放鬆紓壓").click();
    await expect(page.getByText("已選 2／3")).toBeVisible();

    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();

    const saved = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: draft.id },
      select: { serviceType: true, serviceTypes: true },
    });
    expect(saved.serviceTypes).toEqual(["冥想與呼吸", "放鬆紓壓"]);
    expect(saved.serviceType).toBe("冥想與呼吸");
  });
});
