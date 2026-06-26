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
  test("shows teacher application controls and submit confirmation", async ({
    page,
  }) => {
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
    const sessionToken = await createRejectedTeacherProfileSession({
      email,
      displayName: `Rejected Teacher ${testRunId}`,
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
      },
    });

    expect(profile).toEqual({
      displayName: revisedDisplayName,
      status: "submitted",
    });
  });
});

async function createRejectedTeacherProfileSession({
  email,
  displayName,
}: {
  email: string;
  displayName: string;
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
    },
  });

  return sessionToken;
}

function normalizeForEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
