import { expect, test } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { buildTeacherTodoItems } from "../../src/domain/class-session/teacher-next-step";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createDemandResponse,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { futureDateTime } from "./_helpers/future-dates";

// teacher-usability 第 08、09 票：老師總覽「待你處理」。

const testEmailDomain = "teacher-dashboard-todo-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test.describe("buildTeacherTodoItems (pure function)", () => {
  const now = new Date("2027-03-01T12:00:00+08:00");
  const later = new Date("2027-03-10T10:00:00+08:00");
  const earlier = new Date("2027-02-20T10:00:00+08:00");
  const base = { origin: "teacher_initiated" as const, enrollments: [] as { status: string }[] };

  test("orders items: pending enrollments, then awaiting class (waiting), then ended, then drafts; skips non-action classes", () => {
    const items = buildTeacherTodoItems({
      now,
      classSessions: [
        { ...base, id: "draft", title: "草稿課", status: "draft", startAt: later, endAt: later },
        { ...base, id: "ended", title: "結束課", status: "open_for_enrollment", startAt: earlier, endAt: earlier },
        {
          ...base,
          id: "pending",
          title: "待確認課",
          status: "open_for_enrollment",
          startAt: later,
          endAt: later,
          enrollments: [{ status: "pending" }, { status: "confirmed" }],
        },
        { ...base, id: "open", title: "正常課", status: "open_for_enrollment", startAt: later, endAt: later },
        {
          ...base,
          id: "matched-ended",
          title: "團主課",
          origin: "organizer_matched",
          status: "open_for_enrollment",
          startAt: earlier,
          endAt: earlier,
        },
      ],
      selectedResponsesAwaitingClass: [{ demandRequestId: "d1", demandTitle: "公司午休瑜伽" }],
    });

    expect(items.map((item) => item.href)).toEqual([
      "/teacher/classes/pending",
      "/teacher/demands/d1",
      "/teacher/classes/ended",
      "/teacher/classes/draft",
    ]);
    expect(items.map((item) => item.kind)).toEqual(["action", "waiting", "action", "action"]);
    expect(items[1].label).toBe("等待團主建立課程");
  });
});

test.describe("teacher dashboard todo list", () => {
  test("shows a pending enrollment and a selected-awaiting-class response, each linking to the right page", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-todo-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail);
    const teacher = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    // ① 一堂需要確認報名的課，有一筆待確認報名。
    const validation = validateClassSessionCreate(
      {
        title: `待確認報名課 ${testRunId}`,
        serviceTypes: ["放鬆紓壓"],
        yogaStyles: ["陰瑜珈"],
        startAt: futureDateTime(90, "10:00"),
        endAt: futureDateTime(90, "11:00"),
        location: "台北市測試教室",
        capacity: 10,
        isPublic: false,
      },
      { requireYogaStyles: true },
    );
    if (!validation.valid) throw new Error("unexpected invalid input in test fixture");
    const created = await createClassSessionForTeacher(teacher.teacherProfileId, {
      ...validation.normalized,
      requiresApproval: true,
    });
    if (!created.ok) throw new Error("unexpected create failure in test fixture");
    await prisma.classSession.update({
      where: { id: created.classSessionId },
      data: { status: "open_for_enrollment" },
    });
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { userId } = await createUserSession({ email: memberEmail });
    await prisma.enrollment.create({
      data: { userId, classSessionId: created.classSessionId, status: "pending", consentedAt: new Date() },
    });

    // ② 團主已選定這位老師、還沒建立課程。
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);
    const { organizerProfileId, organizationId } = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `已選定需求 ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      status: "selected",
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/dashboard");

    const todo = page.getByRole("region", { name: "待你處理" });
    await expect(todo).toBeVisible();
    const links = todo.getByRole("link").filter({ hasNotText: "看全部課程" });
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute("href", `/teacher/classes/${created.classSessionId}`);
    await expect(links.nth(0)).toContainText("1 筆報名待確認");
    await expect(links.nth(1)).toHaveAttribute("href", `/teacher/demands/${demand.id}`);
    await expect(links.nth(1)).toContainText("等待團主建立課程");
    await expect(links.nth(1)).toContainText(`已選定需求 ${testRunId}`);

    await links.nth(0).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${created.classSessionId}$`));
    await expect(page.getByText("待確認報名（1 人）")).toBeVisible();
  });
});
