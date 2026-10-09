import { expect, test, type Page } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 03：我的團體與首次建團。
const testEmailDomain = "organizer-organizations-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  const organizations = await prisma.organization.findMany({
    where: { ownerOrganizerProfile: { user: { email: { in: createdEmails } } } },
    select: { id: true },
  });
  await prisma.teacherProfile.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await cleanupOrganizerDemandFixtures(createdEmails);
  expect(await prisma.organization.count({
    where: { id: { in: organizations.map((organization) => organization.id) } },
  })).toBe(0);
  await prisma.$disconnect();
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("organizer organizations smoke", () => {
  test("uses a stable owner default for tied creation times without replacing a requested or saved group", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "owner-default-tie");
    const email = `tie-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Tie Owner ${id}`,
      organizationName: `First Created ${id}`,
      contactName: "第一窗口",
      contactEmail: `tie-${id}@example.com`,
      contactPhone: "0900000001",
    });
    const createdAt = new Date("2020-01-01T00:00:00.000Z");
    await prisma.organization.update({ where: { id: organizer.organizationId }, data: { createdAt } });
    const defaultGroup = await prisma.organization.create({
      data: {
        id: `c0${Date.now()}${testInfo.workerIndex}${testInfo.project.name.includes("mobile") ? "m" : "d"}`,
        name: `Default Tie ${id}`,
        type: "community",
        ownerOrganizerProfileId: organizer.organizerProfileId,
        createdAt,
      },
      select: { id: true },
    });
    // 後建立的團體 id 更小：不能只靠插入順序或 createdAt 選第一筆。
    expect(defaultGroup.id < organizer.organizationId).toBe(true);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands/new");
    await expect(page.getByLabel("為哪個團體提出需求")).toHaveValue(defaultGroup.id);
    await expectNoHorizontalOverflow(page);

    await page.goto(`/organizer/demands/new?organizationId=${organizer.organizationId}`);
    await expect(page.getByLabel("為哪個團體提出需求")).toHaveValue(organizer.organizationId);
    await page.getByLabel("需求標題").fill(`Keep Requested ${id}`);
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/]+\/edit$/);
    await page.reload();
    await expect(page.getByLabel("為哪個團體提出需求")).toHaveValue(organizer.organizationId);
    const saved = await prisma.demandRequest.findFirstOrThrow({
      where: { organizerProfileId: organizer.organizerProfileId, title: `Keep Requested ${id}` },
      select: { organizationId: true },
    });
    expect(saved.organizationId).toBe(organizer.organizationId);

    await page.goto("/organizer/class-proposals/new");
    await expect(page.getByLabel("為哪個團體開團")).toHaveValue(defaultGroup.id);
    await page.getByLabel("課程名稱").fill(`Default Proposal ${id}`);
    await page.getByRole("button", { name: "儲存草稿", exact: true }).first().click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/[^/?]+\/edit$/);
    const proposal = await prisma.organizerClassProposal.findFirstOrThrow({
      where: { organizerProfileId: organizer.organizerProfileId, title: `Default Proposal ${id}` },
      select: { organizationId: true },
    });
    expect(proposal.organizationId).toBe(defaultGroup.id);
    await expectNoHorizontalOverflow(page);

    await page.goto("/organizer/dashboard");
    await expect(page.getByRole("link", { name: "前往我的團體補齊" })).toHaveAttribute(
      "href", `/organizer/organizations/${defaultGroup.id}`,
    );
    await page.goto(`/organizer/profile?next=${encodeURIComponent("/organizer/demands/new")}`);
    await expect(page).toHaveURL(new RegExp(`/organizer/organizations/${defaultGroup.id}\\?returnTo=`));
    await expectNoHorizontalOverflow(page);
  });

  test("adds a second organization with incomplete contact info and edits it without touching the first", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "two-orgs");
    const email = `two-orgs-${id}@${testEmailDomain}`;
    createdEmails.push(email);

    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${id}`,
      organizationName: `First Org ${id}`,
      contactName: "第一聯絡人",
      contactEmail: `first-${id}@example.com`,
      contactPhone: "0900000001",
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    // 首屏就能新增。
    await page.goto("/organizer/organizations");
    await expect(page.getByText(`First Org ${id}`)).toBeVisible();
    await page.getByRole("link", { name: "＋ 新增團體" }).click();
    await expect(page).toHaveURL(/\/organizer\/organizations\/new$/);

    // 只填名稱與類型就能存，聯絡資料之後再補。
    await page.getByLabel("組織名稱").fill(`Second Org ${id}`);
    await page.getByLabel("組織類型").selectOption("community");
    await page.getByRole("button", { name: "儲存團體" }).click();

    await expect(page).toHaveURL(/\/organizer\/organizations\?saved=/);
    await expect(page.getByText(`已儲存「Second Org ${id}」。`)).toBeVisible();
    await expect(page.getByText("還需要補聯絡資料")).toBeVisible();

    const second = await prisma.organization.findFirstOrThrow({
      where: { name: `Second Org ${id}` },
      select: { id: true, ownerOrganizerProfileId: true, contactEmail: true },
    });
    expect(second.ownerOrganizerProfileId).toBe(organizer.organizerProfileId);
    expect(second.contactEmail).toBeNull();

    // pointer=null 的 owner-only fixture 仍以第一個團體預選。
    await page.goto("/organizer/demands/new");
    await expect(page.getByLabel("為哪個團體提出需求")).toHaveValue(organizer.organizationId);
    await page.goto("/organizer/organizations");

    // 編輯第二個團體，不影響第一個。
    await page.getByRole("link", { name: new RegExp(`Second Org ${id}`) }).click();
    await page.getByLabel("聯絡信箱").fill(`second-${id}@example.com`);
    await page.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(page.getByText(`已儲存「Second Org ${id}」。`)).toBeVisible();

    const [firstAfter, secondAfter] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: organizer.organizationId },
        select: { name: true, contactEmail: true },
      }),
      prisma.organization.findUniqueOrThrow({
        where: { id: second.id },
        select: { contactEmail: true },
      }),
    ]);
    expect(firstAfter).toEqual({ name: `First Org ${id}`, contactEmail: `first-${id}@example.com` });
    expect(secondAfter.contactEmail).toBe(`second-${id}@example.com`);

    // 團主資料頁列出兩個團體的摘要。
    await page.goto("/organizer/profile");
    await expect(page.getByRole("link", { name: `First Org ${id}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `Second Org ${id}` })).toBeVisible();
  });

  test("keeps the typed values when the server rejects an organization save", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "keep-input");
    const email = `keep-input-${id}@${testEmailDomain}`;
    createdEmails.push(email);

    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${id}`,
      organizationName: `Org ${id}`,
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/organizations/new");
    await page.getByLabel("聯絡窗口姓名").fill("留下來的名字");
    await page.getByLabel("聯絡信箱").fill("not-an-email");
    await page.getByLabel("組織名稱").fill(`Kept Org ${id}`);
    await page.getByLabel("組織類型").selectOption("company");
    // 關掉瀏覽器原生檢查，讓伺服器端驗證成為權威。
    await page
      .getByRole("button", { name: "儲存團體" })
      .evaluate((button: HTMLButtonElement) => button.form?.setAttribute("novalidate", "true"));
    await page.getByRole("button", { name: "儲存團體" }).click();

    await expect(page.getByText("聯絡信箱格式不正確").first()).toBeVisible();
    await expect(page).toHaveURL(/\/organizer\/organizations\/new$/);
    await expect(page.getByLabel("組織名稱")).toHaveValue(`Kept Org ${id}`);
    await expect(page.getByLabel("聯絡窗口姓名")).toHaveValue("留下來的名字");
    await expect(page.getByLabel("聯絡信箱")).toHaveValue("not-an-email");
    await expect(page.getByLabel("組織類型")).toHaveValue("company");

    const count = await prisma.organization.count({ where: { name: `Kept Org ${id}` } });
    expect(count).toBe(0);

    // 修正錯誤後重送：使用者剛選的類型被保存，不會退回空白或舊值。
    await page.getByLabel("聯絡信箱").fill(`kept-${id}@example.com`);
    await page.getByRole("button", { name: "儲存團體" }).click();
    await expect(page.getByText(`已儲存「Kept Org ${id}」。`)).toBeVisible();
    const saved = await prisma.organization.findFirstOrThrow({
      where: { name: `Kept Org ${id}` },
      select: { type: true, contactName: true },
    });
    expect(saved).toEqual({ type: "company", contactName: "留下來的名字" });
  });

  test("keeps a changed organization type when an edit is rejected, then saves it on resubmit", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "edit-type");
    const email = `edit-type-${id}@${testEmailDomain}`;
    createdEmails.push(email);

    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${id}`,
      organizationName: `Edit Type Org ${id}`,
      organizationType: "company",
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto(`/organizer/organizations/${organizer.organizationId}`);
    await page.getByLabel("組織類型").selectOption("community");
    await page.getByLabel("聯絡信箱").fill("not-an-email");
    await page
      .getByRole("button", { name: "儲存", exact: true })
      .evaluate((button: HTMLButtonElement) => button.form?.setAttribute("novalidate", "true"));
    await page.getByRole("button", { name: "儲存", exact: true }).click();

    await expect(page.getByText("聯絡信箱格式不正確").first()).toBeVisible();
    await expect(page.getByLabel("組織類型")).toHaveValue("community");

    await page.getByLabel("聯絡信箱").fill(`edit-type-${id}@example.com`);
    await page.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(page.getByText(`已儲存「Edit Type Org ${id}」。`)).toBeVisible();

    const saved = await prisma.organization.findUniqueOrThrow({
      where: { id: organizer.organizationId },
      select: { type: true },
    });
    expect(saved.type).toBe("community");
  });

  test("keeps the typed values when first-time organizer signup fails server validation", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "signup-keep");
    const email = `signup-keep-${id}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/profile");
    await page.getByLabel("團主顯示名稱").fill(`Signup ${id}`);
    await page.getByLabel("組織名稱").fill(`Signup Org ${id}`);
    await page.getByLabel("組織類型").selectOption("company");
    await page.getByLabel("聯絡信箱").fill("not-an-email");
    await page.getByLabel("聯絡電話").fill("0912345678");
    await page
      .getByRole("button", { name: "建立團主資料並開始整理需求" })
      .evaluate((button: HTMLButtonElement) => button.form?.setAttribute("novalidate", "true"));
    await page.getByRole("button", { name: "建立團主資料並開始整理需求" }).click();

    await expect(page.getByText("聯絡信箱格式不正確").first()).toBeVisible();
    await expect(page).toHaveURL(/\/organizer\/profile$/);
    await expect(page.getByLabel("組織名稱")).toHaveValue(`Signup Org ${id}`);
    await expect(page.getByLabel("聯絡電話")).toHaveValue("0912345678");
    await expect(page.getByLabel("組織類型")).toHaveValue("company");

    // 一個 transaction：失敗時沒有留下團主資料或團體。
    const [profiles, organizations] = await Promise.all([
      prisma.organizerProfile.count({ where: { user: { email } } }),
      prisma.organization.count({ where: { name: `Signup Org ${id}` } }),
    ]);
    expect(profiles).toBe(0);
    expect(organizations).toBe(0);
  });

  test("an approved teacher can become an organizer on the same account through the one-page signup", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "teacher-organizer");
    const email = `teacher-organizer-${id}@${testEmailDomain}`;
    createdEmails.push(email);

    const teacher = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${id}`,
      status: "approved",
    });
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/organizer/profile");
    await page.getByLabel("團主顯示名稱").fill(`Teacher Organizer ${id}`);
    await page.getByLabel("組織名稱").fill(`Teacher Org ${id}`);
    await page.getByLabel("組織類型").selectOption("community");
    await page.getByLabel("聯絡電話").fill("0912345678");
    await page.getByRole("button", { name: "建立團主資料並開始整理需求" }).click();
    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);

    const profile = await prisma.organizerProfile.findFirstOrThrow({
      where: { user: { email } },
      select: { id: true, ownedOrganizations: { select: { name: true } } },
    });
    expect(profile.ownedOrganizations).toEqual([{ name: `Teacher Org ${id}` }]);
  });

  test("admin organizations list shows the owner of an organization that has no legacy pointer", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "admin-owner");
    const organizerEmail = `admin-owner-organizer-${id}@${testEmailDomain}`;
    const adminEmail = `admin-owner-admin-${id}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, adminEmail);

    const organizer = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Owner Display ${id}`,
      organizationName: `Legacy Org ${id}`,
    });
    // 第二個團體只有 owner，沒有 legacy pointer（比照「我的團體」新增的團體）。
    await prisma.organization.create({
      data: {
        name: `Owner Only Org ${id}`,
        type: "community",
        ownerOrganizerProfileId: organizer.organizerProfileId,
      },
    });

    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    // 依團主名稱搜尋，兩個團體都找得到，而且都顯示這位團主。
    await page.goto(`/admin/organizations?q=${encodeURIComponent(`Owner Display ${id}`)}`);
    for (const organizationName of [`Legacy Org ${id}`, `Owner Only Org ${id}`]) {
      const card = page.locator("article").filter({ hasText: organizationName });
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(`Owner Display ${id}`);
    }
  });

  test("organization pages have no horizontal overflow at 320px", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "narrow");
    const email = `narrow-${id}@${testEmailDomain}`;
    createdEmails.push(email);

    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${id}`,
      // 不能斷行的長英文字串最容易撐破版面。
      organizationName: `SunshineTechnologyEmployeeWellnessAndMindfulYogaCommunityClub${id}`,
    });
    await addAuthSessionCookie(context, organizer.sessionToken);
    await page.setViewportSize({ width: 320, height: 800 });

    for (const path of [
      "/organizer/organizations",
      // 儲存成功後的列表會在提示裡帶出完整團體名稱。
      `/organizer/organizations?saved=${organizer.organizationId}`,
      "/organizer/organizations/new",
      `/organizer/organizations/${organizer.organizationId}`,
      "/organizer/profile",
    ]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  });
});
