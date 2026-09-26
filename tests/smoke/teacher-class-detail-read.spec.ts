import { expect, test } from "@playwright/test";

import { getClassSessionDetailForTeacherUser } from "../../src/domain/class-session/__internal__/class-session-detail-core-for-teacher";
import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
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

// teacher-usability 第 05 票（HEAVY，產品主人已放行範圍）：老師只能讀自己的單堂課詳情。
// 直接呼叫不依賴登入狀態的核心函式驗證權限邏輯；未登入的 requireUser() 檢查在外層函式，
// 與其他 own-scoped 讀取函式一致。

const testEmailDomain = "teacher-class-detail-read-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

const baseInput = {
  title: "詳情讀取測試課程",
  description: "測試用課程說明。",
  serviceType: "伸展與身體保養",
  location: "台北市信義區測試教室",
  capacity: 20,
  isPublic: true,
};

function normalizedInput(startAt: string, endAt: string) {
  const validation = validateClassSessionCreate({ ...baseInput, startAt, endAt });
  if (!validation.valid) throw new Error("unexpected invalid input in test fixture");
  return validation.normalized;
}

async function seedTeacher(
  testRunId: string,
  label: string,
  status: "approved" | "suspended" = "approved",
) {
  const email = `${label}-${testRunId}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({
    email,
    displayName: `Teacher ${label} ${testRunId}`,
    status,
  });
}

async function createTeacherClass(teacherProfileId: string, daysFromToday: number) {
  const created = await createClassSessionForTeacher(
    teacherProfileId,
    normalizedInput(
      futureDateTime(daysFromToday, "10:00"),
      futureDateTime(daysFromToday, "11:00"),
    ),
  );
  if (!created.ok) throw new Error("unexpected create failure in test fixture");
  return created.classSessionId;
}

test.describe("getClassSessionDetailForTeacherUser (own-scoped read, no UI)", () => {
  test("returns the class to its own teacher with only confirmed/pending enrollments and no phone or image", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-own-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId, "owner");
    const classSessionId = await createTeacherClass(teacher.teacherProfileId, 60);

    const statuses = ["confirmed", "pending", "cancelled", "attended", "no_show"] as const;
    for (const status of statuses) {
      const memberEmail = `member-${status}-${testRunId}@${testEmailDomain}`;
      createdEmails.push(memberEmail);
      const { userId } = await createUserSession({ email: memberEmail });
      await prisma.user.update({
        where: { id: userId },
        data: { phone: "0912-345-678", name: `Member ${status}` },
      });
      await prisma.enrollment.create({
        data: { userId, classSessionId, status, consentedAt: new Date(), notes: `note-${status}` },
      });
    }

    const detail = await getClassSessionDetailForTeacherUser(teacher.userId, classSessionId);

    expect(detail).not.toBeNull();
    expect(detail?.id).toBe(classSessionId);
    expect(detail?.title).toBe(baseInput.title);
    // 只含 confirmed／pending，已取消、已出席、未出席的不含（與老師列表頁一致）。
    expect(detail?.enrollments.map((enrollment) => enrollment.status).sort()).toEqual([
      "confirmed",
      "pending",
    ]);
    // 學員電話與頭像不在可讀欄位內。
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("0912-345-678");
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain("image");
  });

  test("returns null for another teacher's class and for a nonexistent id, indistinguishably", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-other-${Date.now()}`,
    );
    const owner = await seedTeacher(testRunId, "owner");
    const intruder = await seedTeacher(testRunId, "intruder");
    const classSessionId = await createTeacherClass(owner.teacherProfileId, 61);

    expect(await getClassSessionDetailForTeacherUser(owner.userId, classSessionId)).not.toBeNull();
    expect(await getClassSessionDetailForTeacherUser(intruder.userId, classSessionId)).toBeNull();
    expect(
      await getClassSessionDetailForTeacherUser(owner.userId, "nonexistent-class-session-id"),
    ).toBeNull();
  });

  test("returns null for a signed-in user with no teacher profile", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-noprofile-${Date.now()}`,
    );
    const owner = await seedTeacher(testRunId, "owner");
    const classSessionId = await createTeacherClass(owner.teacherProfileId, 62);

    const plainEmail = `plain-${testRunId}@${testEmailDomain}`;
    createdEmails.push(plainEmail);
    const { userId: plainUserId } = await createUserSession({ email: plainEmail });

    expect(await getClassSessionDetailForTeacherUser(plainUserId, classSessionId)).toBeNull();
  });

  test("a suspended teacher can still view their own existing class", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-suspended-${Date.now()}`,
    );
    const teacher = await seedTeacher(testRunId, "owner");
    const classSessionId = await createTeacherClass(teacher.teacherProfileId, 63);

    await prisma.teacherProfile.update({
      where: { id: teacher.teacherProfileId },
      data: { status: "suspended" },
    });

    const detail = await getClassSessionDetailForTeacherUser(teacher.userId, classSessionId);
    expect(detail?.id).toBe(classSessionId);
  });

  test("an organizer-matched class is readable by its teacher, exposing only the organization name and no organizer contact details", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-matched-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);
    const { organizerProfileId, organizationId } = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });
    const teacher = await seedTeacher(testRunId, "owner");
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacher.teacherProfileId,
      status: "selected",
    });
    const created = await createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      normalizedInput(futureDateTime(64, "10:00"), futureDateTime(64, "11:00")),
    );
    if (!created.ok) throw new Error("unexpected create failure in test fixture");

    const detail = await getClassSessionDetailForTeacherUser(
      teacher.userId,
      created.classSessionId,
    );

    expect(detail?.organization).toEqual({ name: `Org ${testRunId}` });
    expect(detail?.origin).toBe("organizer_matched");
    expect(JSON.stringify(detail)).not.toContain(organizerEmail);
  });
});
