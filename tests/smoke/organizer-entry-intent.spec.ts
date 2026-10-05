import { expect, test } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 10：雙入口、intent 與登入返回。
// - 四種身分（訪客、已登入未有團主資料、已有團主、老師兼團主）都走到正確流程。
// - intent 只接受兩個允許值；返回路徑只接受站內 /organizer/ 路徑。
// - 單筆深連結登入後回到該筆；首屏有建立捷徑；直接開團建立後找得回來。
// 「我已有合作老師」入口目前不公開（DIRECT_CLASS_ENTRY_PUBLIC = false，等票 09 老師端 origin guards）。
// 公開前仍可用網址與 intent=direct_class 走完整流程，這裡照樣驗證。
const testEmailDomain = "organizer-entry-intent-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.organizerClassProposal.deleteMany({
    where: { organizerProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.teacherProfile.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

async function createOrganizer(id: string) {
  const email = `organizer-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  return createOrganizerProfileWithOrganization({
    email,
    displayName: `Entry ${id}`,
    organizationName: `Entry Org ${id}`,
    contactName: "聯絡人",
    contactEmail: `contact-${id}@example.com`,
    contactPhone: "0900000000",
  });
}

async function fillFirstTimeProfile(page: import("@playwright/test").Page, id: string) {
  await page.getByLabel("團主顯示名稱").fill(`First ${id}`);
  await page.getByLabel("組織名稱").fill(`First Org ${id}`);
  await page.getByLabel("組織類型").selectOption("company");
  await page.getByLabel("聯絡電話").fill("0912345678");
}

test.describe("organizer entry intent", () => {
  test("a visitor sees the entry card on the first screen, and it goes to sign-in carrying the intent (keyboard)", async ({ page }) => {
    await page.goto("/organizers/request");
    const findCard = page.getByRole("link", { name: /我需要找老師/ });
    // 桌機與手機（390）都不需要捲動就看得到主操作。
    await expect(findCard.getByText("整理需求、找老師")).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("link", { name: /我已有合作老師/ })).toHaveCount(0);
    await expect(findCard).toHaveAttribute(
      "href",
      `/sign-in?callbackUrl=${encodeURIComponent("/organizers/request?intent=find_teacher")}`,
    );
    await findCard.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/);
    await expect(page.locator('input[name="callbackUrl"]').first()).toHaveValue(
      "/organizers/request?intent=find_teacher",
    );
  });

  test("a signed-in user without an organizer profile keeps the direct-class intent through first-time onboarding", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "onboard-direct");
    const email = `member-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    // 已登入（學員專區外框）時入口卡也在第一個畫面。
    await page.goto("/organizers/request");
    await expect(page.getByText("整理需求、找老師")).toBeInViewport({ ratio: 1 });

    // 登入後回到入口頁（帶 intent），直接分流到一頁式團主資料。
    await page.goto("/organizers/request?intent=direct_class");
    await expect(page).toHaveURL(
      `/organizer/profile?next=${encodeURIComponent("/organizer/class-proposals/new")}`,
    );
    await expect(page.getByText("填好這一頁就能接著安排課程")).toBeVisible();
    await fillFirstTimeProfile(page, id);
    await page.getByRole("button", { name: "建立團主資料並繼續安排課程" }).click();
    await expect(page).toHaveURL(/\/organizer\/class-proposals\/new$/);

    // 已建立後再進入口：不重填資料，intent 直接到表單。
    await page.goto("/organizers/request?intent=find_teacher");
    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);
    expect(await prisma.organizerProfile.count({ where: { user: { email } } })).toBe(1);
  });

  test("a teacher without an organizer profile can enter the organizer flow and the teacher area is unchanged", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "teacher");
    const email = `teacher-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const teacher = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${id}`,
      status: "approved",
    });
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/organizers/request");
    await page.getByRole("link", { name: /我需要找老師/ }).click();
    await expect(page).toHaveURL(
      `/organizer/profile?next=${encodeURIComponent("/organizer/demands/new")}`,
    );
    await fillFirstTimeProfile(page, id);
    await page.getByRole("button", { name: "建立團主資料並開始整理需求" }).click();
    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);

    await page.goto("/teacher/dashboard");
    await expect(page.getByRole("banner").getByText("老師專區")).toBeVisible();
  });

  test("unknown intents and unsafe return paths are ignored", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "unsafe");
    const email = `member-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    // 未知 intent：不分流，照常顯示入口內容。
    await page.goto("/organizers/request?intent=admin");
    await expect(page).toHaveURL(/\/organizers\/request\?intent=admin$/);
    await expect(page.getByRole("link", { name: /我需要找老師/ })).toBeVisible();

    // 不合法的 next 不會帶到表單裡，建立後回預設的新需求表單。
    for (const next of [
      "https://evil.example/organizer/x",
      "//evil.example/organizer/",
      "/organizer/../admin",
      "/\\evil.example/organizer/",
      "/admin/dashboard",
    ]) {
      await page.goto(`/organizer/profile?next=${encodeURIComponent(next)}`);
      await expect(page.locator('input[name="next"]')).toHaveCount(0);
    }
    await page.goto(`/organizer/profile?next=${encodeURIComponent("/organizer/../admin")}`);
    await fillFirstTimeProfile(page, id);
    await page.getByRole("button", { name: "建立團主資料並開始整理需求" }).click();
    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);
  });

  test("signing in from a single demand or class link returns to that record", async ({ page, context }, testInfo) => {
    const id = runId(testInfo, "deep");
    const organizer = await createOrganizer(id);
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "draft",
      data: { title: `深連結 ${id}` },
    });

    await page.goto(`/organizer/demands/${demand.id}`);
    await expect(page).toHaveURL(
      `/sign-in?callbackUrl=${encodeURIComponent(`/organizer/demands/${demand.id}`)}`,
    );
    await page.goto("/organizer/classes/some-class-id");
    await expect(page).toHaveURL(
      `/sign-in?callbackUrl=${encodeURIComponent("/organizer/classes/some-class-id")}`,
    );

    // 已登入時，登入頁直接回到該筆（既有 sign-in 行為）。
    await addAuthSessionCookie(context, organizer.sessionToken);
    await page.goto(`/sign-in?callbackUrl=${encodeURIComponent(`/organizer/demands/${demand.id}`)}`);
    await expect(page).toHaveURL(new RegExp(`/organizer/demands/${demand.id}$`));
    await expect(page.getByRole("heading", { name: `深連結 ${id}` })).toBeVisible();
  });

  test("dashboard and demand list show the create shortcut on the first screen, and a direct-class draft can be found again", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "shortcuts");
    const organizer = await createOrganizer(id);
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/dashboard");
    await expect(page.getByRole("link", { name: "找老師開課" })).toHaveAttribute(
      "href",
      "/organizer/demands/new",
    );
    await expect(page.getByRole("link", { name: "已有合作老師，直接開團" })).toHaveCount(0);
    await page.goto("/organizer/demands");
    await expect(page.getByRole("link", { name: "提出新需求" })).toBeInViewport();

    const proposal = await prisma.organizerClassProposal.create({
      data: {
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        title: `直接開團草稿 ${id}`,
      },
    });
    await page.goto("/organizer/classes");
    await expect(page.getByRole("link", { name: "已有合作老師，直接開團" })).toHaveCount(0);
    const progress = page.getByRole("region", { name: "直接開團的進度" });
    const item = progress.getByRole("link", { name: new RegExp(`直接開團草稿 ${id}`) });
    await expect(item).toContainText("草稿");
    await expect(item).toContainText("尚未選老師");
    await item.click();
    await expect(page).toHaveURL(new RegExp(`/organizer/class-proposals/${proposal.id}$`));
  });
});
