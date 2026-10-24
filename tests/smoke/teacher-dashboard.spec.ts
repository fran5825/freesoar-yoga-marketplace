import { PrismaClient, type TeacherProfileStatus } from "@prisma/client";
import { expect, test, type BrowserContext } from "@playwright/test";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const authCookieName = "authjs.session-token";
const testEmailDomain = "teacher-dashboard-smoke.local";
const dashboardPath = "/teacher/dashboard";
const createdEmails: string[] = [];

const statusCases: Array<{
  status: TeacherProfileStatus;
  title: string;
  actionLabel: string;
  actionHref: string;
}> = [
  {
    status: "draft",
    title: "你的老師申請草稿正在整理中",
    actionLabel: "繼續整理申請",
    actionHref: "/teachers/join",
  },
  {
    status: "submitted",
    title: "你的老師申請已送出審核",
    actionLabel: "查看申請內容",
    actionHref: "/teachers/join",
  },
  {
    status: "rejected",
    title: "你的老師申請可修正後重新送出",
    actionLabel: "修正並重新送審",
    actionHref: "/teachers/join",
  },
  {
    status: "approved",
    title: "你的老師資料已通過審核",
    actionLabel: "編輯我的資料",
    actionHref: "/teacher/profile/info",
  },
  {
    status: "suspended",
    title: "你的老師狀態目前暫停中",
    actionLabel: "查看目前資料",
    actionHref: "/teacher/profile/info",
  },
];

test.afterAll(async () => {
  if (createdEmails.length === 0) {
    await prisma.$disconnect();
    return;
  }

  await prisma.session.deleteMany({
    where: {
      user: {
        email: {
          in: createdEmails,
        },
      },
    },
  });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.teacherProfile.deleteMany({
    where: {
      user: {
        email: {
          in: createdEmails,
        },
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: createdEmails,
      },
    },
  });
  await prisma.$disconnect();
});

