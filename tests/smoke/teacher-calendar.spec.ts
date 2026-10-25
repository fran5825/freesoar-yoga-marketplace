import { expect, test } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import { cleanupDemandResponseFixtures, createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import { futureDateString, futureDateTime } from "./_helpers/future-dates";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// teacher-my-calendar 票 01–05：老師「我的課程」切換成月曆，看到課、草稿、已取消、可授課時間與合作邀請；
// 從月曆點進單堂頁，做完操作或修改課程後，返回仍回到同月同日；手機 375px 不橫向溢出。

const testEmailDomain = "teacher-calendar-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.organizerClassProposal.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.notification.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: { in: createdEmails } } } } });
  await prisma.teacherAvailability.deleteMany({ where: { teacherProfile: { user: { email: { in: createdEmails } } } } });
  await cleanupDemandResponseFixtures(createdEmails);
  await cleanupOrganizerDemandFixtures(createdEmails);
  await prisma.$disconnect();
});

const DAYS_AHEAD = 30;

async function seedClass(teacherProfileId: string, title: string, start: string, end: string) {
  const day = futureDateString(DAYS_AHEAD);
  const validation = validateClassSessionCreate({
    title,
    serviceType: "放鬆紓壓",
    startAt: `${day}T${start}`,
    endAt: `${day}T${end}`,
    location: "台北市月曆教室",
    capacity: 8,
  });
  if (!validation.valid) throw new Error("unexpected invalid fixture");
  const created = await createClassSessionForTeacher(teacherProfileId, validation.normalized);
  if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);
  return created.classSessionId;
}

async function seedScenario(testRunId: string) {
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
  createdEmails.push(teacherEmail, organizerEmail);
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Calendar Teacher ${testRunId}`,
    status: "approved",
  });
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Calendar Organizer ${testRunId}`,
    organizationName: `月曆團 ${testRunId}`,
    contactName: "聯絡人",
    contactEmail: `contact-${testRunId}@example.com`,
    contactPhone: "0900000000",
  });

  const day = futureDateString(DAYS_AHEAD);
  const activeId = await seedClass(teacher.teacherProfileId, `開放課 ${testRunId}`, "10:00", "11:00");
  const draftId = await seedClass(teacher.teacherProfileId, `草稿課 ${testRunId}`, "13:00", "14:00");
  const cancelledId = await seedClass(teacher.teacherProfileId, `取消課 ${testRunId}`, "15:00", "16:00");
  // 改課表單要求至少一種瑜伽類型。
  await prisma.classSession.update({
    where: { id: activeId },
    data: { status: "open_for_enrollment", yogaStyles: ["哈達瑜伽"], serviceTypes: ["放鬆紓壓"] },
  });
  await prisma.classSession.update({ where: { id: cancelledId }, data: { status: "cancelled" } });

  const proposalBase = {
    organizerProfileId: organizer.organizerProfileId,
    organizationId: organizer.organizationId,
    teacherProfileId: teacher.teacherProfileId,
    serviceTypes: ["伸展與身體保養"],
    location: "台北市信義區",
    capacity: 15,
    submittedAt: new Date(),
    transitionSeq: 2,
  };
  await prisma.organizerClassProposal.create({
    data: {
      ...proposalBase,
      title: `待確認邀請 ${testRunId}`,
      startAt: new Date(`${futureDateTime(DAYS_AHEAD, "18:00")}:00+08:00`),
      endAt: new Date(`${futureDateTime(DAYS_AHEAD, "19:00")}:00+08:00`),
      status: "pending_confirmation",
    },
  });
  await prisma.organizerClassProposal.create({
    data: {
      ...proposalBase,
      title: `已確認邀請 ${testRunId}`,
      startAt: new Date(`${futureDateTime(DAYS_AHEAD, "19:30")}:00+08:00`),
      endAt: new Date(`${futureDateTime(DAYS_AHEAD, "20:30")}:00+08:00`),
      status: "confirmed",
      confirmedVersion: 1,
      confirmedAt: new Date(),
    },
  });
  await prisma.organizerClassProposal.create({
    data: {
      ...proposalBase,
      title: `已婉拒邀請 ${testRunId}`,
      startAt: new Date(`${futureDateTime(DAYS_AHEAD, "21:00")}:00+08:00`),
      endAt: new Date(`${futureDateTime(DAYS_AHEAD, "22:00")}:00+08:00`),
      status: "declined",
    },
  });

  const [year, month, date] = day.split("-").map(Number);
  await prisma.teacherAvailability.create({
    data: {
      teacherProfileId: teacher.teacherProfileId,
      dayOfWeek: new Date(Date.UTC(year, month - 1, date)).getUTCDay(),
      startTime: "09:00",
      endTime: "12:00",
    },
  });

  return { teacher, day, month: day.slice(0, 7), activeId, draftId, cancelledId };
}

