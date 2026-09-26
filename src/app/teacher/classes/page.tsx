import Link from "next/link";
import { redirect } from "next/navigation";

import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import { listOwnClassSessionsForTeacher } from "@/domain/class-session/read-service";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import { getTeacherClassNextStep } from "@/domain/class-session/teacher-next-step";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireUser } from "@/lib/auth/session";

type TeacherClassesPageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
};

// teacher-initiated-open-classes：老師自建課程的來源徽章文字，跟團主媒合區分。
const originLabels: Record<string, string> = {
  organizer_matched: "團主媒合",
  teacher_initiated: "自己開的課",
};

// D15：唯讀查看已經指派給自己的既有 class session，不透過 requireApprovedTeacher() 把關——
// 這是查看既有承諾，不是申請新機會，suspended teacher 仍可查看。
// teacher-usability 第 06 票：每張卡片整張可點進單堂課詳情頁；開放報名、取消、標記完成、
// 確認／婉拒報名等操作都搬到詳情頁，列表只負責「一眼看出哪堂課需要處理」。
export default async function TeacherClassesPage({ searchParams }: TeacherClassesPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [classSessions, resolvedSearchParams] = await Promise.all([
    listOwnClassSessionsForTeacher(),
    searchParams,
  ]);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success" ? ("success" as const) : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">我的課程</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          這裡列出團主已經為你建立的正式課程，以及你自己開的課。點一堂課可以看報名名單與操作。
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      {classSessions.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">目前沒有已建立的課程</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            當團主選定你並建立課程後，或你自己建立課程後，會顯示在這裡。
          </p>
          <Link
            className="mt-4 inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
            href="/teacher/classes/new"
          >
            ＋ 建立課程
          </Link>
        </section>
      ) : (
        <section className="grid gap-4">
          {classSessions.map((classSession) => {
            const confirmedCount = classSession.enrollments.filter(
              (enrollment) => enrollment.status === "confirmed",
            ).length;
            const pendingCount = classSession.enrollments.filter(
              (enrollment) => enrollment.status === "pending",
            ).length;
            const nextStep = getTeacherClassNextStep({
              status: classSession.status,
              origin: classSession.origin,
              pendingEnrollmentCount: pendingCount,
              endAt: classSession.endAt,
            });
            const serviceTypes = getClassServiceTypes(classSession);

            return (
              <Link
                className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5 transition hover:border-pine/40 hover:bg-pine-tint/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                href={`/teacher/classes/${classSession.id}`}
                key={classSession.id}
              >
                <article className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-lg font-medium text-ink">
                      {classSession.title}
                    </h2>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
                    >
                      {classSessionStatusLabels[classSession.status]}
                    </span>
                    <span className="w-fit rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink-soft">
                      {originLabels[classSession.origin] ?? classSession.origin}
                    </span>
                    {classSession.recurringClassSeriesId ? (
                      <span className="w-fit rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine">
                        系列：{classSession.recurringClassSeries?.title ?? "課程系列"}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-ink-soft">
                    {formatTaipeiDatetime(classSession.startAt)}・{classSession.location}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {classSession.organization?.name ?? "（自己開的課）"}
                    {serviceTypes.length > 0 ? `・${serviceTypes.join("、")}` : ""}
                    {classSession.yogaStyles.length > 0
                      ? `・${classSession.yogaStyles.join("、")}`
                      : ""}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3 text-sm">
                    <span className="text-ink-soft">
                      已報名 {confirmedCount} / {classSession.capacity} 人
                      {pendingCount > 0 ? `・待確認 ${pendingCount} 人` : ""}
                    </span>
                    <span
                      className={
                        nextStep.kind === "action"
                          ? "font-medium text-clay-deep"
                          : "text-ink-soft"
                      }
                    >
                      {nextStep.shortMessage} →
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
          <Link
            className="rounded-2xl border border-dashed border-pine/40 p-5 text-center text-sm font-medium text-pine transition hover:bg-pine-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            href="/teacher/classes/new"
          >
            ＋ 建立課程
          </Link>
        </section>
      )}
    </div>
  );
}