test.describe("/teacher/dashboard smoke", () => {
  test("redirects unauthenticated users to sign in", async ({ page }) => {
    await page.goto(dashboardPath, { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("allows signed-in users without a profile to start teacher onboarding only", async ({
    context,
    page,
  }, testInfo) => {
    const sessionToken = await createUserSession({
      email: createTestEmail(testInfo.project.name, "no-profile"),
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    await expect(
      page.getByRole("heading", { name: "老師總覽" }),
    ).toBeVisible();
    await expect(page.getByText("尚未申請", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "建立老師申請" }),
    ).toHaveAttribute("href", "/teachers/join");
    await expectNoMarketplaceActions(page);
  });

  for (const statusCase of statusCases) {
    test(`shows ${statusCase.status} status without opening marketplace actions`, async ({
      context,
      page,
    }, testInfo) => {
      const testRunId = normalizeForEmail(
        `${testInfo.project.name}-${testInfo.workerIndex}-${statusCase.status}-${Date.now()}`,
      );
      const displayName = `${statusCase.status} Teacher ${testRunId}`;
      const sessionToken = await createTeacherProfileSession({
        email: `${statusCase.status}-${testRunId}@${testEmailDomain}`,
        displayName,
        status: statusCase.status,
      });

      await addAuthSessionCookie(context, sessionToken);
      await page.goto(dashboardPath);

      await expect(
        page.getByText(toStatusLabel(statusCase.status), { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(statusCase.title)).toBeVisible();
      await expect(page.getByText(displayName)).toBeVisible();
      await expect(
        page.getByRole("link", { name: statusCase.actionLabel }),
      ).toHaveAttribute("href", statusCase.actionHref);
      // teacher-first-run 票 08：只有 approved 的老師會看到「開始使用」（含「看看團體需求」連結）。
      if (statusCase.status === "approved") {
        await expect(page.getByRole("heading", { name: "開始使用" })).toBeVisible();
        await expect(page.getByRole("link", { name: "看看團體需求" })).toHaveAttribute("href", "/teacher/demands");
      } else {
        await expect(page.getByRole("heading", { name: "開始使用" })).toHaveCount(0);
        await expect(page.getByRole("main").locator('a[href="/teacher/demands"]')).toHaveCount(0);
      }
      if (
        statusCase.status !== "approved" &&
        statusCase.status !== "suspended"
      ) {
        await expect(
          page.getByRole("link", { name: "管理可授課時間" }),
        ).toHaveCount(0);
        // 還沒通過審核：沒有「待你處理」，也沒有課程入口。
        await expect(page.getByRole("heading", { name: "待你處理" })).toHaveCount(0);
        await expect(page.getByRole("main").locator('a[href="/teacher/classes"]')).toHaveCount(0);
      } else {
        // inline-member-actions 票 04：沒有待處理事項時「待你處理」整張不出現（含空訊息），課程入口在導覽列。
        await expect(page.getByRole("heading", { name: "待你處理" })).toHaveCount(0);
        await expect(page.getByText("目前沒有待處理事項。")).toHaveCount(0);
        expect(await page.locator('a[href="/teacher/classes"]').count()).toBeGreaterThan(0);
      }

      if (statusCase.status === "approved") {
        // teacher-profile-edit D9：approved 的 body 與主要 action 連結再次更新，
        // 補上「編輯個人資料」這個新落地的能力。
        await expect(
          page.getByText(
            "你已經可以在平台上瀏覽並回應團體需求、查看已建立的課程、管理你的可授課時間，並編輯你的老師個人資料。",
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "管理可授課時間" }),
        ).toHaveAttribute("href", "/teacher/profile");
        // 「編輯我的資料」連結的 href 已經由上方的通用斷言（statusCase.actionHref）涵蓋。
      }
    });
  }

  test("keeps long profile text within the mobile viewport", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-long-text-${Date.now()}`,
    );
    const longToken = "LongTeacherProfileValue".repeat(12);
    const sessionToken = await createTeacherProfileSession({
      email: `long-text-${testRunId}@${testEmailDomain}`,
      displayName: longToken,
      specialties: [longToken],
      serviceAreas: [longToken],
      status: "approved",
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    await expect(page.getByText(longToken).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("shows the rejection reason for a rejected teacher", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-reason-${Date.now()}`,
    );
    const reason = `教學經歷需要更具體，請補充帶領團課的實際經驗與時數 ${testRunId}。`;
    const sessionToken = await createTeacherProfileSession({
      email: `rejected-reason-${testRunId}@${testEmailDomain}`,
      displayName: `Rejected Reason ${testRunId}`,
      status: "rejected",
      rejectionReason: reason,
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    await expect(page.getByText("平台的退回說明")).toBeVisible();
    await expect(page.getByText(reason)).toBeVisible();
  });

  test("keeps a long rejection reason within the mobile viewport", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-long-reason-${Date.now()}`,
    );
    const longReason = "LongRejectionReasonValue".repeat(12);
    const sessionToken = await createTeacherProfileSession({
      email: `long-reason-${testRunId}@${testEmailDomain}`,
      displayName: `Long Reason ${testRunId}`,
      status: "rejected",
      rejectionReason: longReason,
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    await expect(page.getByText("平台的退回說明")).toBeVisible();
    await expect(page.getByText(longReason).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

// teacher-first-run 票 08（spec「開始使用」）：剛通過審核的老師在總覽最上方看到三步，
// 每步依既有資料自動打勾；1、2 兩步完成就收起，「先不用」記在這個瀏覽器。
test.describe("開始使用 on /teacher/dashboard", () => {
  test("a newly approved teacher sees the three steps in order with their links, above 待你處理, within a phone width", async ({
    context,
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const testRunId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-get-started-${Date.now()}`);
    const sessionToken = await createTeacherProfileSession({
      email: `get-started-${testRunId}@${testEmailDomain}`,
      displayName: `Get Started ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);

    const card = page.getByRole("region", { name: "開始使用" });
    await expect(card).toBeVisible();
    const steps = card.getByRole("listitem");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("填收款與聯絡");
    await expect(steps.nth(1)).toContainText("開第一堂課");
    await expect(steps.nth(2)).toContainText("公開我的老師頁");
    await expect(steps.nth(2)).toContainText("可跳過");
    await expect(card.getByRole("link", { name: "前往填寫收款與聯絡" })).toHaveAttribute("href", "/teacher/profile/payment");
    await expect(card.getByRole("link", { name: "開第一堂課" })).toHaveAttribute("href", "/teacher/classes/new");
    await expect(card.getByRole("link", { name: "前往設定老師公開頁" })).toHaveAttribute("href", "/teacher/profile/info#public-page");
    await expect(card.getByRole("link", { name: "看看團體需求" })).toHaveAttribute("href", "/teacher/demands");
    await expect(card.getByText("已完成")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("each step ticks itself from existing data, and the card folds away once payment and a first class exist", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-get-started-ticks-${Date.now()}`);
    const email = `get-started-ticks-${testRunId}@${testEmailDomain}`;
    const sessionToken = await createTeacherProfileSession({ email, displayName: `Ticks ${testRunId}`, status: "approved" });
    const profile = await prisma.teacherProfile.findFirstOrThrow({ where: { user: { email } }, select: { id: true } });

    await addAuthSessionCookie(context, sessionToken);

    // 只有空白的收款帳號不算完成；公開頁開了，第 3 步打勾。
    await prisma.teacherProfile.update({ where: { id: profile.id }, data: { paymentAccountInfo: "   ", isPublicPageEnabled: true } });
    await page.goto(dashboardPath);
    const card = page.getByRole("region", { name: "開始使用" });
    await expect(card.getByRole("listitem").nth(0)).not.toContainText("已完成");
    await expect(card.getByRole("listitem").nth(2)).toContainText("已完成");
    await expect(card.getByRole("link", { name: "前往設定老師公開頁" })).toHaveCount(0);

    await prisma.teacherProfile.update({ where: { id: profile.id }, data: { paymentAccountInfo: "（012）1234-5678" } });
    await page.goto(dashboardPath);
    await expect(card.getByRole("listitem").nth(0)).toContainText("已完成");
    await expect(card.getByRole("link", { name: "前往填寫收款與聯絡" })).toHaveCount(0);

    // 有任何一堂自己的課（草稿也算）→ 1、2 兩步都完成，整張收起（不論第 3 步）。
    await prisma.teacherProfile.update({ where: { id: profile.id }, data: { isPublicPageEnabled: false } });
    await prisma.classSession.create({
      data: {
        teacherProfileId: profile.id,
        origin: "teacher_initiated",
        title: `第一堂 ${testRunId}`,
        startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        location: "新竹市",
        capacity: 10,
        status: "draft",
      },
    });
    await page.goto(dashboardPath);
    await expect(page.getByRole("heading", { name: "老師總覽" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "開始使用" })).toHaveCount(0);
  });

  test("先不用 folds the card away and it stays folded after a reload in the same browser", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-get-started-dismiss-${Date.now()}`);
    const sessionToken = await createTeacherProfileSession({
      email: `get-started-dismiss-${testRunId}@${testEmailDomain}`,
      displayName: `Dismiss ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(dashboardPath);
    const dismiss = page.getByRole("button", { name: "先不用" });
    await expect(dismiss).toBeVisible();
    await expect(async () => {
      await dismiss.click();
      await expect(page.getByRole("heading", { name: "開始使用" })).toHaveCount(0, { timeout: 1_000 });
    }).toPass();

    await page.reload();
    await expect(page.getByRole("heading", { name: "老師總覽" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "開始使用" })).toHaveCount(0);
  });
});

async function createUserSession({ email }: { email: string }) {
  createdEmails.push(email);

  const user = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
    },
    select: { id: true },
  });
  const sessionToken = randomUUID();

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  return sessionToken;
}

async function createTeacherProfileSession({
  email,
  displayName,
  specialties = ["Hatha", "Stretch"],
  serviceAreas = ["Taipei"],
  status,
  rejectionReason = null,
}: {
  email: string;
  displayName: string;
  specialties?: string[];
  serviceAreas?: string[];
  status: TeacherProfileStatus;
  rejectionReason?: string | null;
}) {
  const sessionToken = await createUserSession({ email });
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });

  await prisma.teacherProfile.create({
    data: {
      userId: user.id,
      displayName,
      bio: `${displayName} bio`,
      teachingStyle: "Clear and steady group-class guidance.",
      experienceYears: 5,
      specialties,
      serviceAreas,
      teachingFormats: ["Group class"],
      status,
      rejectionReason,
    },
  });

  return sessionToken;
}

