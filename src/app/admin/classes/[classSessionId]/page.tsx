import Link from "next/link";
import { notFound } from "next/navigation";

import { demandRequestTargetLevelLabels } from "@/app/organizer/demands/_components/status-labels";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";
import { getClassSessionDetailForAdmin } from "@/domain/class-session/admin-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireAdmin } from "@/lib/auth/session";

import { AdminConfirmButton } from "../../_components/AdminConfirmButton";
import { AdminFlash } from "../../_components/AdminFlash";
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

  const classSession = await getClassSessionDetailForAdmin(classSessionId);

  if (!classSession) {
    notFound();
  }

  const started = hasClassSessionStarted(classSession.startAt);
  const canCancelClassSession =
    CANCELLABLE_CLASS_SESSION_STATUSES.has(classSession.status) && !started;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="text-sm font-medium text-clay underline underline-offset-4"
          href="/admin/classes"
        >
          ← 回課程列表
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
          >
            {classSessionStatusLabels[classSession.status]}
          </span>
        </div>
        <h1 className="mt-2 min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
          {classSession.title}
        </h1>
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} />

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <PartyField
          details={[classSession.organizerProfile?.user.email]}
          label="團主"
          name={classSession.organizerProfile?.displayName ?? "（老師自建課程）"}
        />
        <PartyField
          details={[classSession.teacherProfile.user.email]}
          label="授課老師"
          name={classSession.teacherProfile.displayName ?? "尚未填寫顯示名稱"}
        />
        <PartyField
          details={
            classSession.organization
              ? [
                  organizationTypeLabels[classSession.organization.type],
                  classSession.organization.contactName
                    ? `聯絡人：${classSession.organization.contactName}`
                    : null,
                  classSession.organization.contactEmail,
                  classSession.organization.contactPhone,
                ]
              : []
          }
          label="團體"
          name={classSession.organization?.name ?? "（老師自建課程）"}
        />
        <DetailField label="課程類型" value={classSession.serviceType} />
        <DetailField
          label="程度"
          value={
            classSession.demandRequest?.targetLevel
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

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
        <h2 className="text-lg font-medium text-ink">
          報名名單（{classSession.roster.length} 人）
        </h2>
        {classSession.roster.length === 0 ? (
          <p className="text-sm leading-6 text-ink-soft">目前還沒有任何報名紀錄。</p>
        ) : (
          <ul className="grid gap-2">
            {classSession.roster.map((entry) => (
              <li
                className="min-w-0 rounded-2xl border border-ink/10 bg-cream p-3 text-sm"
                key={entry.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words font-medium text-ink">
                    {entry.memberLabel}
                  </p>
                  <span className="w-fit rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink-soft">
                    {enrollmentStatusLabels[entry.status] ?? entry.status}
                  </span>
                </div>
                {entry.notes ? (
                  <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-ink-soft">
                    {entry.notes}
                  </p>
                ) : null}

                {entry.status === "confirmed" && !started ? (
                  <form action={cancelEnrollmentAdminAction} className="mt-2">
                    <input name="classSessionId" type="hidden" value={classSessionId} />
                    <input name="enrollmentId" type="hidden" value={entry.id} />
                    <input name="confirmCancel" type="hidden" value="yes" />
                    <AdminConfirmButton
                      confirmLabel="確認取消報名"
                      description="取消後無法復原，也無法重新建立這筆報名，學員會收到通知。"
                      title="確定要取消這筆報名嗎？"
                      triggerClassName="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-800 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                      triggerLabel="取消這筆報名"
                    />
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canCancelClassSession ? (
        <section className="grid gap-3 rounded-2xl border border-rose-200 bg-white p-6">
          <h2 className="text-lg font-medium text-rose-800">取消課程</h2>
          <p className="text-sm leading-6 text-ink-soft">
            取消後無法復原，也無法重新建立，已報名的學員報名也會一併取消，並會收到通知。
          </p>
          <form action={cancelClassSessionAdminAction}>
            <input name="classSessionId" type="hidden" value={classSessionId} />
            <input name="confirmCancel" type="hidden" value="yes" />
            <AdminConfirmButton
              confirmLabel="確認取消課程"
              description="取消後無法復原，也無法重新建立。已報名的學員報名會一併取消，並會收到通知。"
              title="確定要取消這堂課程嗎？"
              triggerLabel="取消課程"
            />
          </form>
        </section>
      ) : null}
    </div>
  );
}

// 人與團體：名稱之外附上聯絡方式，讓管理員分辨「是誰」（同名時也看得出差別）。
function PartyField({
  label,
  name,
  details,
}: {
  label: string;
  name: string;
  details: (string | null | undefined)[];
}) {
  const lines = details.filter((line): line is string => Boolean(line));

  return (
    <div className="min-w-0 text-sm">
      <h3 className="font-medium text-ink">{label}</h3>
      <p className="mt-2 break-words font-medium leading-6 text-ink">{name}</p>
      {lines.map((line) => (
        <p className="break-words leading-6 text-ink-soft" key={line}>
          {line}
        </p>
      ))}
    </div>
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
      <h3 className="font-medium text-ink">{label}</h3>
      <p
        className={`mt-2 break-words leading-6 text-ink-soft ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value && value.trim().length > 0 ? value : "尚未填寫"}
      </p>
    </div>
  );
}

function hasClassSessionStarted(startAt: Date): boolean {
  return startAt.getTime() <= Date.now();
}
