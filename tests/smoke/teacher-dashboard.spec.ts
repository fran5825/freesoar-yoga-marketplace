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
    actionHref: "/teacher/profile",
  },
  {
    status: "suspended",
    title: "你的老師狀態目前暫停中",
    actionLabel: "查看目前資料",
    actionHref: "/teacher/profile",
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
      page.getByRole("heading", { name: "老師狀態中心" }),
    ).toBeVisible();
    await expect(page.getByText("No profile")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "建立 teacher application" }),
    ).toHaveAttribute("href", "/teachers/join");
    await expect(page.getByRole("link", { name: "Demand pool" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("link", { name: "Availability" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("link", { name: "Classes" })).toHaveCount(0);
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
      await expect(page.getByRole("link", { name: "Demand pool" })).toHaveCount(
        0,
      );
      await expect(page.getByRole("link", { name: "Availability" })).toHaveCount(
        0,
      );
      await expect(page.getByRole("link", { name: "Classes" })).toHaveCount(0);

      if (statusCase.status === "approved") {
        // teacher-profile-edit D9：approved 的 body 與主要 action 連結再次更新，
        // 補上「編輯個人資料」這個新落地的能力。
        await expect(
          page.getByText(
            "你已具備 marketplace capability，可以瀏覽並回應團體需求、查看已建立的課程、管理你的可授課時間，並編輯你的老師個人資料。",
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "管理可授課時間" }),
        ).toHaveAttribute("href", "/teacher/availability");
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

function toStatusLabel(status: TeacherProfileStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
