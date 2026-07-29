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
    // teacher-profile-suspension 一輪新增了「Suspended teachers」區塊，suspended 老師
    // 現在會正確出現在頁面上（只是不在待審核佇列裡）——改成驗證他不在「Submitted」佇列裡
    // （沒有 Approve/Reject 這類審核按鈕），而不是整頁都看不到。
    const suspendedInReviewQueue = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: `Suspended Teacher ${testRunId}` }),
      hasText: "Approve",
    });
    await expect(suspendedInReviewQueue).toHaveCount(0);

    await submittedApplication.getByRole("button", { name: "Approve" }).click();

    await expect(
      page.getByText("TeacherProfile application approved."),
    ).toBeVisible();
    // 核准後這位老師會正確出現在新的「Approved teachers」區塊（teacher-profile-suspension
    // 一輪新增），不再整頁都看不到——改成驗證他已經離開「Submitted」審核佇列。
    const submittedInReviewQueueAfterApprove = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: `Submitted Teacher ${testRunId}` }),
      hasText: "Approve",
    });
    await expect(submittedInReviewQueueAfterApprove).toHaveCount(0);

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

  test("lets admin reject a submitted application with a required reason", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-reject-${Date.now()}`,
    );
    const adminSessionToken = await createUserSession({
      email: `admin-reject-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    const rejectedEmail = `to-reject-${testRunId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({
      email: rejectedEmail,
      displayName: `Reject Target ${testRunId}`,
      status: "submitted",
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto("/admin/teachers");

    const application = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: `Reject Target ${testRunId}` }),
    });
    await expect(
      application.getByRole("heading", { name: `Reject Target ${testRunId}` }),
    ).toBeVisible();

    await application.locator("summary").click();

    // D3: reason 必填 —— native required 會擋住空白送出，卡片仍在 queue。
    await application.getByRole("button", { name: "確認退回" }).click();
    await expect(
      application.getByRole("heading", { name: `Reject Target ${testRunId}` }),
    ).toBeVisible();

    // 前後空白應在持久化前被 trim（D3）。
    const reason =
      "  教學經歷需要更具體，請補充帶領團課的實際經驗與時數，方便後續媒合。  ";
    await application.getByLabel("退回原因").fill(reason);
    await application.getByRole("checkbox").check();
    await application.getByRole("button", { name: "確認退回" }).click();

    await expect(
      page.getByText("TeacherProfile application rejected."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `Reject Target ${testRunId}` }),
    ).toBeHidden();

    const rejectedProfile = await prisma.teacherProfile.findFirstOrThrow({
      where: { user: { email: rejectedEmail } },
      select: { status: true, rejectionReason: true },
    });

    expect(rejectedProfile.status).toBe("rejected");
    expect(rejectedProfile.rejectionReason).toBe(reason.trim());
  });

  test("clears rejectionReason when an application is approved", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-approve-clear-${Date.now()}`,
    );
    const adminSessionToken = await createUserSession({
      email: `admin-approve-clear-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    const email = `approve-clear-${testRunId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({
      email,
      displayName: `Approve Clear ${testRunId}`,
      status: "submitted",
      rejectionReason: "舊的退回原因，approve 後應被清空。",
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto("/admin/teachers");

    const application = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: `Approve Clear ${testRunId}` }),
    });
    await application.getByRole("button", { name: "Approve" }).click();

    await expect(
      page.getByText("TeacherProfile application approved."),
    ).toBeVisible();

    const profile = await prisma.teacherProfile.findFirstOrThrow({
      where: { user: { email } },
      select: { status: true, rejectionReason: true },
    });

    expect(profile.status).toBe("approved");
    expect(profile.rejectionReason).toBeNull();
  });

  test("overwrites an existing reason when rejecting again", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-rereject-${Date.now()}`,
    );
    const adminSessionToken = await createUserSession({
      email: `admin-rereject-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    const email = `rereject-${testRunId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({
      email,
      displayName: `Re-reject ${testRunId}`,
      status: "submitted",
      rejectionReason: "第一次的退回原因 A，應被覆蓋。",
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto("/admin/teachers");

    const application = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: `Re-reject ${testRunId}` }),
    });
    await application.locator("summary").click();

    const newReason =
      "第二次的退回原因 B，請補充教學時數與實際帶團經歷，方便判斷適合的團課。";
    await application.getByLabel("退回原因").fill(newReason);
    await application.getByRole("checkbox").check();
    await application.getByRole("button", { name: "確認退回" }).click();

    await expect(
      page.getByText("TeacherProfile application rejected."),
    ).toBeVisible();

    const profile = await prisma.teacherProfile.findFirstOrThrow({
      where: { user: { email } },
      select: { status: true, rejectionReason: true },
    });

    expect(profile.status).toBe("rejected");
    expect(profile.rejectionReason).toBe(newReason);
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
  rejectionReason = null,
}: {
  email: string;
  displayName: string;
  status: TeacherProfileStatus;
  rejectionReason?: string | null;
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

function createTestEmail(projectName: string, label: string) {
  return `${label}-${normalizeForEmail(projectName)}-${Date.now()}@${testEmailDomain}`;
}

function normalizeForEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
