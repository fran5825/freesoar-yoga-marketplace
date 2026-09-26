import Link from "next/link";
import { notFound } from "next/navigation";

import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { formatTeacherRatingSummary } from "@/domain/review/rating-summary";
import { getTeacherProfileForAdmin } from "@/domain/teacher-profile/service";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { requireAdmin } from "@/lib/auth/session";

import { AdminConfirmButton } from "../../_components/AdminConfirmButton";
import { AdminFlash, type AdminFlashParams } from "../../_components/AdminFlash";
import { ReasonTemplateField } from "../../_components/ReasonTemplateField";
import { teacherRejectionTemplates } from "../../_components/reason-templates";
import {
  approveTeacherProfileApplicationAction,
  rejectTeacherProfileApplicationAction,
  restoreTeacherProfileAction,
  suspendTeacherProfileAction,
} from "../actions";
import { adminTeacherStatusLabels, adminTeacherStatusToneClasses } from "../status-labels";

type AdminTeacherDetailPageProps = {
  params: Promise<{ teacherProfileId: string }>;
  searchParams?: Promise<AdminFlashParams>;
};

// 票 06：老師審核詳情頁。順序：下一步（審核按鈕）→ 聯絡方式 → 老師資料。
// 已處理過（通過、暫停、退回）的申請，只顯示結果與該狀態下允許的操作，不再顯示審核按鈕。
export default async function AdminTeacherDetailPage({
  params,
  searchParams,
}: AdminTeacherDetailPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const { teacherProfileId } = await params;
  const [teacher, resolvedSearchParams] = await Promise.all([
    getTeacherProfileForAdmin(teacherProfileId),
    searchParams,
  ]);

  if (!teacher) {
    notFound();
  }

  const name = teacher.displayName ?? "未填顯示名稱";

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="text-sm font-medium text-clay underline underline-offset-4"
          href="/admin/teachers"
        >
          ← 回老師列表
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
            {name}
          </h1>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${adminTeacherStatusToneClasses[teacher.status]}`}
          >
            {adminTeacherStatusLabels[teacher.status]}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {teacher.status === "submitted" ? "送審於" : "最後更新"}{" "}
          {formatRelativeTime(teacher.updatedAt)}（{formatTaipeiDatetime(teacher.updatedAt)}）
        </p>
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} />

      <section
        aria-labelledby="next-step-title"
        className="grid gap-4 rounded-2xl border border-pine/25 bg-pine-tint p-6"
      >
        {teacher.status === "submitted" ? (
          <>
            <div>
              <h2 className="text-xl font-semibold text-ink" id="next-step-title">
                審核這位老師的申請
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                看完下方資料後決定。通過後老師可以回應需求、開設自己的課程；退回時，原因會顯示給老師。
              </p>
            </div>
            <form action={approveTeacherProfileApplicationAction}>
              <input name="teacherProfileId" type="hidden" value={teacher.id} />
              <button
                className="w-full rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
                type="submit"
              >
                通過申請
              </button>
            </form>
            <form
              action={rejectTeacherProfileApplicationAction}
              className="grid gap-3 rounded-xl border border-rose-200 bg-white p-4"
            >
              <input name="teacherProfileId" type="hidden" value={teacher.id} />
              <input name="confirmReject" type="hidden" value="yes" />
              <ReasonTemplateField
                hint="此說明會顯示給老師，請具體、溫和地寫出需要修正的方向（10–1000 字）。"
                id="reject-reason"
                label="退回原因"
                maxLength={1000}
                minLength={10}
                name="rejectionReason"
                placeholder="例如：教學經歷需要更具體，請補充帶領團課的實際經驗與時數。"
                templates={teacherRejectionTemplates}
              />
              <button
                className="w-full rounded-full bg-rose-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
                type="submit"
              >
                退回申請
              </button>
            </form>
          </>
        ) : null}

        {teacher.status === "approved" ? (
          <>
            <div>
              <h2 className="text-xl font-semibold text-ink" id="next-step-title">
                這位老師已通過審核
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {formatTeacherRatingSummary({
                  averageRating: teacher.averageRating,
                  reviewCount: teacher.reviewCount,
                })}
                。需要時可以暫停這位老師。
              </p>
            </div>
            <form
              action={suspendTeacherProfileAction}
              className="grid gap-3 rounded-xl border border-rose-200 bg-white p-4"
            >
              <input name="teacherProfileId" type="hidden" value={teacher.id} />
              <input name="confirmSuspend" type="hidden" value="yes" />
              <ReasonTemplateField
                hint="此說明會顯示給老師，請具體、溫和地寫出暫停的原因（10–1000 字）。"
                id="suspend-reason"
                label="暫停原因"
                maxLength={1000}
                minLength={10}
                name="suspensionReason"
                placeholder="例如：近期收到多筆課程品質相關反映，需要先暫停接受新需求。"
                templates={[]}
              />
              <div>
                <AdminConfirmButton
                  confirmLabel="確認暫停"
                  description="暫停後，這位老師無法再被團主選定，暫停原因會顯示給老師。已建立的課程不受影響。"
                  title={`確定要暫停 ${name} 嗎？`}
                  triggerLabel="暫停這位老師"
                />
              </div>
            </form>
          </>
        ) : null}

        {teacher.status === "suspended" ? (
          <>
            <div>
              <h2 className="text-xl font-semibold text-ink" id="next-step-title">
                這位老師目前暫停中
              </h2>
              {teacher.suspensionReason ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
                  暫停原因：{teacher.suspensionReason}
                </p>
              ) : null}
            </div>
            <form action={restoreTeacherProfileAction}>
              <input name="teacherProfileId" type="hidden" value={teacher.id} />
              <input name="confirmRestore" type="hidden" value="yes" />
              <button
                className="w-full rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
                type="submit"
              >
                恢復這位老師
              </button>
            </form>
          </>
        ) : null}

        {teacher.status === "rejected" ? (
          <div>
            <h2 className="text-xl font-semibold text-ink" id="next-step-title">
              這份申請已退回
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
              {teacher.rejectionReason
                ? `退回原因：${teacher.rejectionReason}`
                : "老師修改後可以重新送審。"}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-ink sm:col-span-2">聯絡方式</h2>
        <Field label="帳號名稱" value={teacher.user.name} />
        <Field label="Email" value={teacher.user.email} />
        <Field label="電話" value={teacher.user.phone} />
      </section>

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-ink sm:col-span-2">老師資料</h2>
        <Field
          label="教學年資"
          value={
            typeof teacher.experienceYears === "number" ? `${teacher.experienceYears} 年` : null
          }
        />
        <Field label="價格區間" value={teacher.priceRange} />
        {teacher.status === "approved" || teacher.status === "suspended" ? (
          <Field
            label="評價"
            value={formatTeacherRatingSummary({
              averageRating: teacher.averageRating,
              reviewCount: teacher.reviewCount,
            })}
          />
        ) : null}
        <List label="擅長類型" values={teacher.specialties} />
        <List label="服務地區" values={teacher.serviceAreas} />
        <List label="授課形式" values={teacher.teachingFormats} />
        <List label="證照" values={teacher.certifications} />
        <Field label="簡介" multiline value={teacher.bio} wide />
        <Field label="教學風格" multiline value={teacher.teachingStyle} wide />
        <Field label="照片連結" value={teacher.profilePhotoUrl} wide />
        <Field
          label="偏好課程長度"
          value={
            typeof teacher.preferredSessionLengthMinutes === "number"
              ? `${teacher.preferredSessionLengthMinutes} 分鐘`
              : null
          }
        />
        <Field label="偏好頻率" value={teacher.preferredFrequency} />
        <Field label="偏好地點類型" value={teacher.preferredLocationType} />
        <Field label="偏好補充" multiline value={teacher.preferenceNotes} wide />
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  multiline,
  wide,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <h3 className="font-medium text-ink">{label}</h3>
      <p
        className={`mt-1 break-words leading-6 text-ink-soft ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value && value.trim().length > 0 ? value : "尚未填寫"}
      </p>
    </div>
  );
}

function List({ label, values }: { label: string; values: string[] }) {
  return <Field label={label} value={values.length > 0 ? values.join("、") : null} />;
}