async function addAuthSessionCookie(
  context: BrowserContext,
  sessionToken: string,
) {
  await context.addCookies([
    {
      name: authCookieName,
      value: sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function expectNoHorizontalOverflow(page: {
  evaluate: <T>(pageFunction: () => T) => Promise<T>;
}) {
  const overflow = await page.evaluate(() => ({
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    docScrollWidth: document.documentElement.scrollWidth,
  }));

  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.bodyClientWidth);
  expect(overflow.docScrollWidth).toBeLessThanOrEqual(overflow.docClientWidth);
}

function createTestEmail(projectName: string, label: string) {
  return `${label}-${normalizeForEmail(projectName)}-${Date.now()}@${testEmailDomain}`;
}

function normalizeForEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const statusLabels: Record<TeacherProfileStatus, string> = {
  draft: "草稿",
  submitted: "已送出",
  rejected: "已退回",
  approved: "已核准",
  suspended: "已暫停",
};

function toStatusLabel(status: TeacherProfileStatus) {
  return statusLabels[status];
}

async function expectNoMarketplaceActions(page: import("@playwright/test").Page) {
  await expect(page.getByRole("main").locator('a[href="/teacher/demands"]')).toHaveCount(0);
  await expect(page.getByRole("main").locator('a[href="/teacher/classes"]')).toHaveCount(0);
  await expect(page.getByRole("main").locator('a[href="/teacher/profile"]')).toHaveCount(0);
}
