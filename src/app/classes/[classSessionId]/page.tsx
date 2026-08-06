import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getClassSessionForMember } from "@/domain/enrollment/read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireUser } from "@/lib/auth/session";

import { enrollAction } from "./actions";

// teacher-initiated-open-classes 第 8 節（Gate G2/G3）：pending 是三態顯示的第三態，不再是
// 「非 confirmed 就當作已取消」的二元判斷——沿用 member/enrollments/page.tsx 既有的
// enrollmentStatusLabels 文案，保持兩處用語一致。
const ownEnrollmentStatusLabels: Record<string, string> = {
  confirmed: "已報名",
  pending: "處理中",
  cancelled: "已取消",
};

type MemberClassSessionPageProps = {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

export default async function MemberClassSessionPage({
  params,
  searchParams,
}: MemberClassSessionPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [{ classSessionId }, resolvedSearchParams] = await Promise.all([
    params,
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

  // D4：draft 一律回傳 null（not-found），open_for_enrollment 才會回傳，
  // 即使 startAt 已過（D14：那時交由下方的時間檢查顯示「目前無法報名」）。
  const classSession = await getClassSessionForMember(classSessionId);

  if (!classSession) {
    notFound();
  }

  const hasStarted = hasClassSessionStarted(classSession.startAt);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Class</p>
        <h1 className="mt-2 min-w-0 break-words text-2xl font-semibold tracking-tight text-gray-950">
          {classSession.title}
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

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
        <dl className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-medium text-gray-950">團體</dt>
            <dd className="mt-1 break-words">{classSession.organization?.name ?? "老師自己開的課"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-medium text-gray-950">授課老師</dt>
            <dd className="mt-1 break-words">
              {classSession.teacherProfile.displayName ?? "老師"}
            </dd>
          </div>
          {classSession.serviceType ? (
            <div className="min-w-0">
              <dt className="font-medium text-gray-950">課程類型</dt>
              <dd className="mt-1 break-words">{classSession.serviceType}</dd>
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
        </dl>
        {classSession.description ? (
          <div className="min-w-0">
            <p className="font-medium text-gray-950">課程說明</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
              {classSession.description}
            </p>
          </div>
        ) : null}
      </section>

      {classSession.ownEnrollment ? (
        <section className="grid gap-3 rounded border border-gray-200 bg-white p-6">
          <span className="w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
            {ownEnrollmentStatusLabels[classSession.ownEnrollment.status] ??
              classSession.ownEnrollment.status}
          </span>
          {classSession.ownEnrollment.status === "pending" ? (
            <p className="text-sm leading-6 text-gray-600">
              你的報名已經送出，等待老師確認後才算成立。
            </p>
          ) : null}
          {["confirmed", "pending"].includes(classSession.ownEnrollment.status) ? (
            <p className="text-sm leading-6 text-gray-600">
              如需取消報名，請前往
              <Link className="text-sky-700 underline" href="/member/enrollments">
                我的報名列表
              </Link>
              。
            </p>
          ) : null}
        </section>
      ) : hasStarted ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <p className="text-sm leading-6 text-gray-600">
            這堂課程目前無法報名，可能已經開始。
          </p>
        </section>
      ) : (
        <section className="grid gap-5 rounded border border-gray-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-medium text-gray-950">報名這堂課程</h2>
          </div>

          <form action={enrollAction} className="grid gap-4">
            <input name="classSessionId" type="hidden" value={classSessionId} />

            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="notes">
                備註（選填）
              </label>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                例如身體狀況提醒，讓老師與團主更了解你的需求。
              </p>
              <textarea
                className="mt-2 min-h-20 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                id="notes"
                maxLength={500}
                name="notes"
              />
            </div>

            <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
              <input
                className="mt-1 shrink-0"
                name="basicConsent"
                required
                type="checkbox"
                value="yes"
              />
              我了解此課程非醫療行為，會依自身身體狀況參與。
            </label>

            <button
              className="w-full rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800 sm:w-auto"
              type="submit"
            >
              確認報名
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function hasClassSessionStarted(startAt: Date): boolean {
  return startAt.getTime() <= Date.now();
}
