import Link from "next/link";
import { redirect } from "next/navigation";

import { demandRequestTargetLevelLabels } from "@/app/organizer/demands/_components/status-labels";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import { listOwnClassSessionsForTeacher } from "@/domain/class-session/read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireUser } from "@/lib/auth/session";

import {
  cancelOwnClassSessionAction,
  completeOwnClassSessionAction,
  confirmPendingEnrollmentAction,
  declinePendingEnrollmentAction,
  openOwnClassSessionForEnrollmentAction,
} from "./actions";

type TeacherClassesPageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
};

// teacher-initiated-open-classes：老師自建課程的來源徽章文字，跟團主媒合區分。
const originLabels: Record<string, string> = {
  organizer_matched: "團主媒合",
  teacher_initiated: "自己開的課",
};

// D15：唯讀查看已經指派給自己的既有 class session，不透過 requireApprovedTeacher() 把關——
// 這是查看既有承諾，不是申請新機會，suspended teacher 仍可查看。老師自建課程的取消/開放
// 報名/標記完成動作則需要 own-scoped 操作，見 ./actions.ts。
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Teacher classes</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-950">我的課程</h1>
          <Link
            className="inline-flex rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            href="/teacher/classes/new"
          >
            建立課程
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          這裡列出團主已經為你建立的正式課程，以及你自己開的課。
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      {classSessions.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">
            目前沒有已建立的課程
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            當團主選定你並建立課程後，會顯示在這裡。
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {classSessions.map((classSession) => (
            <article
              className="grid gap-3 rounded border border-gray-200 bg-white p-5"
              key={classSession.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-lg font-medium text-gray-950">
                  {classSession.title}
                </h2>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
                >
                  {classSessionStatusLabels[classSession.status]}
                </span>
                <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {originLabels[classSession.origin] ?? classSession.origin}
                </span>
              </div>
              <dl className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">團體</dt>
                  <dd className="mt-1 break-words">
                    {classSession.organization?.name ?? "（自己開的課）"}
                  </dd>
                </div>
                {classSession.serviceType ? (
                  <div className="min-w-0">
                    <dt className="font-medium text-gray-950">課程類型</dt>
                    <dd className="mt-1 break-words">{classSession.serviceType}</dd>
                  </div>
                ) : null}
                {classSession.demandRequest?.targetLevel ? (
                  <div className="min-w-0">
                    <dt className="font-medium text-gray-950">程度</dt>
                    <dd className="mt-1 break-words">
                      {demandRequestTargetLevelLabels[
                        classSession.demandRequest.targetLevel
                      ] ?? classSession.demandRequest.targetLevel}
                    </dd>
                  </div>
                ) : null}
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">開始時間</dt>
                  <dd className="mt-1">{formatTaipeiDatetime(classSession.startAt)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">結束時間</dt>
                  <dd className="mt-1">{formatTaipeiDatetime(classSession.endAt)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">地點</dt>
                  <dd className="mt-1 break-words">{classSession.location}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">名額上限</dt>
                  <dd className="mt-1">{classSession.capacity} 人</dd>
                </div>
              </dl>
              {classSession.description ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                  {classSession.description}
                </p>
              ) : null}

              {["open_for_enrollment", "completed"].includes(classSession.status) ? (
                <div className="min-w-0 border-t border-gray-100 pt-3">
                  <h3 className="text-sm font-medium text-gray-950">
                    已報名會員（
                    {classSession.enrollments.filter((enrollment) => enrollment.status === "confirmed").length}{" "}
                    人）
                  </h3>
                  {classSession.enrollments.filter((enrollment) => enrollment.status === "confirmed")
                    .length === 0 ? (
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      目前還沒有會員報名。
                    </p>
                  ) : (
                    <ul className="mt-2 grid gap-2">
                      {classSession.enrollments
                        .filter((enrollment) => enrollment.status === "confirmed")
                        .map((enrollment) => (
                          <li
                            className="min-w-0 rounded border border-gray-100 bg-gray-50 p-3 text-sm"
                            key={enrollment.id}
                          >
                            <p className="min-w-0 break-words font-medium text-gray-950">
                              {enrollment.user.name ?? enrollment.user.email ?? "會員"}
                            </p>
                            {enrollment.notes ? (
                              <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-gray-600">
                                {enrollment.notes}
                              </p>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {/* teacher-initiated-open-classes 第 8 節（Gate G2/G3）：requiresApproval=true
                  課程收到的 pending 報名，不論 classSession 目前狀態，只要還有 pending
                  就要顯示——老師需要能看到並確認/拒絕，即使課程碰巧已經標記完成（此時確認/
                  拒絕會因為 startAt 時間邊界回傳明確錯誤，不是隱藏起來裝作不存在）。 */}
              {classSession.enrollments.filter((enrollment) => enrollment.status === "pending")
                .length > 0 ? (
                <div className="min-w-0 border-t border-gray-100 pt-3">
                  <h3 className="text-sm font-medium text-gray-950">
                    待確認報名（
                    {classSession.enrollments.filter((enrollment) => enrollment.status === "pending").length}{" "}
                    人）
                  </h3>
                  <ul className="mt-2 grid gap-2">
                    {classSession.enrollments
                      .filter((enrollment) => enrollment.status === "pending")
                      .map((enrollment) => (
                        <li
                          className="min-w-0 rounded border border-amber-200 bg-amber-50/60 p-3 text-sm"
                          key={enrollment.id}
                        >
                          <p className="min-w-0 break-words font-medium text-gray-950">
                            {enrollment.user.name ?? enrollment.user.email ?? "會員"}
                          </p>
                          {enrollment.notes ? (
                            <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-gray-600">
                              {enrollment.notes}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={confirmPendingEnrollmentAction}>
                              <input name="enrollmentId" type="hidden" value={enrollment.id} />
                              <button
                                className="rounded border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-50"
                                type="submit"
                              >
                                確認報名
                              </button>
                            </form>
                            <form action={declinePendingEnrollmentAction}>
                              <input name="enrollmentId" type="hidden" value={enrollment.id} />
                              <button
                                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                                type="submit"
                              >
                                拒絕
                              </button>
                            </form>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {classSession.status === "completed" ? (
                <div className="min-w-0 border-t border-gray-100 pt-3">
                  <h3 className="text-sm font-medium text-gray-950">
                    學員評價（{classSession.reviews.length} 則）
                  </h3>
                  {classSession.reviews.length === 0 ? (
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      目前還沒有評價。
                    </p>
                  ) : (
                    <ul className="mt-2 grid gap-2">
                      {classSession.reviews.map((review) => (
                        <li
                          className="min-w-0 rounded border border-gray-100 bg-gray-50 p-3 text-sm"
                          key={review.id}
                        >
                          <p className="min-w-0 break-words font-medium text-gray-950">
                            {review.reviewer.name ?? review.reviewer.email ?? "會員"}・
                            {"★".repeat(review.rating)}
                          </p>
                          {review.comment ? (
                            <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-gray-600">
                              {review.comment}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {classSession.origin === "teacher_initiated" &&
              ["draft", "open_for_enrollment"].includes(classSession.status) ? (
                <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-3">
                  {classSession.status === "draft" ? (
                    <form action={openOwnClassSessionForEnrollmentAction}>
                      <input name="classSessionId" type="hidden" value={classSession.id} />
                      <button
                        className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-sky-300 hover:bg-sky-50"
                        type="submit"
                      >
                        開放報名
                      </button>
                    </form>
                  ) : null}
                  <form action={cancelOwnClassSessionAction}>
                    <input name="classSessionId" type="hidden" value={classSession.id} />
                    <button
                      className="rounded border border-amber-200 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-50"
                      type="submit"
                    >
                      取消課程
                    </button>
                  </form>
                </div>
              ) : null}

              {classSession.origin === "teacher_initiated" &&
              classSession.status === "open_for_enrollment" ? (
                <form action={completeOwnClassSessionAction}>
                  <input name="classSessionId" type="hidden" value={classSession.id} />
                  <button
                    className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-emerald-300 hover:bg-emerald-50"
                    type="submit"
                  >
                    標記完成
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
