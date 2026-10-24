import { expect, test } from "@playwright/test";

import { createTeacherProfileWithSession, cleanupDemandResponseFixtures } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// teacher-first-run 票 06：需求經管理員核准公開時，所有已通過審核的老師收到站內通知（發起團主本人除外），
// 點了到老師的「團體需求」頁；導覽列也改叫「團體需求」。
const testEmailDomain = "teacher-demand-available-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.session.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

test("publishing a demand notifies every approved teacher except the organizer who posted it", async ({ context, page }, testInfo) => {
  const id = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-available-${Date.now()}`);
  const email = (label: string) => {
    const value = `${label}-${id}@${testEmailDomain}`;
    createdEmails.push(value);
    return value;
  };

  const approved = await createTeacherProfileWithSession({ email: email("approved"), displayName: `Approved ${id}`, status: "approved" });
  const others = await Promise.all(
    (["suspended", "submitted", "rejected", "draft"] as const).map((status) =>
      createTeacherProfileWithSession({ email: email(status), displayName: `${status} ${id}`, status }),
    ),
  );

  // 發起的團主本人也是已通過的老師。
  const organizer = await createOrganizerProfileWithOrganization({
    email: email("organizer"),
    displayName: `Organizer ${id}`,
    organizationName: `Org ${id}`,
  });
  await prisma.teacherProfile.create({
    data: {
      userId: organizer.userId,
      displayName: `Organizer Teacher ${id}`,
      bio: "bio",
      teachingStyle: "steady",
      experienceYears: 3,
      specialties: ["Hatha Yoga"],
      serviceAreas: ["Hsinchu"],
      teachingFormats: ["Group class"],
      status: "approved",
    },
  });

  const demandTitle = `新需求通知 ${id}`;
  const demand = await createDemandRequest({
    organizerProfileId: organizer.organizerProfileId,
    organizationId: organizer.organizationId,
    status: "submitted",
    data: completeDemandRequestData({ title: demandTitle }),
  });

  const admin = await createUserSession({ email: email("admin"), isAdmin: true });
  await addAuthSessionCookie(context, admin.sessionToken);
  await page.goto(`/admin/demands/${demand.id}`);
  await page.getByRole("button", { name: "公開需求" }).click();
  await expect(page.getByText("需求已公開。")).toBeVisible();

  const available = await prisma.notification.findMany({
    where: { type: "demand_request_available", body: { contains: demandTitle }, channel: "in_app" },
  });
  // 這筆需求只發給本測試裡唯一的 approved 老師（以及其他平行測試留下的 approved 老師），不發給其他狀態或團主本人。
  const recipients = new Set(available.map((n) => n.userId));
  expect(recipients.has(approved.userId)).toBe(true);
  expect(available.filter((n) => n.userId === approved.userId)).toHaveLength(1);
  for (const other of others) {
    expect(recipients.has(other.userId)).toBe(false);
  }
  expect(recipients.has(organizer.userId)).toBe(false);
  expect(await prisma.notification.count({ where: { userId: organizer.userId, type: "demand_request_published" } })).toBe(1);
  // 只發站內，不寄 email。
  expect(await prisma.notification.count({ where: { type: "demand_request_available", channel: "email", body: { contains: demandTitle } } })).toBe(0);

  await context.clearCookies();
  await addAuthSessionCookie(context, approved.sessionToken);
  await page.goto("/teacher/notifications");
  const card = page.getByRole("article").filter({ hasText: demandTitle });
  await expect(card).toContainText("有新的團體需求");
  await card.getByRole("link", { name: /前往團體需求/ }).click();
  await expect(page).toHaveURL(/\/teacher\/demands$/);
  await expect(page.getByRole("heading", { level: 1, name: "團體需求" })).toBeVisible();
  await expect(page.getByRole("link", { name: "需求池" })).toHaveCount(0);
  await page.goto(`/teacher/demands/${demand.id}`);
  await expect(page.getByRole("heading", { name: demandTitle })).toBeVisible();
});
