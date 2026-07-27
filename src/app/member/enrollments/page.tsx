import { redirect } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { listOwnEnrollmentsForMember } from "@/domain/enrollment/read-service";
import { requireUser } from "@/lib/auth/session";

import { cancelEnrollmentAction } from "./actions";

type MemberEnrollmentsPageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
};

const enrollmentStatusLabels: Record<string, string> = {
  pending: "處理中",
  confirmed: "已報名",
  cancelled: "已取消",
};

export default async function MemberEnrollmentsPage({
  searchParams,
}: MemberEnrollmentsPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [enrollments, resolvedSearchParams] = await Promise.all([
    listOwnEnrollmentsForMember(),
    searchParams,
  ]);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success"
              ? ("success" as const)
              : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Member</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          我的報名
        </h1>
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

      {enrollments.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">目前沒有任何報名</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            透過團主分享的課程連結報名後，會顯示在這裡。
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {enrollments.map((enrollment) => (
            <article
              className="grid gap-3 rounded border border-gray-200 bg-white p-5"
              key={enrollment.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-lg font-medium text-gray-950">
                  {enrollment.classSession.title}
                </h2>
                <span className="w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                  {enrollmentStatusLabels[enrollment.status] ?? enrollment.status}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {formatTaipeiDatetime(enrollment.classSession.startAt)} 開始・
                {enrollment.classSession.location}
              </p>

              {enrollment.status === "confirmed" ? (
                <details className="rounded border border-amber-200 bg-amber-50/60">
                  <summary className="cursor-pointer list-none rounded px-4 py-2 text-sm font-medium text-amber-800 marker:hidden">
                    取消報名…
                  </summary>
                  <form
                    action={cancelEnrollmentAction}
                    className="grid gap-3 border-t border-amber-100 p-4"
                  >
                    <input name="enrollmentId" type="hidden" value={enrollment.id} />
                    <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
                      <input
                        className="mt-1 shrink-0"
                        name="confirmCancel"
                        required
                        type="checkbox"
                        value="yes"
                      />
                      我確認要取消這則報名。
                    </label>
                    <button
                      className="w-full rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 sm:w-auto"
                      type="submit"
                    >
                      確認取消
                    </button>
                  </form>
                </details>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