test.describe("teacher my calendar", () => {
  test("switch to the calendar, see every kind of item for a day, then return to the same day after an action and after editing", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-cal-${Date.now()}`);
    const scenario = await seedScenario(testRunId);
    const isMobile = testInfo.project.name.includes("mobile");
    await addAuthSessionCookie(context, scenario.teacher.sessionToken);

    // 清單 → 月曆切換；月曆不顯示清單分頁。
    await page.goto("/teacher/classes");
    const toggle = page.getByRole("navigation", { name: "檢視方式" });
    await expect(toggle.getByRole("link", { name: "清單" })).toHaveAttribute("aria-current", "page");
    await toggle.getByRole("link", { name: "月曆" }).click();
    await expect(page).toHaveURL(/view=calendar&month=\d{4}-\d{2}/);
    await expect(page.getByRole("navigation", { name: "課程分類" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "我的行事曆" })).toBeVisible();

    // 直接開到那個月、那一天。
    await page.goto(`/teacher/classes?view=calendar&month=${scenario.month}&day=${scenario.day}`);
    const calendar = page.getByRole("region", { name: "我的行事曆" });
    const cell = calendar.locator(`[data-day="${scenario.day}"]`);
    await expect(cell).toHaveAttribute("data-has-availability", "true");

    if (isMobile) {
      // 手機版格子只有色點，不顯示課名；點日期看下方明細。
      await expect(cell.getByRole("link")).toHaveCount(0);
      await cell.getByRole("button").first().click();
    } else {
      await expect(cell.getByRole("link", { name: `開放課 ${testRunId} 0/8` })).toBeVisible();
      await expect(cell.getByRole("button", { name: "還有 2 筆" })).toBeVisible();
    }

    const detail = page.getByRole("region", { name: "當日明細" });
    await expect(detail.getByRole("link", { name: new RegExp(`開放課 ${testRunId}`) })).toContainText("已報名 0/8");
    await expect(detail.getByRole("link", { name: new RegExp(`草稿課 ${testRunId}`) })).toContainText("草稿");
    await expect(detail.getByRole("link", { name: new RegExp(`取消課 ${testRunId}`) })).toContainText("已取消");
    await expect(detail.getByRole("link", { name: new RegExp(`待確認邀請 ${testRunId}`) })).toContainText("待你確認");
    await expect(detail.getByRole("link", { name: new RegExp(`已確認邀請 ${testRunId}`) })).toContainText("已確認，等團主開課");
    await expect(detail.getByText(`已婉拒邀請 ${testRunId}`)).toHaveCount(0);
    await expect(detail).toContainText("你設定的可授課時間");
    await expect(detail).toContainText("09:00–12:00");

    // 375px 不橫向溢出。
    if (isMobile) {
      await page.setViewportSize({ width: 375, height: 812 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }

    // 月曆 → 草稿單堂頁 → 開放報名 → 返回同月同日。
    const calendarHref = `/teacher/classes?view=calendar&month=${scenario.month}&day=${scenario.day}`;
    await detail.getByRole("link", { name: new RegExp(`草稿課 ${testRunId}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${scenario.draftId}\\?from=calendar&month=${scenario.month}&day=${scenario.day}`));
    await page.getByRole("button", { name: "開放報名" }).click();
    await expect(page.getByText("已開放報名。")).toBeVisible();
    await expect(page.getByRole("link", { name: "← 回我的課程" })).toHaveAttribute("href", calendarHref);
    await page.getByRole("link", { name: "← 回我的課程" }).click();
    await expect(page).toHaveURL(new RegExp(`view=calendar&month=${scenario.month}&day=${scenario.day}$`));
    await expect(page.getByRole("region", { name: "當日明細" }).getByRole("link", { name: new RegExp(`草稿課 ${testRunId}`) })).toContainText("開放報名");

    // 月曆 → 單堂頁 → 修改課程 → 儲存 → 返回同月同日。
    await page.getByRole("region", { name: "當日明細" }).getByRole("link", { name: new RegExp(`開放課 ${testRunId}`) }).click();
    // 手機版的其餘動作收在「更多…」裡。
    if (isMobile) await page.getByRole("group", { name: "課程操作" }).getByText("更多…").click();
    await page.getByRole("link", { name: "修改課程" }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: "修改課程" })).toBeVisible();
    await expect(page.getByRole("link", { name: "← 回課程詳情" })).toHaveAttribute(
      "href",
      `/teacher/classes/${scenario.activeId}?from=calendar&month=${scenario.month}&day=${scenario.day}`,
    );
    await page.locator("#capacity").fill("9");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page.getByText("課程已更新。")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${scenario.activeId}\\?.*from=calendar&month=${scenario.month}&day=${scenario.day}`));
    await expect(page.getByRole("link", { name: "← 回我的課程" })).toHaveAttribute("href", calendarHref);
    await page.getByRole("link", { name: "← 回我的課程" }).click();
    await expect(page.getByRole("region", { name: "當日明細" }).getByRole("link", { name: new RegExp(`開放課 ${testRunId}`) })).toContainText("已報名 0/9");
  });

  test("month navigation, back to this month, and bad params fall back safely", async ({ context, page }, testInfo) => {
    test.fixme(true, "既有失敗：月份標題找不到。見 docs/backlog.md 第 27 項");
    const testRunId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-nav-${Date.now()}`);
    const email = `nav-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const teacher = await createTeacherProfileWithSession({ email, displayName: `Nav ${testRunId}`, status: "approved" });
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teacher/classes?view=calendar&month=2031-01");
    const calendar = page.getByRole("region", { name: "我的行事曆" });
    await expect(calendar.getByRole("heading", { name: "2031 年 1 月" })).toBeVisible();
    await calendar.getByRole("link", { name: "上個月" }).click();
    await expect(calendar.getByRole("heading", { name: "2030 年 12 月" })).toBeVisible();
    await calendar.getByRole("link", { name: "下個月" }).click();
    await calendar.getByRole("link", { name: "下個月" }).click();
    await expect(calendar.getByRole("heading", { name: "2031 年 2 月" })).toBeVisible();
    // 星期日開頭
    await expect(calendar.locator("div.grid-cols-7").first()).toContainText("日一二三四五六");
    await calendar.getByRole("link", { name: "回到本月" }).click();
    await expect(calendar.getByRole("link", { name: "回到本月" })).toHaveCount(0);

    // 壞參數退回本月，不出錯
    await page.goto("/teacher/classes?view=calendar&month=//evil.example&day=2026-99-99");
    await expect(page.getByRole("region", { name: "我的行事曆" }).getByRole("link", { name: "回到本月" })).toHaveCount(0);
    // 壞的返回參數不會被當成月曆
    await page.goto("/teacher/classes/not-a-class?from=calendar&month=https://evil.example");
    await expect(page.getByRole("link", { name: /evil/ })).toHaveCount(0);
  });

  test("editing from a list tab returns to the same tab after saving", async ({ context, page }, testInfo) => {
    const testRunId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-list-${Date.now()}`);
    const scenario = await seedScenario(testRunId);
    await addAuthSessionCookie(context, scenario.teacher.sessionToken);

    await page.goto("/teacher/classes?tab=all");
    await page.locator(`#class-${scenario.activeId}`).getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/teacher/classes/${scenario.activeId}\\?from=list&tab=all`));
    if (testInfo.project.name.includes("mobile")) await page.getByRole("group", { name: "課程操作" }).getByText("更多…").click();
    await page.getByRole("link", { name: "修改課程" }).filter({ visible: true }).click();
    await page.locator("#capacity").fill("9");
    await page.getByRole("button", { name: "儲存修改" }).click();
    await expect(page.getByText("課程已更新。")).toBeVisible();
    await expect(page.getByRole("link", { name: "← 回我的課程" })).toHaveAttribute(
      "href",
      `/teacher/classes?tab=all#class-${scenario.activeId}`,
    );
  });
});
