import { Prisma } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { getAdminDashboardKpisCore } from "../../src/domain/admin/__internal__/dashboard-kpis-core";
import { formatRelativeTime } from "../../src/lib/format-relative-time";
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
  test("lists pending teacher applications and demand requests under 待你處理, each linking to its review page", async ({
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

    const organizerEmail = `organizer-wiring-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);
    const organizer = await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });
    await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "submitted",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });

    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSessionToken);

    await page.goto("/admin/dashboard");

    const pending = page.getByRole("region", { name: "待你處理" });
    await expect(pending).toBeVisible();
    // 共用資料庫裡可能還有別的待審資料，只確認分組標題的數字至少包含這次建立的 1 筆。
    for (const groupTitle of ["老師申請待審", "需求待審"]) {
      const heading = pending.getByRole("heading", { name: groupTitle });
      await expect(heading).toBeVisible();
      const count = Number((await heading.textContent())?.match(/・(\d+)/)?.[1] ?? "0");
      expect(count).toBeGreaterThanOrEqual(1);
    }
    await expect(page.getByRole("heading", { name: "數字概況" })).toBeVisible();

    // 每一列直接連到該筆的審核詳情頁（共用資料庫，只確認有這種連結，不指定哪一筆）。
    await expect(pending.locator('a[href^="/admin/teachers/"]').first()).toBeVisible();
    await expect(pending.locator('a[href^="/admin/demands/"]').first()).toBeVisible();

    await pending.getByRole("link", { name: /老師申請待審|看全部.*筆|前往審核/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/teachers$/);
  });

  test("formats how long ago a pending item was updated in plain Chinese", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const ago = (ms: number) => new Date(now.getTime() - ms);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    expect(formatRelativeTime(ago(10_000), now)).toBe("剛剛");
    expect(formatRelativeTime(ago(5 * minute), now)).toBe("5 分鐘前");
    expect(formatRelativeTime(ago(3 * hour), now)).toBe("3 小時前");
    expect(formatRelativeTime(ago(3 * day), now)).toBe("3 天前");
    expect(formatRelativeTime(ago(-minute), now)).toBe("剛剛");
    expect(formatRelativeTime(ago(90 * day), now)).toMatch(/2026/);
  });

  test("the shared admin nav links to all five admin pages, and works from each of them", async ({
    context,
    page,
  }, testInfo) => {
    const adminEmail = `admin-nav-${normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    )}@${testEmailDomain}`;
    createdEmails.push(adminEmail);
    const { sessionToken } = await createUserSession({ email: adminEmail, isAdmin: true });
    await addAuthSessionCookie(context, sessionToken);

    for (const startPath of [
      "/admin/dashboard",
      "/admin/teachers",
      "/admin/demands",
      "/admin/classes",
      "/admin/organizations",
    ]) {
      await page.goto(startPath);
      const menuButton = page.getByRole("button", { name: "選單" });
      if (await menuButton.isVisible()) await menuButton.click();
      await expect(page.getByRole("navigation").getByRole("link", { name: "總覽", exact: true })).toHaveAttribute(
        "href",
        "/admin/dashboard",
      );
      await expect(page.getByRole("navigation").getByRole("link", { name: "老師", exact: true })).toHaveAttribute(
        "href",
        "/admin/teachers",
      );
      await expect(page.getByRole("navigation").getByRole("link", { name: "需求", exact: true })).toHaveAttribute(
        "href",
        "/admin/demands",
      );
      await expect(page.getByRole("navigation").getByRole("link", { name: "課程", exact: true })).toHaveAttribute(
        "href",
        "/admin/classes",
      );
      await expect(page.getByRole("navigation").getByRole("link", { name: "團體", exact: true })).toHaveAttribute(
        "href",
        "/admin/organizations",
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
