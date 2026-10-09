import { generateOccurrencesForSeries } from "../../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../../src/domain/class-session/recurring-series-dates";
import { createUserSession, normalizeForEmail, prisma } from "./organizer-demand-fixtures";
import { cleanupDemandResponseFixtures, createTeacherProfileWithSession } from "./demand-response-fixtures";

// teacher-class-scheduling 票 08–12：期班測試共用的資料準備。每個 spec 自己建一份，email 用自己的網域。
export function createTermFixtures(testEmailDomain: string) {
  const createdEmails: string[] = [];
  // 同一位老師在同一個測試建多個期班時，每次換一個時段，避免彼此撞課被跳過。
  let seededTermCount = 0;

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

  // 每週三的期班，直接寫入並生成場次。
  async function seedTerm(
    teacherProfileId: string,
    options: {
      count?: number;
      capacity?: number;
      mode?: "term_only" | "term_and_single";
      requiresApproval?: boolean;
      open?: boolean;
      isPublic?: boolean;
      title?: string;
    } = {},
  ) {
    const hour = String(6 + (seededTermCount++ % 14)).padStart(2, "0");
    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId,
        title: options.title ?? "週三期班",
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

  // class-discovery-series-cards：持續開課（預設每週三 19:00，公開且已開放報名），直接寫入並生成場次。
  async function seedContinuous(
    teacherProfileId: string,
    options: { count?: number; capacity?: number; isPublic?: boolean; title?: string; dayOfWeek?: number; location?: string } = {},
  ) {
    const dayOfWeek = options.dayOfWeek ?? 3;
    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId,
        title: options.title ?? "週三持續開課",
        description: "系列說明文字",
        suitableFor: "初學者",
        preparationNotes: "帶毛巾",
        serviceType: "放鬆紓壓",
        serviceTypes: ["放鬆紓壓"],
        yogaStyles: ["陰瑜伽"],
        dayOfWeek,
        startTime: "19:00",
        endTime: "20:00",
        location: options.location ?? "台北市持續教室",
        capacity: options.capacity ?? 5,
        isPublic: options.isPublic ?? true,
        kind: "continuous",
      },
    });
    await generateOccurrencesForSeries(
      teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(dayOfWeek, options.count ?? 10),
      { openForEnrollment: true },
    );
    const sessions = await prisma.classSession.findMany({
      where: { recurringClassSeriesId: series.id },
      orderBy: { startAt: "asc" },
    });

    return { series, sessions };
  }

  // 把某一場改成已開始（用來測「已上過的紀錄不受影響」）。
  async function markStarted(classSessionId: string) {
    await prisma.classSession.update({
      where: { id: classSessionId },
      data: { startAt: new Date(Date.now() - 3_600_000), endAt: new Date(Date.now() + 600_000) },
    });
  }

  async function cleanup() {
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
  }

  return { runId, seedTeacher, seedMember, seedTerm, seedContinuous, markStarted, cleanup };
}

export const noNotify = async () => {};
