import { notFound, redirect } from "next/navigation";

import { getOwnClassSessionDetailForOrganizer } from "@/domain/class-session/read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireUser } from "@/lib/auth/session";

import { demandRequestTargetLevelLabels } from "../../demands/_components/status-labels";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "../_components/status-labels";

type OrganizerClassSessionDetailPageProps = {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

export default async function OrganizerClassSessionDetailPage({
  params,
  searchParams,
}: OrganizerClassSessionDetailPageProps) {
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

  const classSession = await getOwnClassSessionDetailForOrganizer(classSessionId);

  if (!classSession) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-gray-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-amber-700">Organizer classes</p>
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
        <DetailField label="授課老師" value={classSession.teacherProfile.displayName} />
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
