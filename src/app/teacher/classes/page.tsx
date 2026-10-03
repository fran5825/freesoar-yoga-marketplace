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
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

import {
  filterAndSortClassesForTab,
  TEACHER_CLASS_LIST_TABS,
  teacherClassListTabLabels,
  type TeacherClassListTab,
} from "./_lib/class-list-tabs";
import {
  parseListStatusFilter,
  parseListTab,
  teacherClassDetailHref,
  teacherClassListHref,
} from "./_lib/return-context";

type TeacherClassesPageProps = {
  searchParams?: Promise<{ result?: string; message?: string; tab?: string; status?: string }>;
};

// teacher-initiated-open-classes：老師自建課程的來源徽章文字，跟團主媒合區分。
const originLabels: Record<string, string> = {
  organizer_matched: "團主媒合",
  teacher_initiated: "自己開的課",
};

const emptyMessages: Record<TeacherClassListTab, string> = {
  upcoming: "目前沒有即將上課的課程。草稿要先開放報名才會出現在這裡。",
  drafts: "目前沒有草稿。",
  past: "還沒有已結束的課程。",
  all: "目前沒有已建立的課程。當團主選定你並建立課程後，或你自己建立課程後，會顯示在這裡。",
};

// D15：唯讀查看已經指派給自己的既有 class session，不透過 requireApprovedTeacher() 把關——
// 這是查看既有承諾，不是申請新機會，suspended teacher 仍可查看。
// teacher-usability 第 06 票：每張卡片整張可點進單堂課詳情頁；操作都在詳情頁。
// teacher-usability-redesign 票 04：分「即將上課／草稿／過往／全部」（只是畫面分組，不是新狀態）；
// 建立課程放頂端（只有審核通過才顯示）；卡片連到詳情時帶上分頁，回來時回到同一分頁與卡片位置。
export default async function TeacherClassesPage({ searchParams }: TeacherClassesPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [classSessions, resolvedSearchParams, profile] = await Promise.all([
    listOwnClassSessionsForTeacher(),
    searchParams,
    getOwnTeacherProfileApplicationSnapshot(),
  ]);

  const tab = parseListTab(resolvedSearchParams?.tab);
  const statusFilter = parseListStatusFilter(tab, resolvedSearchParams?.status);
  const now = new Date();
  const visibleClassSessions = filterAndSortClassesForTab(classSessions, tab, now, statusFilter);
  // 預設分頁不帶參數，連結維持原本的乾淨網址；回來時一樣回到即將上課。
  const returnContext =
    tab === "upcoming" && !statusFilter ? null : { kind: "list" as const, tab, status: statusFilter };
  const canCreate = profile?.status === "approved";

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success" ? ("success" as const) : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="border-b border-ink/15 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">我的課程</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
              這裡列出團主已經為你建立的正式課程，以及你自己開的課。點一堂課可以看報名名單與操作。
            </p>
          </div>
          {canCreate ? (
            <Link
              className="inline-flex min-h-11 w-fit shrink-0 items-center rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/teacher/classes/new"
            >
              ＋ 建立課程
            </Link>
          ) : null}
        </div>
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

      <nav aria-label="課程分類" className="-mx-1 flex flex-wrap gap-2 px-1">
        {TEACHER_CLASS_LIST_TABS.map((item) => (
          <Link
            aria-current={item === tab ? "page" : undefined}
            className={
              item === tab
                ? "inline-flex min-h-11 items-center rounded-full bg-pine px-5 py-2 text-sm font-medium text-white"
                : "inline-flex min-h-11 items-center rounded-full border border-ink/25 bg-white px-5 py-2 text-sm font-medium text-ink-soft transition hover:border-ink/40"
            }
            href={teacherClassListHref(item)}
            key={item}
          >
            {teacherClassListTabLabels[item]}
          </Link>
        ))}
      </nav>

      {tab === "all" ? (
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">顯示：</span>
          <Link
            aria-current={statusFilter === null ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 ${statusFilter === null ? "bg-pine-tint font-medium text-pine" : "text-ink-soft underline"}`}
            href={teacherClassListHref("all")}
          >
            全部狀態
          </Link>
          <Link
            aria-current={statusFilter === "cancelled" ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 ${statusFilter === "cancelled" ? "bg-pine-tint font-medium text-pine" : "text-ink-soft underline"}`}
            href={teacherClassListHref("all", "cancelled")}
          >
            只看已取消
          </Link>
        </div>
      ) : null}

      {visibleClassSessions.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">
            {statusFilter === "cancelled" ? "沒有已取消的課程" : `${teacherClassListTabLabels[tab]}：沒有課程`}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {statusFilter === "cancelled" ? "目前沒有取消過的課程。" : emptyMessages[tab]}
          </p>
          {tab !== "all" && classSessions.length > 0 ? (
            <Link
              className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-clay hover:underline"
              href={teacherClassListHref("all")}
            >
              看全部課程（{classSessions.length} 堂）
            </Link>
          ) : null}
        </section>
      ) : (
        <section aria-label={`${teacherClassListTabLabels[tab]}的課程`} className="grid gap-4">
          {visibleClassSessions.map((classSession) => {
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
              <div
                className="scroll-mt-6 overflow-hidden rounded-2xl border border-ink/15 bg-white transition hover:border-pine/40"
                id={`class-${classSession.id}`}
                key={classSession.id}
              >
                <Link
                  className="grid gap-3 p-5 transition hover:bg-pine-tint/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clay"
                  href={teacherClassDetailHref(classSession.id, returnContext)}
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
                    </div>
                    <p className="break-words text-sm text-ink-soft">
                      {formatTaipeiDatetime(classSession.startAt)}・{classSession.location}
                    </p>
                    <p className="break-words text-sm text-ink-soft">
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
                {/* 系列入口放在卡片連結外面，避免連結裡再包連結。 */}
                {classSession.recurringClassSeriesId ? (
                  <div className="border-t border-ink/10 bg-pine-tint/30 px-5">
                    <Link
                      className="inline-flex min-h-11 items-center text-sm font-medium text-pine hover:underline"
                      href={`/teacher/classes/series/${classSession.recurringClassSeriesId}`}
                    >
                      系列：{classSession.recurringClassSeries?.title ?? "課程系列"} →
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
