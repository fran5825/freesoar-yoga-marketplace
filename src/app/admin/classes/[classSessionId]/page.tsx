import Link from "next/link";
import { notFound } from "next/navigation";

import { demandRequestTargetLevelLabels } from "@/app/organizer/demands/_components/status-labels";
import { classOriginLabelsForAdmin } from "@/domain/class-session/origin-labels";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";
import { getClassSessionDetailForAdmin } from "@/domain/class-session/admin-service";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireAdmin } from "@/lib/auth/session";

import { AdminConfirmButton } from "../../_components/AdminConfirmButton";
import { AdminFlash } from "../../_components/AdminFlash";
import { adminDetailHref, adminListHref, safeAdminReturnTo } from "../../_lib/list-context";
import { adminClassOriginLabel } from "../origin-labels";
import { cancelClassSessionAdminAction, cancelEnrollmentAdminAction } from "./actions";

type AdminClassSessionDetailPageProps = {
  params: Promise<{ classSessionId: string }>;
  searchParams?: Promise<{ result?: string; message?: string; returnTo?: string }>;
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
  const returnTo = safeAdminReturnTo("classes", resolvedSearchParams?.returnTo);
  const canCancelClassSession =
    CANCELLABLE_CLASS_SESSION_STATUSES.has(classSession.status) && !started;
  // 第二批票 08：整堂取消會連帶取消的報名數（與取消核心相同：pending／confirmed）。
  const activeEnrollmentCount = classSession.roster.filter(
    (entry) => entry.status === "pending" || entry.status === "confirmed",
  ).length;
  // 第三批票 11：報名摘要一律用完整名單（不受之後的名單搜尋影響）；pending＋confirmed 都佔名額。
  const confirmedCount = classSession.roster.filter((entry) => entry.status === "confirmed").length;
  const pendingCount = classSession.roster.filter((entry) => entry.status === "pending").length;
  const teacherName =
    classSession.teacherProfile.status === "draft"
      ? "老師資料無法查看"
      : (classSession.teacherProfile.displayName ?? "尚未填寫顯示名稱");

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="text-sm font-medium text-clay underline underline-offset-4"
          href={returnTo}
        >
          ← 回課程列表
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
          >
            {classSessionStatusLabels[classSession.status]}
          </span>
          <span className="w-fit rounded-full border border-ink/15 px-3 py-1 text-xs text-ink-soft">
            {classOriginLabelsForAdmin[classSession.origin]}
          </span>
        </div>
        <h1 className="mt-2 min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
          {classSession.title}
        </h1>
        {/* 第三批票 11：首屏摘要——時間、地點、老師、來源與報名人數，先看清楚再往下。 */}
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <SummaryItem label="時間" value={`${formatTaipeiDatetime(classSession.startAt)} – ${formatTaipeiDatetime(classSession.endAt)}`} />
          <SummaryItem label="地點" value={classSession.location} />
          <SummaryItem label="授課老師" value={teacherName} />
          <SummaryItem label="來源" value={adminClassOriginLabel(classSession.origin)} />
          <div className="min-w-0 sm:col-span-2">
            <dt className="font-medium text-ink">報名</dt>
            <dd className="mt-1 break-words leading-6 text-ink-soft">
              已報名 {confirmedCount} 人・待老師確認 {pendingCount} 人・名額佔用 {confirmedCount + pendingCount}／{classSession.capacity}
              <span className="block text-xs text-ink-faint">已報名與待老師確認都會佔用名額。</span>
            </dd>
          </div>
        </dl>
        {canCancelClassSession ? (
          <a
            className="mt-4 inline-flex w-full justify-center rounded-full border border-rose-300 px-5 py-2 text-sm font-medium text-rose-800 transition hover:border-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
            href="#class-actions"
          >
            前往取消操作
          </a>
        ) : null}
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} />

      <section aria-labelledby="content-title" className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-medium text-ink sm:col-span-2" id="content-title">課程內容</h2>
        <DetailField label="課程風格" value={getClassServiceTypes(classSession).join("、") || null} />
        <DetailField label="瑜伽類型" value={classSession.yogaStyles.join("、") || null} />
        <DetailField label="報名方式" value={classSession.requiresApproval ? "需老師確認" : "直接報名"} />
        <DetailField label="公開狀態" value={classSession.isPublic ? "公開" : "不公開"} />
        <DetailField
          label="程度"
          value={
            classSession.demandRequest?.targetLevel
              ? (demandRequestTargetLevelLabels[classSession.demandRequest.targetLevel] ??
                classSession.demandRequest.targetLevel)
              : null
          }
        />
        <div className="min-w-0 sm:col-span-2">
          <DetailField label="課程說明" multiline value={classSession.description} />
        </div>
      </section>

      <section aria-labelledby="parties-title" className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-3">
        <h2 className="text-lg font-medium text-ink sm:col-span-3" id="parties-title">團主、老師與團體</h2>
        <PartyField
          details={[classSession.organizerProfile?.user.email]}
          label="團主"
          name={classSession.organizerProfile?.displayName ?? "（老師自建課程）"}
        />
        <PartyField
          details={[classSession.teacherProfile.user.email]}
          label="授課老師"
          name={teacherName}
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
      </section>

      {/* 第三批票 10：相關資料。只有存在且管理員看得到的關聯才給連結；沒有就寫中性文字，不做死連結。 */}
      <section aria-labelledby="related-title" className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-3">
        <h2 className="text-lg font-medium text-ink sm:col-span-3" id="related-title">相關資料</h2>
        <RelatedField
          href={classSession.teacherProfile.status !== "draft" ? adminDetailHref("teachers", classSession.teacherProfile.id) : null}
          label="授課老師"
          linkText={`查看老師「${classSession.teacherProfile.displayName ?? "未填顯示名稱"}」`}
          fallback="老師資料無法查看"
        />
        <RelatedField
          href={classSession.demandRequest && classSession.demandRequest.status !== "draft" ? adminDetailHref("demands", classSession.demandRequest.id) : null}
          label="來源需求"
          linkText="查看來源需求"
          fallback="沒有來源需求"
        />
        <RelatedField
          href={classSession.organization ? adminListHref("organizations", { organizationId: classSession.organization.id }) : null}
          label="所屬團體"
          linkText={`查看團體「${classSession.organization?.name ?? ""}」`}
          fallback="沒有所屬團體"
        />
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
                    <input name="returnTo" type="hidden" value={returnTo} />
                    <input name="classSessionId" type="hidden" value={classSessionId} />
                    <input name="enrollmentId" type="hidden" value={entry.id} />
                    <input name="confirmCancel" type="hidden" value="yes" />
                    <input name="memberLabel" type="hidden" value={entry.memberLabel} />
                    <AdminConfirmButton
                      confirmLabel="確認取消報名"
                      description={`課程：${classSession.title}。取消後無法復原，同一位學員也不能再報名這堂課；學員會收到通知。`}
                      pendingLabel="取消處理中…"
                      title={`確定要取消「${entry.memberLabel}」的報名嗎？`}
                      triggerClassName="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-800 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-60"
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
        <section className="grid scroll-mt-6 gap-3 rounded-2xl border border-rose-200 bg-white p-6" id="class-actions">
          <h2 className="text-lg font-medium text-rose-800">取消課程</h2>
          <p className="text-sm leading-6 text-ink-soft">
            取消後無法復原，也無法重新建立，已報名的學員報名也會一併取消，並會收到通知。
          </p>
          <form action={cancelClassSessionAdminAction}>
            <input name="returnTo" type="hidden" value={returnTo} />
            <input name="classSessionId" type="hidden" value={classSessionId} />
            <input name="confirmCancel" type="hidden" value="yes" />
            <AdminConfirmButton
              confirmLabel="確認取消課程"
              description={`取消後無法復原，也無法重新建立。${
                activeEnrollmentCount > 0
                  ? `目前 ${activeEnrollmentCount} 筆報名（含待老師確認）會一併取消，學員會收到通知。`
                  : "目前沒有需要一併取消的報名。"
              }`}
              pendingLabel="取消處理中…"
              title={`確定要取消「${classSession.title}」嗎？`}
              triggerClassName="w-full rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-medium text-ink">{label}</dt>
      <dd className="mt-1 break-words leading-6 text-ink-soft">{value}</dd>
    </div>
  );
}

function RelatedField({
  label,
  href,
  linkText,
  fallback,
}: {
  label: string;
  href: string | null;
  linkText: string;
  fallback: string;
}) {
  return (
    <div className="min-w-0 text-sm">
      <h3 className="font-medium text-ink">{label}</h3>
      {href ? (
        <Link
          className="mt-2 inline-block font-medium leading-6 text-clay underline underline-offset-4 wrap-anywhere"
          href={href}
        >
          {linkText}
        </Link>
      ) : (
        <p className="mt-2 leading-6 text-ink-soft">{fallback}</p>
      )}
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
