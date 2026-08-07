import { expect, test } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import { sanitizeCallbackUrl } from "../../src/lib/auth/callback-url";
import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "public-classes-discovery-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.recurringClassSeries.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedApprovedTeacher(testRunId: string) {
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(teacherEmail);
  return createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: "approved",
  });
}

async function seedPublicClassSession({
  testRunId,
  teacherProfileId,
  title,
  serviceType = "Hatha Yoga",
  startAt = "2026-11-02T14:00",
  endAt = "2026-11-02T15:00",
  isPublic = true,
  status = "open_for_enrollment" as const,
}: {
  testRunId: string;
  teacherProfileId: string;
  title: string;
  serviceType?: string;
  startAt?: string;
  endAt?: string;
  isPublic?: boolean;
  status?: "draft" | "open_for_enrollment" | "cancelled" | "completed";
}) {
  const validation = validateClassSessionCreate({
    title,
    serviceType,
    startAt,
    endAt,
    location: `Test Studio ${testRunId}`,
    capacity: 10,
    isPublic,
  });
  if (!validation.valid) throw new Error("unexpected invalid input in test fixture");

  const created = await createClassSessionForTeacher(teacherProfileId, validation.normalized);
  if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);

  if (status !== "draft") {
    await prisma.classSession.update({
      where: { id: created.classSessionId },
      data: { status },
    });
  }

  return created.classSessionId;
}

test.describe("sanitizeCallbackUrl (direct, no UI)", () => {
  test("accepts relative in-site paths, rejects protocol-relative and absolute external URLs", () => {
    expect(sanitizeCallbackUrl("/classes/abc123")).toBe("/classes/abc123");
    expect(sanitizeCallbackUrl(undefined)).toBeNull();
    expect(sanitizeCallbackUrl(null)).toBeNull();
    expect(sanitizeCallbackUrl("")).toBeNull();
    expect(sanitizeCallbackUrl("//evil.example.com")).toBeNull();
    expect(sanitizeCallbackUrl("https://evil.example.com")).toBeNull();
    expect(sanitizeCallbackUrl("evil.example.com")).toBeNull();
  });
});

