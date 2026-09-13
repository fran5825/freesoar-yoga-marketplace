import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const authCookieName = "authjs.session-token";
const testEmailDomain = "teacher-join-smoke.local";
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

test.describe("/teachers/join smoke", () => {
  test("shows a visitor-facing explainer, not a fillable form, when signed out", async ({
    page,
  }) => {
    await page.goto("/teachers/join");

    await expect(
      page.getByRole("heading", {
        name: "與我們一起建立更清楚、更安心的瑜伽團課合作",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "審核怎麼進行" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "申請前可以先準備這些" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "常見問題" }),
    ).toBeVisible();

    // teacher-join-gated-application：未登入訪客只看得到唯讀導覽內容，不會看到
    // 任何可以送出但送不出去的表單輸入框（G1／Definition of Done）。
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "儲存草稿" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "送出審核" }),
    ).not.toBeVisible();

    const signInCta = page.getByRole("link", {
      name: "登入／建立帳號並開始申請",
    });
    await expect(signInCta).toBeVisible();
    // G3：CTA 帶 callbackUrl，登入完成後導回這一頁，不會掉回 /account。
    await expect(signInCta).toHaveAttribute(
      "href",
      "/sign-in?callbackUrl=%2Fteachers%2Fjoin",
    );
  });

  test("shows teacher application controls and submit confirmation", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const email = `new-teacher-${testRunId}@${testEmailDomain}`;
    const sessionToken = await createSignedInSessionWithoutTeacherProfile({
      email,
    });

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

    await page.goto("/teachers/join");

    await expect(
      page.getByRole("heading", {
        name: "與我們一起建立更清楚、更安心的瑜伽團課合作",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存草稿" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "檢查準備狀態" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "送出審核" }).click();

    await expect(page.getByText("確認送出審核").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "確認送出審核" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "先回來調整" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "先回來調整" }).click();

    await expect(page.getByText("確認送出審核").first()).toBeHidden();
  });

  test("lets rejected teachers edit and resubmit", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const email = `rejected-${testRunId}@${testEmailDomain}`;
    const rejectionReason = `教學經歷需要更具體，請補充帶領團課的實際經驗與時數 ${testRunId}。`;
    const sessionToken = await createRejectedTeacherProfileSession({
      email,
      displayName: `Rejected Teacher ${testRunId}`,
      rejectionReason,
    });

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

    await page.goto("/teachers/join");

    await expect(page.getByText("已退回修正").first()).toBeVisible();
    // Teacher 在 join 頁看得到 Admin 填寫的退回原因。
    await expect(page.getByText("平台的退回說明")).toBeVisible();
    await expect(page.getByText(rejectionReason)).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存修正" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "重新送出審核" }),
    ).toBeVisible();

    const revisedDisplayName = `Revised Teacher ${testRunId}`;

    await page.getByLabel("公開顯示名稱").fill(revisedDisplayName);
    await page.getByRole("button", { name: "重新送出審核" }).click();
    await expect(page.getByText("確認送出審核").first()).toBeVisible();
    await page.getByRole("button", { name: "確認送出審核" }).click();

    await expect(page.getByText("已送出審核").first()).toBeVisible();

    const profile = await prisma.teacherProfile.findFirstOrThrow({
      where: {
        user: {
          email,
        },
      },
      select: {
        displayName: true,
        status: true,
        rejectionReason: true,
      },
    });

    // D4: rejected → submitted 重新送審後，退回原因被清空。
    expect(profile).toEqual({
      displayName: revisedDisplayName,
      status: "submitted",
      rejectionReason: null,
    });
  });
});

// teacher-join-gated-application：一個「已登入、但還沒建立過 TeacherProfile」的老師——
// 資料庫裡完全沒有這個 user 的 TeacherProfile 記錄（不是 status="draft"，是根本不存在），
// 對應到 getInitialTeacherProfileApplicationSnapshotAction() 回傳 null 的那個分支。
async function createSignedInSessionWithoutTeacherProfile({
  email,
}: {
  email: string;
}) {
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

async function createRejectedTeacherProfileSession({
  email,
  displayName,
  rejectionReason = null,
}: {
  email: string;
  displayName: string;
  rejectionReason?: string | null;
}) {
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
      status: "rejected",
      rejectionReason,
    },
  });

  return sessionToken;
}

function normalizeForEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
