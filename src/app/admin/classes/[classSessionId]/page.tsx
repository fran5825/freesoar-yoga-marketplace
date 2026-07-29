import { notFound } from "next/navigation";

import { demandRequestTargetLevelLabels } from "@/app/organizer/demands/_components/status-labels";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import { getClassSessionDetailForAdmin } from "@/domain/class-session/admin-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireAdmin } from "@/lib/auth/session";

import { cancelClassSessionAdminAction, cancelEnrollmentAdminAction } from "./actions";

type AdminClassSessionDetailPageProps = {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

const enrollmentStatusLabels: Record<string, string> = {
  pending: "處理中",
  confirmed: "已報名",
  cancelled: "已取消",
  attended: "已出席",
  no_show: "未出席",
};

const CANCELLABLE_CLASS_SESSION_STATUSES = new Set(["draft", "open_for_enrollment"]);

export default async function AdminClassSessionDetailPage({
  params,
  searchParams,
}: AdminClassSessionDetailPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const [{ classSessionId }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success" ? ("success" as const) : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  const classSession = await getClassSessionDetailForAdmin(classSessionId);

  if (!classSession) {
    notFound();
  }

  const started = hasClassSessionStarted(classSession.startAt);
  const canCancelClassSession =
    CANCELLABLE_CLASS_SESSION_STATUSES.has(classSession.status) && !started;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-gray-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-sky-700">Admin classes</p>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
          >
            {classSessionStatusLabels[classSession.status]}
          </span>
        </div>
        <h1 className="mt-2 min-w-0 break-words text-3xl font-semibold tracking-tight text-gray-950">
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

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-6 sm:grid-cols-2">
        <DetailField label="團主" value={classSession.organizerProfile.displayName} />
        <DetailField label="授課老師" value={classSession.teacherProfile.displayName} />
        <DetailField label="團體" value={classSession.organization.name} />
        <DetailField label="課程類型" value={classSession.serviceType} />
        <DetailField
          label="程度"
          value={
            classSession.demandRequest.targetLevel
              ? (demandRequestTargetLevelLabels[classSession.demandRequest.targetLevel] ??
                classSession.demandRequest.targetLevel)
              : null
          }
        />
        <DetailField label="開始時間" value={formatTaipeiDatetime(classSession.startAt)} />
        <DetailField label="結束時間" value={formatTaipeiDatetime(classSession.endAt)} />
        <DetailField label="地點" value={classSession.location} />
        <DetailField label="名額上限" value={`${classSession.capacity} 人`} />
        <div className="min-w-0 sm:col-span-2">
          <DetailField label="課程說明" multiline value={classSession.description} />
        </div>
      </section>

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-950">
          報名名單（{classSession.roster.length} 人）
        </h2>
        {classSession.roster.length === 0 ? (
          <p className="text-sm leading-6 text-gray-600">目前還沒有任何報名紀錄。</p>
        ) : (
          <ul className="grid gap-2">
            {classSession.roster.map((entry) => (
              <li
                className="min-w-0 rounded border border-gray-100 bg-gray-50 p-3 text-sm"
                key={entry.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words font-medium text-gray-950">
                    {entry.memberLabel}
                  </p>
                  <span className="w-fit rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {enrollmentStatusLabels[entry.status] ?? entry.status}
                  </span>
                </div>
                {entry.notes ? (
                  <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-gray-600">
                    {entry.notes}
                  </p>
                ) : null}

                {entry.status === "confirmed" && !started ? (
                  <details className="mt-2 rounded border border-rose-200 bg-rose-50/60">
                    <summary className="cursor-pointer list-none rounded px-3 py-1.5 text-xs font-medium text-rose-800 marker:hidden">
                      取消這筆報名…
                    </summary>
                    <form
                      action={cancelEnrollmentAdminAction}
                      className="grid gap-2 border-t border-rose-100 p-3"
                    >
                      <input name="classSessionId" type="hidden" value={classSessionId} />
                      <input name="enrollmentId" type="hidden" value={entry.id} />
                      <label className="flex items-start gap-2 text-xs leading-5 text-gray-700">
                        <input
                          className="mt-0.5 shrink-0"
                          name="confirmCancel"
                          required
                          type="checkbox"
                          value="yes"
                        />
                        我確認要取消這筆報名，取消後無法復原，也無法重新建立。
                      </label>
                      <button
                        className="w-full rounded bg-rose-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-800 sm:w-auto"
                        type="submit"
                      >
                        確認取消
                      </button>
                    </form>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canCancelClassSession ? (
        <section className="rounded border border-rose-200 bg-white p-6">
          <details className="grid gap-4">
            <summary className="cursor-pointer list-none text-lg font-medium text-rose-800 marker:hidden">
              取消課程…
            </summary>
            <div>
              <p className="text-sm leading-6 text-gray-600">
                取消後無法復原，也無法重新建立，已報名的會員報名也會一併取消，並會收到通知。
              </p>
            </div>
            <form action={cancelClassSessionAdminAction} className="grid gap-3">
              <input name="classSessionId" type="hidden" value={classSessionId} />
              <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
                <input
                  className="mt-1 shrink-0"
                  name="confirmCancel"
                  required
                  type="checkbox"
                  value="yes"
                />
                我確認要取消這堂課程，取消後無法復原，也無法重新建立，且已報名的會員也會一併取消。
              </label>
              <button
                className="w-full rounded bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800 sm:w-auto"
                type="submit"
              >
                確認取消課程
              </button>
            </form>
          </details>
        </section>
      ) : null}
    </main>
  );
}

function DetailField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  return (
    <div className="min-w-0 text-sm">
      <h3 className="font-medium text-gray-950">{label}</h3>
      <p
        className={`mt-2 break-words leading-6 text-gray-600 ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value && value.trim().length > 0 ? value : "尚未填寫"}
      </p>
    </div>
  );
}

function hasClassSessionStarted(startAt: Date): boolean {
  return startAt.getTime() <= Date.now();
}