test.describe("public classes discovery smoke", () => {
  test("an unauthenticated visitor can view a public, open, approved-teacher class session's detail without an enrollment form, and is offered a login link back to the same page", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-visitor-detail-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const classSessionId = await seedPublicClassSession({
      testRunId,
      teacherProfileId: teacher.teacherProfileId,
      title: `Public Class ${testRunId}`,
    });

    const response = await page.goto(`/classes/${classSessionId}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: `Public Class ${testRunId}` })).toBeVisible();
    await expect(page.getByText(`Teacher ${testRunId}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "確認報名" })).toBeHidden();
    await expect(page.getByLabel("備註（選填）")).toBeHidden();

    const loginLink = page.getByRole("link", { name: "登入後報名" });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute(
      "href",
      `/sign-in?callbackUrl=${encodeURIComponent(`/classes/${classSessionId}`)}`,
    );
  });

  test("a visitor gets not-found (no existence leak) for a non-public class, a draft class, and a class taught by a suspended teacher, even though the last one is otherwise open_for_enrollment and isPublic=true", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-visitor-404-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    // 同一位老師底下的兩堂課，時段必須錯開，否則會撞上 conflict-check（跟本測試要驗證的
    // 主題無關的另一個既有規則）。
    const privateClassId = await seedPublicClassSession({
      testRunId: `${testRunId}-private`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Private Class ${testRunId}`,
      isPublic: false,
      startAt: "2026-11-02T14:00",
      endAt: "2026-11-02T15:00",
    });
    const draftClassId = await seedPublicClassSession({
      testRunId: `${testRunId}-draft`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Draft Class ${testRunId}`,
      status: "draft",
      startAt: "2026-11-02T16:00",
      endAt: "2026-11-02T17:00",
    });

    const suspendedTeacher = await seedApprovedTeacher(`${testRunId}-suspended`);
    const suspendedTeacherClassId = await seedPublicClassSession({
      testRunId: `${testRunId}-suspended`,
      teacherProfileId: suspendedTeacher.teacherProfileId,
      title: `Suspended Teacher Class ${testRunId}`,
    });
    await prisma.teacherProfile.update({
      where: { id: suspendedTeacher.teacherProfileId },
      data: { status: "suspended" },
    });

    for (const classSessionId of [privateClassId, draftClassId, suspendedTeacherClassId]) {
      const response = await page.goto(`/classes/${classSessionId}`);
      expect(response?.status()).toBe(404);
    }
  });

  test("a signed-in member visiting the same class session URL still gets the existing member experience (enrollment form, three-state ownEnrollment), unaffected by the visitor branch", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-member-unaffected-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const classSessionId = await seedPublicClassSession({
      testRunId,
      teacherProfileId: teacher.teacherProfileId,
      title: `Member Class ${testRunId}`,
    });

    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { sessionToken } = await createUserSession({ email: memberEmail });

    await addAuthSessionCookie(context, sessionToken);
    const response = await page.goto(`/classes/${classSessionId}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: `Member Class ${testRunId}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "確認報名" })).toBeVisible();
    await expect(page.getByRole("link", { name: "登入後報名" })).toBeHidden();
  });

  test("/classes public list only shows qualifying sessions, and the serviceType/dayOfWeek filters narrow correctly for both single classes and recurring-series occurrences", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-list-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await seedPublicClassSession({
      testRunId: `${testRunId}-hatha`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Hatha Public ${testRunId}`,
      serviceType: "Hatha Yoga",
      startAt: "2026-11-02T14:00", // 2026-11-02 是星期一
      endAt: "2026-11-02T15:00",
    });

    // 非公開課程：不該出現在列表。時段跟上面那堂錯開，避免撞上跟本測試主題無關的
    // conflict-check。
    await seedPublicClassSession({
      testRunId: `${testRunId}-private`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Private ${testRunId}`,
      isPublic: false,
      startAt: "2026-11-02T16:00",
      endAt: "2026-11-02T17:00",
    });

    // 常規課程系列生成的場次：星期幾篩選要吃 series.dayOfWeek，不是從 startAt 推算。
    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        title: `Vinyasa Series ${testRunId}`,
        serviceType: "Vinyasa Flow",
        dayOfWeek: 3, // 星期三
        startTime: "18:00",
        endTime: "19:00",
        location: "Series Studio",
        capacity: 10,
      },
    });
    const generated = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(3, 1),
    );
    if (!generated.ok) throw new Error("unexpected error in test fixture");
    await prisma.classSession.updateMany({
      where: { id: { in: generated.createdClassSessionIds } },
      data: { status: "open_for_enrollment", isPublic: true },
    });

    await page.goto("/classes");
    await expect(page.getByText(`Hatha Public ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Vinyasa Series ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Private ${testRunId}`)).toBeHidden();

    await page.goto("/classes?serviceType=Hatha+Yoga");
    await expect(page.getByText(`Hatha Public ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Vinyasa Series ${testRunId}`)).toBeHidden();

    // 星期一（dayOfWeek=1）：只有單堂那個吃 startAt 推算命中，常規系列（星期三）不該出現。
    await page.goto("/classes?dayOfWeek=1");
    await expect(page.getByText(`Hatha Public ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Vinyasa Series ${testRunId}`)).toBeHidden();

    // 星期三（dayOfWeek=3）：只有常規系列那場吃 series.dayOfWeek 命中。
    await page.goto("/classes?dayOfWeek=3");
    await expect(page.getByText(`Hatha Public ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Vinyasa Series ${testRunId}`)).toBeVisible();

    await page.goto("/classes");
    await page.getByText(`Hatha Public ${testRunId}`).click();
    await expect(page.getByRole("heading", { name: `Hatha Public ${testRunId}` })).toBeVisible();
  });

  test("/classes excludes a suspended teacher's otherwise-qualifying public class", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-list-suspended-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    await seedPublicClassSession({
      testRunId,
      teacherProfileId: teacher.teacherProfileId,
      title: `Should Be Hidden ${testRunId}`,
    });
    await prisma.teacherProfile.update({
      where: { id: teacher.teacherProfileId },
      data: { status: "suspended" },
    });

    await page.goto("/classes");
    await expect(page.getByText(`Should Be Hidden ${testRunId}`)).toBeHidden();
  });
});
