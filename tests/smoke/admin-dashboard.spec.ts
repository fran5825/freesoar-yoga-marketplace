import { Prisma } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { getAdminDashboardKpisCore } from "../../src/domain/admin/__internal__/dashboard-kpis-core";
import {
  addAuthSessionCookie,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "admin-dashboard-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

// D9 最終版：這兩個邊界案例整段包在 REPEATABLE READ transaction 內，baseline 與 after 都
// 直接呼叫真正的 getAdminDashboardKpisCore(tx)，中間用同一個 tx 建立 fixture。這個隔離等級
// 保證這個 transaction 看不到任何其他 transaction 之後才 commit 的變更（無論是其他平行測試
// worker 的新增、刪除還是狀態轉換），因此觀察到的差值精確等於這個測試自己的貢獻，不受
// npm run test:smoke 用 chromium-desktop/chromium-mobile 平行執行的影響。
test.describe("admin dashboard smoke", () => {
  test("blocks non-admin sessions from /admin/dashboard", async ({ context, page }, testInfo) => {
    const email = `non-admin-${normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    )}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email, isAdmin: false });
    await addAuthSessionCookie(context, sessionToken);

    const response = await page.goto("/admin/dashboard");
    expect(response?.status()).toBe(404);
  });

  test("D1: matched demand requests count excludes converted_to_class", async ({}, testInfo) => {
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

    await prisma.$transaction(
      async (tx) => {
        const before = await getAdminDashboardKpisCore(tx);

        await tx.demandRequest.create({
          data: {
            organizerProfileId,
            organizationId,
            title: `Matched ${testRunId}`,
            status: "matched",
          },
        });
        await tx.demandRequest.create({
          data: {
            organizerProfileId,
            organizationId,
            title: `Converted ${testRunId}`,
            status: "converted_to_class",
          },
        });

        const after = await getAdminDashboardKpisCore(tx);

        expect(after.matchedDemandRequests - before.matchedDemandRequests).toBe(1);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  });

  test("D1: upcoming class sessions count excludes open_for_enrollment sessions whose startAt has already passed", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-upcoming-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherEmail);

    const { organizerProfileId, organizationId } = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });
    const teacher = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    const futureDemand = await prisma.demandRequest.create({
      data: {
        organizerProfileId,
        organizationId,
        title: `Future demand ${testRunId}`,
        status: "converted_to_class",
      },
    });
    const pastDemand = await prisma.demandRequest.create({
      data: {
        organizerProfileId,
        organizationId,
        title: `Past demand ${testRunId}`,
        status: "converted_to_class",
      },
    });

    await prisma.$transaction(
      async (tx) => {
        const before = await getAdminDashboardKpisCore(tx);

        const futureStartAt = new Date(Date.now() + 3600_000);
        await tx.classSession.create({
          data: {
            demandRequestId: futureDemand.id,
            teacherProfileId: teacher.teacherProfileId,
            organizerProfileId,
            organizationId,
            title: `Upcoming class ${testRunId}`,
            startAt: futureStartAt,
            endAt: new Date(futureStartAt.getTime() + 3600_000),
            location: "Test Studio",
            capacity: 10,
            isPublic: false,
            status: "open_for_enrollment",
          },
        });

        const pastStartAt = new Date(Date.now() - 3600_000);
        await tx.classSession.create({
          data: {
            demandRequestId: pastDemand.id,
            teacherProfileId: teacher.teacherProfileId,
            organizerProfileId,
            organizationId,
            title: `Already started class ${testRunId}`,
            startAt: pastStartAt,
            endAt: new Date(pastStartAt.getTime() + 3600_000),
            location: "Test Studio",
            capacity: 10,
            isPublic: false,
            status: "open_for_enrollment",
          },
        });

        const after = await getAdminDashboardKpisCore(tx);

        expect(after.upcomingClassSessions - before.upcomingClassSessions).toBe(1);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  });

  // D9 最終版：UI 端到端接線驗證，只證明頁面真的把資料庫的值顯示出來，不重複驗證聚合邏輯的
  // 精確度（那已經由上面兩個 transaction 測試對 getAdminDashboardKpisCore() 本身做過決定性
  // 驗證）。這裡建立 1 筆新資料後斷言頁面顯示的數字 >= 1（不跟 before 比較），這個絕對值
  // 下限斷言在任何併發情境下都成立——這個專案所有既有 fixture 清理函式都只刪除自己建立的
  // 資料，這筆新建立的資料在測試自己的 afterAll 執行之前，保證不會被任何其他平行測試刪除。
  test("shows the teacher-applications-pending count reflecting real data, and the pending-review links resolve correctly", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-wiring-${Date.now()}`,
    );
    const teacherEmail = `teacher-wiring-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail);
    await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "submitted",
    });

    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSessionToken);

    await page.goto("/admin/dashboard");

    const teacherPendingCard = page.getByRole("link", { name: /Teacher applications pending/ });
    await expect(teacherPendingCard).toBeVisible();
    const cardText = await teacherPendingCard.textContent();
    const observedCount = Number(cardText?.match(/(\d+)/)?.[1] ?? "0");
    expect(observedCount).toBeGreaterThanOrEqual(1);

    await teacherPendingCard.click();
    await expect(page).toHaveURL(/\/admin\/teachers$/);

    await page.goto("/admin/dashboard");
    await page.getByRole("link", { name: /Demand requests pending review/ }).click();
    await expect(page).toHaveURL(/\/admin\/demands$/);
  });

  test("the shared admin nav links to all four admin pages, and works from each of them", async ({
    context,
    page,
  }, testInfo) => {
    const adminEmail = `admin-nav-${normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    )}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    for (const startPath of ["/admin/dashboard", "/admin/teachers", "/admin/demands", "/admin/classes"]) {
      await page.goto(startPath);
      await expect(page.getByRole("navigation").getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "href",
        "/admin/dashboard",
      );
      await expect(page.getByRole("navigation").getByRole("link", { name: "Teachers" })).toHaveAttribute(
        "href",
        "/admin/teachers",
      );
      await expect(page.getByRole("navigation").getByRole("link", { name: "Demands" })).toHaveAttribute(
        "href",
        "/admin/demands",
      );
      await expect(page.getByRole("navigation").getByRole("link", { name: "Classes" })).toHaveAttribute(
        "href",
        "/admin/classes",
      );
    }
  });

  test("keeps the dashboard usable at tablet width (no horizontal overflow)", async ({
    context,
    page,
  }, testInfo) => {
    const adminEmail = `admin-rwd-${normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    )}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin/dashboard");
    await expectNoHorizontalOverflow(page);
  });
});

async function expectNoHorizontalOverflow(page: {
  evaluate: <T>(pageFunction: () => T) => Promise<T>;
}) {
  const overflow = await page.evaluate(() => ({
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    docScrollWidth: document.documentElement.scrollWidth,
  }));

  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.bodyClientWidth);
  expect(overflow.docScrollWidth).toBeLessThanOrEqual(overflow.docClientWidth);
}
