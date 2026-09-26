import { PrismaClient, type TeacherProfileStatus } from "@prisma/client";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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

// 從老師列表點進某位老師的詳情頁（票 06：審核操作都在詳情頁）。
async function openTeacherFromList(page: Page, displayName: string, tab?: string) {
  await page.goto(tab ? `/admin/teachers?status=${tab}` : "/admin/teachers");
  await page.getByRole("link").filter({ hasText: displayName }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: displayName })).toBeVisible();
}

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

  test("teacher detail page: 404 for non-admin and for drafts, results only for rejected, filter tabs split by status", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-detail-${Date.now()}`,
    );
    const emailOf = (label: string) => `${label}-${testRunId}@${testEmailDomain}`;
    const idOf = async (label: string) =>
      (
        await prisma.teacherProfile.findFirstOrThrow({
          where: { user: { email: emailOf(label) } },
          select: { id: true },
        })
      ).id;

    await createTeacherProfileWithSession({
      email: emailOf("draft"),
      displayName: `Detail Draft ${testRunId}`,
      status: "draft",
    });
    await createTeacherProfileWithSession({
      email: emailOf("rejected"),
      displayName: `Detail Rejected ${testRunId}`,
      status: "rejected",
      rejectionReason: "教學經歷需要更具體，請補充後重新送審。",
    });
    await createTeacherProfileWithSession({
      email: emailOf("approved"),
      displayName: `Detail Approved ${testRunId}`,
      status: "approved",
    });
    const draftId = await idOf("draft");
    const rejectedId = await idOf("rejected");

    // 非管理員：404。
    const nonAdminToken = await createUserSession({ email: emailOf("plain"), isAdmin: false });
    await addAuthSessionCookie(context, nonAdminToken);
    const forbidden = await page.goto(`/admin/teachers/${rejectedId}`);
    expect(forbidden?.status()).toBe(404);

    await context.clearCookies();
    await addAuthSessionCookie(
      context,
      await createUserSession({ email: emailOf("admin"), isAdmin: true }),
    );

    // 草稿是老師私人資料，管理員也看不到。
    const draftResponse = await page.goto(`/admin/teachers/${draftId}`);
    expect(draftResponse?.status()).toBe(404);
    const missingResponse = await page.goto("/admin/teachers/does-not-exist");
    expect(missingResponse?.status()).toBe(404);

    // 已退回：只顯示結果與退回原因，沒有審核按鈕。
    await page.goto(`/admin/teachers/${rejectedId}`);
    await expect(page.getByRole("heading", { name: "這份申請已退回" })).toBeVisible();
    await expect(page.getByText("退回原因：教學經歷需要更具體，請補充後重新送審。")).toBeVisible();
    await expect(page.getByRole("button", { name: "通過申請" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "退回申請" })).toHaveCount(0);

    // 篩選分頁：已通過的只在「已通過」與「全部」，不在預設「待審」。
    await page.goto("/admin/teachers");
    await expect(page.getByText(`Detail Approved ${testRunId}`)).toBeHidden();
    await page.goto("/admin/teachers?status=approved");
    await expect(page.getByText(`Detail Approved ${testRunId}`)).toBeVisible();
    await expect(page.getByRole("link", { name: /已通過・\d+/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goto("/admin/teachers?status=all");
    await expect(page.getByText(`Detail Approved ${testRunId}`)).toBeVisible();
    // 草稿、已退回不在任何分頁。
    await expect(page.getByText(`Detail Draft ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Detail Rejected ${testRunId}`)).toBeHidden();
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
    await expect(page.getByRole("heading", { name: "老師審核", level: 1 })).toBeVisible();
    // 預設停在「待審」：待審核的老師在，草稿、已退回、已暫停的不在。
    await expect(
      page.getByRole("link", { name: new RegExp(`Submitted Teacher ${testRunId}`) }),
    ).toBeVisible();
    await expect(page.getByText(`Draft Teacher ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Rejected Teacher ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Suspended Teacher ${testRunId}`)).toBeHidden();

    // 已暫停的老師在「已暫停」分頁，進詳情頁看得到恢復、看不到審核按鈕。
    await openTeacherFromList(page, `Suspended Teacher ${testRunId}`, "suspended");
    await expect(page.getByRole("button", { name: "恢復這位老師" })).toBeVisible();
    await expect(page.getByRole("button", { name: "通過申請" })).toHaveCount(0);

    await openTeacherFromList(page, `Submitted Teacher ${testRunId}`);
    await page.getByRole("button", { name: "通過申請" }).click();

    // 審核完回到列表（停在待審）並顯示成功提示，這位老師已離開待審。
    await expect(page).toHaveURL(/\/admin\/teachers\?result=success/);
    await expect(page.getByText("已通過這位老師的申請。")).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(`Submitted Teacher ${testRunId}`) }),
    ).toHaveCount(0);

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

    // 已通過審核的老師開申請頁，會直接被導到老師總覽。
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);
    await expect(page.getByText("已核准", { exact: true }).first()).toBeVisible();
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
    await openTeacherFromList(page, `Reject Target ${testRunId}`);

    // D3: reason 必填 —— native required 會擋住空白送出，仍停在詳情頁。
    await page.getByRole("button", { name: "退回申請" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: `Reject Target ${testRunId}` }),
    ).toBeVisible();

    // 前後空白應在持久化前被 trim（D3）。
    const reason =
      "  教學經歷需要更具體，請補充帶領團課的實際經驗與時數，方便後續媒合。  ";
    await page.getByLabel("退回原因").fill(reason);
    await page.getByRole("button", { name: "退回申請" }).click();

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/admin/teachers" &&
        url.searchParams.get("result") === "success" &&
        url.searchParams.get("message") ===
          "已退回這位老師的申請，退回原因會顯示給老師。",
      { timeout: 15_000 },
    );
    await expect(
      page.getByText("已退回這位老師的申請，退回原因會顯示給老師。"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(`Reject Target ${testRunId}`) }),
    ).toHaveCount(0);

    const rejectedProfile = await prisma.teacherProfile.findFirstOrThrow({
      where: { user: { email: rejectedEmail } },
      select: { status: true, rejectionReason: true },
    });

    expect(rejectedProfile.status).toBe("rejected");
    expect(rejectedProfile.rejectionReason).toBe(reason.trim());
  });

  test("fills the rejection reason from a common-reason template, which can still be edited", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-template-${Date.now()}`,
    );
    const email = `teacher-template-${testRunId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({
      email,
      displayName: `Template Target ${testRunId}`,
      status: "submitted",
    });
    const adminSessionToken = await createUserSession({
      email: `admin-template-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSessionToken);

    await openTeacherFromList(page, `Template Target ${testRunId}`);

    const reasonField = page.getByLabel("退回原因");
    await expect(reasonField).toHaveValue("");
    await page.getByRole("button", { name: "教學經歷不夠具體" }).click();
    await expect(reasonField).toHaveValue(/教學經歷需要更具體/);
    await expect(page.getByText(/已輸入 \d+ 字（10–1000 字）/)).toBeVisible();

    // 帶入後仍可修改。
    const edited = "教學經歷需要更具體，另外請附上最近一年帶團的實際紀錄。";
    await reasonField.fill(edited);
    await page.getByRole("button", { name: "退回申請" }).click();

    await expect
      .poll(async () =>
        prisma.teacherProfile.findFirst({
          where: { user: { email } },
          select: { status: true, rejectionReason: true },
        }),
      )
      .toEqual({ status: "rejected", rejectionReason: edited });
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
    await openTeacherFromList(page, `Approve Clear ${testRunId}`);
    await page.getByRole("button", { name: "通過申請" }).click();

    await expect(page.getByText("已通過這位老師的申請。")).toBeVisible();

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
    await openTeacherFromList(page, `Re-reject ${testRunId}`);

    const newReason =
      "第二次的退回原因 B，請補充教學時數與實際帶團經歷，方便判斷適合的團課。";
    await page.getByLabel("退回原因").fill(newReason);
    await page.getByRole("button", { name: "退回申請" }).click();

    await expect(
      page.getByText("已退回這位老師的申請，退回原因會顯示給老師。"),
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
