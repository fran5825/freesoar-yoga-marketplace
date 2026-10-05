import { expect, test, type Page } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 14：關鍵操作只用鍵盤（Tab 移動焦點、Enter 啟動）也能完成：
// 老師確認合作邀請 → 團主開放報名 → 複製報名連結（aria-live 告知結果）。桌機與手機 project 都跑。
const testEmailDomain = "organizer-keyboard-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  const emails = { in: createdEmails };
  await prisma.organizerClassProposal.deleteMany({ where: { organizerProfile: { user: { email: emails } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: emails } } } });
  await prisma.notification.deleteMany({ where: { user: { email: emails } } });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: emails } } });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

// 一直按 Tab，直到焦點落在名稱符合的按鈕或連結；確認它真的可以用 Tab 走到，而且有可見的焦點樣式。
async function tabTo(page: Page, name: string) {
  for (let i = 0; i < 80; i += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        text: (el.innerText || el.getAttribute("aria-label") || "").trim(),
        hasFocusStyle: style.outlineStyle !== "none" || style.boxShadow !== "none",
      };
    });
    if (focused?.text === name) {
      expect(focused.hasFocusStyle, `「${name}」取得焦點時要看得出來`).toBe(true);
      return;
    }
  }
  throw new Error(`按 Tab 走不到「${name}」`);
}

test.describe("organizer keyboard-only journey", () => {
  test.setTimeout(120_000);

  test("teacher confirms, organizer opens and copies the link using only the keyboard", async ({ browser }, testInfo) => {
    const id = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-kbd-${Date.now()}`);
    const organizerEmail = `organizer-${id}@${testEmailDomain}`;
    const teacherEmail = `teacher-${id}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail);
    const organizer = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `鍵盤團主 ${id}`,
      organizationName: `鍵盤團體 ${id}`,
      contactName: "聯絡人",
      contactEmail: `contact-${id}@example.com`,
      contactPhone: "0900000000",
    });
    const teacher = await createTeacherProfileWithSession({ email: teacherEmail, displayName: `鍵盤老師 ${id}`, status: "approved" });
    const base = Math.floor((Date.now() + 27 * 86_400_000) / 3_600_000) * 3_600_000;
    const proposal = await prisma.organizerClassProposal.create({
      data: {
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        teacherProfileId: teacher.teacherProfileId,
        title: `鍵盤課程 ${id}`,
        serviceTypes: ["伸展與身體保養"],
        startAt: new Date(base),
        endAt: new Date(base + 3_600_000),
        location: "台北市信義區",
        capacity: 12,
        status: "pending_confirmation",
        submittedAt: new Date(),
        transitionSeq: 2,
      },
    });

    const teacherContext = await browser.newContext({ viewport: testInfo.project.use.viewport ?? undefined });
    await addAuthSessionCookie(teacherContext, teacher.sessionToken);
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto(`/teacher/class-proposals/${proposal.id}`);
    await tabTo(teacherPage, "確認授課");
    await teacherPage.keyboard.press("Enter");
    await expect(teacherPage.getByText("確認由你授課？")).toBeVisible();
    await tabTo(teacherPage, "確認授課");
    await teacherPage.keyboard.press("Enter");
    await expect(teacherPage.getByText(/你已確認授課/)).toBeVisible();
    await teacherContext.close();

    const organizerContext = await browser.newContext({ viewport: testInfo.project.use.viewport ?? undefined });
    await organizerContext.grantPermissions(["clipboard-read", "clipboard-write"]);
    await addAuthSessionCookie(organizerContext, organizer.sessionToken);
    const page = await organizerContext.newPage();
    await page.goto(`/organizer/class-proposals/${proposal.id}`);
    await tabTo(page, "開放報名");
    await page.keyboard.press("Enter");
    await tabTo(page, "確認開放報名");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/organizer\/classes\/[^/?]+\?flash=opened$/);
    await tabTo(page, "複製報名連結");
    await page.keyboard.press("Enter");
    await expect(page.getByText("已複製，可以貼到 LINE 或群組傳給團員。")).toBeVisible();
    await expect(page.locator("#class-share-status")).toHaveAttribute("aria-live", "polite");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.getByLabel("報名連結", { exact: true }).inputValue());
    await organizerContext.close();
  });
});
