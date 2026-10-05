import { expect, test } from "@playwright/test";

import { editClassSessionForTeacher } from "../../src/domain/class-session/__internal__/edit-class-session-core-for-teacher";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { formatTaipeiDatetimeLocal } from "../../src/domain/class-session/timezone";
import {
  addAuthSessionCookie,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

// teacher-class-scheduling 票 04：老師改課（單堂）與單場開放報名的 approved 檢查。
const testEmailDomain = "teacher-class-edit-smoke.local";
const createdEmails: string[] = [];
const DAY = 86_400_000;

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.recurringClassSeries.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`);
}

async function seedTeacher(id: string, label: string, status: "approved" | "suspended" = "approved") {
  const email = `teacher-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({ email, displayName: `Teacher ${label}`, status });
}

async function seedMember(id: string, label: string) {
  const email = `member-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);

  return prisma.user.create({ data: { email, name: `Member ${label}` } });
}

async function seedClass(
  teacherProfileId: string,
  overrides: Partial<{
    daysFromNow: number;
    status: "draft" | "open_for_enrollment" | "completed" | "cancelled";
    // 團主開的課（資料庫規定必須有團主與團體資料，所以這裡會一併建立團主）。
    origin: "teacher_initiated" | "organizer_direct";
    recurringClassSeriesId: string | null;
    capacity: number;
    hour: number;
  }> = {},
) {
  const start = new Date(Date.now() + (overrides.daysFromNow ?? 10) * DAY);
  start.setUTCHours((overrides.hour ?? 11) - 8, 0, 0, 0);
  let organizer: { organizerProfileId: string; organizationId: string } | null = null;

  if (overrides.origin === "organizer_direct") {
    const email = `organizer-${normalizeForEmail(`${teacherProfileId}-${Date.now()}`)}@${testEmailDomain}`;
    createdEmails.push(email);
    organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: "團主",
      organizationName: "測試團體",
    });
  }

  return prisma.classSession.create({
    data: {
      origin: overrides.origin ?? "teacher_initiated",
      organizerProfileId: organizer?.organizerProfileId ?? null,
      organizationId: organizer?.organizationId ?? null,
      teacherProfileId,
      recurringClassSeriesId: overrides.recurringClassSeriesId ?? null,
      title: "原本的課名",
      description: "原本的說明",
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      startAt: start,
      endAt: new Date(start.getTime() + 3_600_000),
      location: "台北市原本教室",
      capacity: overrides.capacity ?? 10,
      isPublic: false,
      status: overrides.status ?? "open_for_enrollment",
    },
  });
}

// 依目前這堂課組出改課輸入，再套上要改的欄位。
function editInputFrom(
  classSession: { title: string; startAt: Date; endAt: Date; location: string; capacity: number },
  changes: Partial<{ title: string; startAt: Date; endAt: Date; location: string; capacity: number }> = {},
) {
  const merged = { ...classSession, ...changes };

  return {
    title: merged.title,
    description: "原本的說明",
    serviceTypes: ["放鬆紓壓"],
    yogaStyles: ["哈達瑜伽"],
    startAt: formatTaipeiDatetimeLocal(merged.startAt),
    endAt: formatTaipeiDatetimeLocal(merged.endAt),
    location: merged.location,
    capacity: merged.capacity,
  };
}

async function enroll(classSessionId: string, userId: string, status: "pending" | "confirmed" | "cancelled") {
  return prisma.enrollment.create({
    data: { classSessionId, userId, status, consentedAt: new Date() },
  });
}

test.describe("teacher class edit (domain)", () => {
  test("content-only edits save without notifying; time and location edits notify only active enrollees", async ({}, testInfo) => {
    const id = runId(testInfo, "notify");
    const teacher = await seedTeacher(id, "owner");
    const [confirmed, pending, cancelled] = await Promise.all([
      seedMember(id, "confirmed"),
      seedMember(id, "pending"),
      seedMember(id, "cancelled"),
    ]);
    const classSession = await seedClass(teacher.teacherProfileId);
    await enroll(classSession.id, confirmed.id, "confirmed");
    await enroll(classSession.id, pending.id, "pending");
    await enroll(classSession.id, cancelled.id, "cancelled");

    const contentOnly = await editClassSessionForTeacher(
      teacher.teacherProfileId,
      classSession.id,
      editInputFrom(classSession, { title: "新的課名", capacity: 12 }),
    );
    expect(contentOnly).toMatchObject({ ok: true, notifiedMemberCount: 0 });
    expect(await prisma.notification.count({ where: { type: "class_session_changed", userId: confirmed.id } })).toBe(0);

    const newStart = new Date(classSession.startAt.getTime() + 30 * 60_000);
    const moved = await editClassSessionForTeacher(
      teacher.teacherProfileId,
      classSession.id,
      editInputFrom(classSession, {
        title: "新的課名",
        capacity: 12,
        startAt: newStart,
        endAt: new Date(newStart.getTime() + 3_600_000),
        location: "新北市新教室",
      }),
    );
    expect(moved).toMatchObject({ ok: true, notifiedMemberCount: 2, timeChanged: true, locationChanged: true });

    const saved = await prisma.classSession.findUniqueOrThrow({ where: { id: classSession.id } });
    expect(saved).toMatchObject({ title: "新的課名", capacity: 12, location: "新北市新教室", status: "open_for_enrollment" });
    expect(saved.startAt.getTime()).toBe(newStart.getTime());

    const notices = await prisma.notification.findMany({
      where: { type: "class_session_changed", userId: { in: [confirmed.id, pending.id, cancelled.id] } },
    });
    expect(notices.map((notice) => notice.userId).sort()).toEqual([confirmed.id, pending.id].sort());
    expect(notices[0].body).toContain("「新的課名」有變更：上課時間改為");
    expect(notices[0].body).toContain("地點改為 新北市新教室");
    expect(notices[0].body).toContain("你的報名仍然有效");
    // 報名原樣保留。
    expect(
      await prisma.enrollment.count({ where: { classSessionId: classSession.id, status: { in: ["pending", "confirmed"] } } }),
    ).toBe(2);
  });

  test("rejects a time that overlaps another own class, but moving within its own slot is fine", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "conflict"), "owner");
    const target = await seedClass(teacher.teacherProfileId, { hour: 9 });
    const other = await seedClass(teacher.teacherProfileId, { hour: 14 });

    const overlapping = await editClassSessionForTeacher(
      teacher.teacherProfileId,
      target.id,
      editInputFrom(target, { startAt: other.startAt, endAt: other.endAt }),
    );
    expect(overlapping).toMatchObject({ ok: false, code: "teacher_schedule_conflict" });

    const shifted = await editClassSessionForTeacher(
      teacher.teacherProfileId,
      target.id,
      editInputFrom(target, { endAt: new Date(target.endAt.getTime() + 30 * 60_000) }),
    );
    expect(shifted.ok).toBe(true);
  });

  test("capacity cannot drop below pending + confirmed", async ({}, testInfo) => {
    const id = runId(testInfo, "capacity");
    const teacher = await seedTeacher(id, "owner");
    const classSession = await seedClass(teacher.teacherProfileId, { capacity: 5 });
    for (const label of ["a", "b", "c"]) {
      const member = await seedMember(id, label);
      await enroll(classSession.id, member.id, label === "c" ? "pending" : "confirmed");
    }

    const tooSmall = await editClassSessionForTeacher(
      teacher.teacherProfileId,
      classSession.id,
      editInputFrom(classSession, { capacity: 2 }),
    );
    expect(tooSmall).toMatchObject({ ok: false, code: "capacity_below_enrolled", enrolledCount: 3 });
    const exact = await editClassSessionForTeacher(
      teacher.teacherProfileId,
      classSession.id,
      editInputFrom(classSession, { capacity: 3 }),
    );
    expect(exact.ok).toBe(true);
  });

  test("refuses classes that are not editable, other teachers, and suspended teachers, changing nothing", async ({}, testInfo) => {
    const id = runId(testInfo, "guards");
    const owner = await seedTeacher(id, "owner");
    const other = await seedTeacher(id, "other");
    const suspended = await seedTeacher(id, "suspended", "suspended");
    const cases = [
      { classSession: await seedClass(owner.teacherProfileId, { origin: "organizer_direct", hour: 8 }), code: "class_session_not_editable" },
      { classSession: await seedClass(owner.teacherProfileId, { status: "cancelled", hour: 10 }), code: "class_session_not_editable" },
      { classSession: await seedClass(owner.teacherProfileId, { daysFromNow: -1, hour: 12 }), code: "class_session_already_started" },
    ];

    for (const { classSession, code } of cases) {
      const result = await editClassSessionForTeacher(
        owner.teacherProfileId,
        classSession.id,
        editInputFrom(classSession, { title: "不應該被改" }),
      );
      expect(result).toMatchObject({ ok: false, code });
    }

    const ownerClass = await seedClass(owner.teacherProfileId, { hour: 15 });
    expect(
      await editClassSessionForTeacher(other.teacherProfileId, ownerClass.id, editInputFrom(ownerClass, { title: "不應該被改" })),
    ).toMatchObject({ ok: false, code: "class_session_not_found" });
    const suspendedClass = await seedClass(suspended.teacherProfileId);
    expect(
      await editClassSessionForTeacher(
        suspended.teacherProfileId,
        suspendedClass.id,
        editInputFrom(suspendedClass, { title: "不應該被改" }),
      ),
    ).toMatchObject({ ok: false, code: "teacher_not_approved" });

    expect(
      await prisma.classSession.count({
        where: { teacherProfileId: { in: [owner.teacherProfileId, suspended.teacherProfileId] }, title: "不應該被改" },
      }),
    ).toBe(0);
  });

  test("an edit that lowers capacity and a concurrent enrollment are serialized: no deadlock, no overbooking", async ({}, testInfo) => {
    const id = runId(testInfo, "concurrent");
    const teacher = await seedTeacher(id, "owner");
    const first = await seedMember(id, "first");
    const late = await seedMember(id, "late");
    const classSession = await seedClass(teacher.teacherProfileId, { capacity: 5 });
    await enroll(classSession.id, first.id, "confirmed");

    let releaseEdit: () => void = () => {};
    const editHoldsLock = new Promise<void>((resolve) => {
      const editCall = editClassSessionForTeacher(
        teacher.teacherProfileId,
        classSession.id,
        editInputFrom(classSession, { capacity: 1 }),
        {
          onSessionLockAcquired: () =>
            new Promise<void>((release) => {
              releaseEdit = release;
              resolve();
            }),
        },
      );
      void editCall.then((result) => expect(result.ok).toBe(true));
    });

    await editHoldsLock;
    // 改課還握著這堂課的鎖：報名必須排隊，等改課完成（名額已降為 1）才能判斷。
    const enrollment = createEnrollmentForUser(late.id, classSession.id, { notes: null });
    await new Promise((resolve) => setTimeout(resolve, 300));
    releaseEdit();

    expect(await enrollment).toMatchObject({ ok: false, code: "class_session_full" });
    const saved = await prisma.classSession.findUniqueOrThrow({ where: { id: classSession.id } });
    expect(saved.capacity).toBe(1);
    expect(
      await prisma.enrollment.count({ where: { classSessionId: classSession.id, status: { in: ["pending", "confirmed"] } } }),
    ).toBe(1);
  });
});

test.describe("teacher class edit (UI)", () => {
  test("detail → 修改課程; changing the location with enrollees asks first, then saves and notifies", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui");
    const teacher = await seedTeacher(id, "owner");
    const member = await seedMember(id, "member");
    const classSession = await seedClass(teacher.teacherProfileId);
    await enroll(classSession.id, member.id, "confirmed");

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${classSession.id}`);
    await expect(page.getByText("課程內容建立後目前無法修改")).toHaveCount(0);
    await page.getByRole("link", { name: "修改課程" }).click();
    await expect(page.getByRole("heading", { name: "修改課程" })).toBeVisible();
    await expect(page.locator("#title")).toHaveValue("原本的課名");

    await page.locator("#location").fill("台中市新教室");
    await expect(page.getByRole("region", { name: "儲存前核對" })).toContainText("這次會修改：地點。");
    await page.getByRole("button", { name: "儲存修改" }).click();
    const dialog = page.getByRole("dialog", { name: "改了時間或地點，要通知學員嗎？" });
    await expect(dialog).toContainText("會通知 1 位");
    await dialog.getByRole("button", { name: "先不要" }).click();
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: classSession.id } })).location).toBe(
      "台北市原本教室",
    );

    await page.getByRole("button", { name: "儲存修改" }).click();
    await dialog.getByRole("button", { name: "儲存並通知學員" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${classSession.id}\\?`));
    await expect(page.getByText("課程已更新，已通知 1 位已報名的學員。")).toBeVisible();
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: classSession.id } })).location).toBe(
      "台中市新教室",
    );
    expect(await prisma.notification.count({ where: { userId: member.id, type: "class_session_changed" } })).toBe(1);
  });

  test("a capacity below enrolment stays on the form with the reason; an organizer class shows no edit form", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui-guards");
    const teacher = await seedTeacher(id, "owner");
    const classSession = await seedClass(teacher.teacherProfileId, { hour: 9 });
    for (const label of ["a", "b"]) {
      const member = await seedMember(id, label);
      await enroll(classSession.id, member.id, "confirmed");
    }
    const organizerClass = await seedClass(teacher.teacherProfileId, { origin: "organizer_direct", hour: 15 });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${classSession.id}/edit`);
    await page.locator("#capacity").fill("1");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "課程還沒更新" })).toBeVisible();
    await expect(page.locator("#capacity")).toHaveValue("1");
    await expect(page.getByText("目前已報名（含待確認）2 人，人數上限不能少於 2。").first()).toBeVisible();

    await page.goto(`/teacher/classes/${organizerClass.id}/edit`);
    await expect(page.getByText("這堂課是團主安排的課")).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存修改" })).toHaveCount(0);
    await page.goto(`/teacher/classes/${organizerClass.id}`);
    await expect(page.getByRole("link", { name: "修改課程" })).toHaveCount(0);
  });

  test("a suspended teacher cannot open a draft for enrollment and sees no edit button", async ({ context, page }, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "suspended"), "suspended", "suspended");
    const draft = await seedClass(teacher.teacherProfileId, { status: "draft" });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${draft.id}`);
    await expect(page.getByRole("link", { name: "修改課程" })).toHaveCount(0);
    await page.getByRole("button", { name: "開放報名" }).click();
    await expect(page.getByText("老師資格暫停期間不能開放報名。")).toBeVisible();
    expect((await prisma.classSession.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("draft");
  });
});
