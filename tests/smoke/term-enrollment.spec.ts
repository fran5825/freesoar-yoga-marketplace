import { expect, test } from "@playwright/test";

import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { createSeriesEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-series-enrollment-core";
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

// teacher-class-scheduling 票 08：學員報名整期。
const testEmailDomain = "term-enrollment-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.enrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.seriesEnrollment.deleteMany({ where: { user: { email: { in: createdEmails } } } });
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

async function seedTeacher(id: string) {
  const email = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(email);

  return createTeacherProfileWithSession({ email, displayName: `Teacher ${id}`, status: "approved" });
}

async function seedMember(id: string, label: string) {
  const email = `member-${label}-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  const session = await createUserSession({ email });

  return { id: session.userId, sessionToken: session.sessionToken };
}

type SeedTermOptions = {
  count?: number;
  capacity?: number;
  mode?: "term_only" | "term_and_single";
  requiresApproval?: boolean;
  open?: boolean;
  isPublic?: boolean;
  title?: string;
};

// 每週三的期班，直接寫入。同一位老師在同一個測試建多個期班時，每次換一個時段，避免彼此撞課被跳過。
let seededTermCount = 0;

async function seedTerm(teacherProfileId: string, options: SeedTermOptions = {}) {
  const hour = String(6 + (seededTermCount++ % 14)).padStart(2, "0");
  const series = await prisma.recurringClassSeries.create({
    data: {
      teacherProfileId,
      title: options.title ?? "週三晨間期班",
      serviceType: "放鬆紓壓",
      serviceTypes: ["放鬆紓壓"],
      yogaStyles: ["哈達瑜伽"],
      dayOfWeek: 3,
      startTime: `${hour}:00`,
      endTime: `${hour}:50`,
      location: "台北市期班教室",
      capacity: options.capacity ?? 5,
      requiresApproval: options.requiresApproval ?? false,
      isPublic: options.isPublic ?? false,
      kind: "term",
      termEnrollmentMode: options.mode ?? "term_and_single",
    },
  });
  await generateOccurrencesForSeries(
    teacherProfileId,
    series.id,
    computeNextWeeklyOccurrenceDates(3, options.count ?? 3),
    { openForEnrollment: options.open ?? true },
  );
  const sessions = await prisma.classSession.findMany({
    where: { recurringClassSeriesId: series.id },
    orderBy: { startAt: "asc" },
  });

  return { series, sessions };
}

const noNotify = async () => {};

test.describe("term enrollment (domain)", () => {
  test("enrolls every remaining session; a session that already started is left out (mid-term join)", async ({}, testInfo) => {
    const id = runId(testInfo, "basic");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { count: 3 });
    // 第一堂改成已開始：中途加入只報剩下的兩堂。
    await prisma.classSession.update({
      where: { id: sessions[0].id },
      data: { startAt: new Date(Date.now() - 3_600_000), endAt: new Date(Date.now() + 600_000) },
    });

    const result = await createSeriesEnrollmentForUser(member.id, series.id, { notes: "膝蓋舊傷" }, undefined, noNotify);
    expect(result).toMatchObject({ ok: true, status: "confirmed", sessionCount: 2, mergedCount: 0 });

    const enrollments = await prisma.enrollment.findMany({ where: { userId: member.id } });
    expect(enrollments.map((enrollment) => enrollment.classSessionId).sort()).toEqual(
      [sessions[1].id, sessions[2].id].sort(),
    );
    expect(
      enrollments.every(
        (enrollment) =>
          enrollment.status === "confirmed" &&
          enrollment.seriesEnrollmentSource === "term_created" &&
          enrollment.seriesEnrollmentId === (result.ok ? result.seriesEnrollmentId : null),
      ),
    ).toBe(true);
  });

  test("refuses when any remaining session is full, still a draft, or the member already has a term enrollment (even withdrawn)", async ({}, testInfo) => {
    const id = runId(testInfo, "refuse");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const other = await seedMember(id, "b");

    const full = await seedTerm(teacher.teacherProfileId, { capacity: 1, title: "有一堂滿了" });
    expect(await createEnrollmentForUser(other.id, full.sessions[1].id, { notes: null })).toMatchObject({ ok: true });
    expect(await createSeriesEnrollmentForUser(member.id, full.series.id, { notes: null }, undefined, noNotify)).toMatchObject({
      ok: false,
      code: "term_session_full",
      sessionStartAt: full.sessions[1].startAt,
    });

    const draft = await seedTerm(teacher.teacherProfileId, { open: false, title: "還是草稿" });
    expect(await createSeriesEnrollmentForUser(member.id, draft.series.id, { notes: null }, undefined, noNotify)).toMatchObject({
      ok: false,
      code: "term_not_fully_open",
    });

    const once = await seedTerm(teacher.teacherProfileId, { title: "只能報一次" });
    expect((await createSeriesEnrollmentForUser(member.id, once.series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);
    expect(await createSeriesEnrollmentForUser(member.id, once.series.id, { notes: null }, undefined, noNotify)).toMatchObject({
      ok: false,
      code: "already_term_enrolled",
    });
    await prisma.seriesEnrollment.updateMany({ where: { userId: member.id, recurringClassSeriesId: once.series.id }, data: { status: "withdrawn" } });
    expect(await createSeriesEnrollmentForUser(member.id, once.series.id, { notes: null }, undefined, noNotify)).toMatchObject({
      ok: false,
      code: "already_term_enrolled",
    });

    // 任何拒絕都不能留下報名。
    expect(await prisma.enrollment.count({ where: { userId: member.id, classSession: { recurringClassSeriesId: { in: [full.series.id, draft.series.id] } } } })).toBe(0);
  });

  test("a term_only term refuses single enrollment; term_and_single still allows it", async ({}, testInfo) => {
    const id = runId(testInfo, "term-only");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const termOnly = await seedTerm(teacher.teacherProfileId, { mode: "term_only", title: "只收整期" });
    const mixed = await seedTerm(teacher.teacherProfileId, { mode: "term_and_single", title: "都收" });

    expect(await createEnrollmentForUser(member.id, termOnly.sessions[0].id, { notes: null })).toEqual({
      ok: false,
      code: "term_only_series",
    });
    expect(await createEnrollmentForUser(member.id, mixed.sessions[0].id, { notes: null })).toMatchObject({ ok: true });
  });

  test("existing single enrollments are merged with their status and do not need a seat; a cancelled one blocks the term", async ({}, testInfo) => {
    const id = runId(testInfo, "merge");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { capacity: 1, title: "併入" });

    // 學員自己占了第二堂的最後一席：整期時併入，不算超收。
    const single = await createEnrollmentForUser(member.id, sessions[1].id, { notes: null });
    expect(single.ok).toBe(true);
    const result = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify);
    expect(result).toMatchObject({ ok: true, sessionCount: 3, mergedCount: 1 });

    const reloaded = await prisma.enrollment.findMany({ where: { userId: member.id }, orderBy: { classSession: { startAt: "asc" } } });
    expect(reloaded.map((enrollment) => enrollment.seriesEnrollmentSource)).toEqual(["term_created", "merged_single", "term_created"]);
    expect(reloaded[1].id).toBe(single.ok ? single.enrollmentId : "");

    const blocked = await seedTerm(teacher.teacherProfileId, { title: "取消過" });
    const cancelled = await createEnrollmentForUser(member.id, blocked.sessions[2].id, { notes: null });
    await prisma.enrollment.update({ where: { id: cancelled.ok ? cancelled.enrollmentId : "" }, data: { status: "cancelled" } });
    expect(await createSeriesEnrollmentForUser(member.id, blocked.series.id, { notes: null }, undefined, noNotify)).toMatchObject({
      ok: false,
      code: "term_has_cancelled_enrollment",
      sessionStartAt: blocked.sessions[2].startAt,
    });
  });

  test("a term that needs approval starts pending everywhere and sends exactly one notice to the member and one to the teacher", async ({}, testInfo) => {
    const id = runId(testInfo, "approval");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series } = await seedTerm(teacher.teacherProfileId, { requiresApproval: true, count: 4, title: "需確認期班" });

    const result = await createSeriesEnrollmentForUser(member.id, series.id, { notes: null });
    expect(result).toMatchObject({ ok: true, status: "pending", sessionCount: 4 });
    expect(await prisma.seriesEnrollment.findFirstOrThrow({ where: { userId: member.id } })).toMatchObject({ status: "pending" });
    expect(await prisma.enrollment.count({ where: { userId: member.id, status: "pending" } })).toBe(4);

    const memberNotices = await prisma.notification.findMany({ where: { userId: member.id } });
    const teacherNotices = await prisma.notification.findMany({ where: { userId: teacher.userId } });
    expect(memberNotices).toHaveLength(1);
    expect(memberNotices[0]).toMatchObject({ type: "enrollment_pending_review" });
    expect(memberNotices[0].body).toContain("需確認期班（整期 4 堂）");
    expect(teacherNotices.filter((notice) => notice.type === "enrollment_pending_review")).toHaveLength(1);
  });

  test("the last seat taken by a single enrollment after the term read but before its session lock: the term fails and nobody is overbooked", async ({}, testInfo) => {
    const id = runId(testInfo, "race");
    const teacher = await seedTeacher(id);
    const termMember = await seedMember(id, "term");
    const singleMember = await seedMember(id, "single");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { capacity: 1, title: "最後一席" });

    const result = await createSeriesEnrollmentForUser(
      termMember.id,
      series.id,
      { notes: null },
      {
        // 整期報名握著系列鎖、還沒鎖場次時，單場報名（場次 → 老師，不鎖系列）可以完成。
        onBeforeSessionLock: async () => {
          expect(await createEnrollmentForUser(singleMember.id, sessions[2].id, { notes: null })).toMatchObject({ ok: true });
        },
      },
      noNotify,
    );

    expect(result).toMatchObject({ ok: false, code: "term_session_full" });
    expect(await prisma.enrollment.count({ where: { classSessionId: sessions[2].id, status: { in: ["pending", "confirmed"] } } })).toBe(1);
    expect(await prisma.seriesEnrollment.count({ where: { userId: termMember.id } })).toBe(0);
  });

  // 2026-10-09 Codex review：讀到既有單堂報名之後、併入之前的取消，必須等到整期報名 commit 之後才生效
  // （變成整期底下的請假），不能讓已取消的報名被併入整期。
  test("a single enrollment cancelled while the term enrollment holds it waits until the merge commits", async ({}, testInfo) => {
    const id = runId(testInfo, "merge-race");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "a");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { title: "併入時取消" });
    const single = await createEnrollmentForUser(member.id, sessions[1].id, { notes: null });
    const singleId = single.ok ? single.enrollmentId : "";
    let cancel: Promise<unknown> | null = null;
    let statusWhileHeld: string | null = null;

    const result = await createSeriesEnrollmentForUser(
      member.id,
      series.id,
      { notes: null },
      {
        onOwnEnrollmentsLocked: async () => {
          // PrismaPromise 要呼叫 then 才會真的送出查詢；這裡立刻送出，讓取消在報名鎖還在時就開始等待。
          cancel = prisma.enrollment
            .updateMany({
              where: { id: singleId, status: { in: ["pending", "confirmed"] } },
              data: { status: "cancelled" },
            })
            .then((result) => result);
          await new Promise((resolve) => setTimeout(resolve, 300));
          // 另一個連線的一般讀取不會被擋：沒有鎖的話取消早已 commit，這裡會讀到 cancelled。
          statusWhileHeld = (await prisma.enrollment.findUniqueOrThrow({ where: { id: singleId } })).status;
        },
      },
      noNotify,
    );
    await cancel;

    expect(result).toMatchObject({ ok: true, mergedCount: 1 });
    expect(statusWhileHeld).toBe("confirmed");
    // 取消發生在併入之後：這一堂成為整期底下的請假，整期仍有效。
    expect(await prisma.enrollment.findUniqueOrThrow({ where: { id: singleId } })).toMatchObject({
      status: "cancelled",
      seriesEnrollmentSource: "merged_single",
    });
  });

  test("two term enrollments for the last seats run one after the other and never overbook", async ({}, testInfo) => {
    const id = runId(testInfo, "parallel");
    const teacher = await seedTeacher(id);
    const first = await seedMember(id, "first");
    const second = await seedMember(id, "second");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { capacity: 1, title: "同時報整期" });

    const results = await Promise.all([
      createSeriesEnrollmentForUser(first.id, series.id, { notes: null }, undefined, noNotify),
      createSeriesEnrollmentForUser(second.id, series.id, { notes: null }, undefined, noNotify),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    for (const session of sessions) {
      expect(await prisma.enrollment.count({ where: { classSessionId: session.id, status: { in: ["pending", "confirmed"] } } })).toBe(1);
    }
  });
});

test.describe("term enrollment (UI)", () => {
  test("a visitor sees a public term page; a signed-in member enrolls the whole term from it", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui");
    const { series } = await seedTerm(teacher.teacherProfileId, { isPublic: true, count: 3, title: `公開期班 ${id}` });

    await page.goto(`/classes/terms/${series.id}`);
    await expect(page.getByRole("heading", { name: `公開期班 ${id}` })).toBeVisible();
    await expect(page.getByText("期班・共 3 堂・剩 3 堂")).toBeVisible();
    await expect(page.getByRole("button", { name: /登入並報名整期/ }).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "這一期的上課日期" }).getByRole("listitem")).toHaveCount(3);

    await addAuthSessionCookie(context, member.sessionToken);
    await page.reload();
    await page.getByLabel(/我了解此課程非醫療行為/).check();
    await page.getByRole("button", { name: "報名整期（3 堂）" }).click();
    await expect(page.getByText("整期報名成功，共 3 堂。")).toBeVisible();
    await expect(page.getByText("你已報名整期")).toBeVisible();
    expect(await prisma.enrollment.count({ where: { userId: member.id, status: "confirmed" } })).toBe(3);
  });

  test("a private term is hidden from visitors; a term_only session page sends members to the term page", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui-private");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui-private");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { mode: "term_only", title: `連結期班 ${id}` });

    const visitorResponse = await page.goto(`/classes/terms/${series.id}`);
    expect(visitorResponse?.status()).toBe(404);

    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto(`/classes/${sessions[0].id}`);
    await expect(page.getByRole("heading", { name: `這堂課屬於期班「連結期班 ${id}」` })).toBeVisible();
    await expect(page.getByRole("button", { name: "確認報名" })).toHaveCount(0);
    await page.getByRole("link", { name: "前往期班頁報名整期" }).click();
    await expect(page).toHaveURL(new RegExp(`/classes/terms/${series.id}`));
  });

  // 票 10 起單場頁不再顯示整期子報名的確認按鈕（改連到期班頁）；server 端的拒絕仍在
  // confirmPendingEnrollmentForTeacher 的 updateMany 條件（seriesEnrollmentId: null）。
  test("a teacher cannot confirm a single pending enrollment that belongs to a term", async ({ context, page }, testInfo) => {
    const id = runId(testInfo, "ui-teacher");
    const teacher = await seedTeacher(id);
    const member = await seedMember(id, "ui-teacher");
    const { series, sessions } = await seedTerm(teacher.teacherProfileId, { requiresApproval: true, title: `需確認 ${id}` });
    expect((await createSeriesEnrollmentForUser(member.id, series.id, { notes: null }, undefined, noNotify)).ok).toBe(true);

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto(`/teacher/classes/${sessions[0].id}`);
    await expect(page.getByRole("link", { name: "到期班頁處理" })).toBeVisible();
    await expect(page.locator("#pending-enrollments").getByRole("button", { name: "確認報名" })).toHaveCount(0);
    expect(await prisma.enrollment.findFirstOrThrow({ where: { userId: member.id, classSessionId: sessions[0].id } })).toMatchObject({
      status: "pending",
    });
  });
});
