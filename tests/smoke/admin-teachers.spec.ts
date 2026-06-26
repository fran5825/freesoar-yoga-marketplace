import { PrismaClient, type TeacherProfileStatus } from "@prisma/client";
import { expect, test, type BrowserContext } from "@playwright/test";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const authCookieName = "authjs.session-token";
const testEmailDomain = "admin-teachers-smoke.local";
const createdEmails: string[] = [];

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

test.describe("/admin/teachers smoke", () => {
  test("blocks non-admin sessions", async ({ context, page }, testInfo) => {
    const nonAdminSessionToken = await createUserSession({
      email: createTestEmail(testInfo.project.name, "non-admin"),
      isAdmin: false,
    });

    await addAuthSessionCookie(context, nonAdminSessionToken);

    const response = await page.goto("/admin/teachers");

    expect(response?.status()).toBe(404);
  });

  test("lets admin approve submitted teacher applications", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const adminSessionToken = await createUserSession({
      email: `admin-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    const submittedTeacherSessionToken = await createTeacherProfileWithSession({
      email: `submitted-${testRunId}@${testEmailDomain}`,
      displayName: `Submitted Teacher ${testRunId}`,
      status: "submitted",
    });

    await createTeacherProfileWithSession({
      email: `draft-${testRunId}@${testEmailDomain}`,
      displayName: `Draft Teacher ${testRunId}`,
      status: "draft",
    });
    await createTeacherProfileWithSession({
      email: `rejected-${testRunId}@${testEmailDomain}`,
      displayName: `Rejected Teacher ${testRunId}`,
      status: "rejected",
    });
    await createTeacherProfileWithSession({
      email: `suspended-${testRunId}@${testEmailDomain}`,
      displayName: `Suspended Teacher ${testRunId}`,
      status: "suspended",
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto("/admin/teachers");
    const submittedApplication = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: `Submitted Teacher ${testRunId}`,
      }),
    });

    await expect(
      page.getByRole("heading", { name: "Teacher applications" }),
    ).toBeVisible();
    await expect(
      submittedApplication.getByRole("heading", {
        name: `Submitted Teacher ${testRunId}`,
      }),
    ).toBeVisible();
    await expect(page.getByText(`Draft Teacher ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Rejected Teacher ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Suspended Teacher ${testRunId}`)).toBeHidden();

    await submittedApplication.getByRole("button", { name: "Approve" }).click();

    await expect(
      page.getByText("TeacherProfile application approved."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `Submitted Teacher ${testRunId}` }),
    ).toBeHidden();

    const approvedProfile = await prisma.teacherProfile.findFirstOrThrow({
      where: {
        user: {
          email: `submitted-${testRunId}@${testEmailDomain}`,
        },
      },
      select: { status: true },
    });

    expect(approvedProfile.status).toBe("approved");

    await context.clearCookies();
    await addAuthSessionCookie(context, submittedTeacherSessionToken);
    await page.goto("/teachers/join");

    await expect(
      page.getByRole("button", { name: "已通過審核" }).first(),
    ).toBeVisible();
  });
});

async function createUserSession({
  email,
  isAdmin,
}: {
  email: string;
  isAdmin: boolean;
}) {
  createdEmails.push(email);

  const user = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
      isAdmin,
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

async function createTeacherProfileWithSession({
  email,
  displayName,
  status,
}: {
  email: string;
  displayName: string;
  status: TeacherProfileStatus;
}) {
  const sessionToken = await createUserSession({ email, isAdmin: false });
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
      specialties: ["Hatha", "Stretch"],
      serviceAreas: ["Taipei"],
      teachingFormats: ["Group class"],
      status,
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

function createTestEmail(projectName: string, label: string) {
  return `${label}-${normalizeForEmail(projectName)}-${Date.now()}@${testEmailDomain}`;
}

function normalizeForEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
