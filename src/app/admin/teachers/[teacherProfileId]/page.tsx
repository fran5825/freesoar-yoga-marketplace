import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMultiChoiceText } from "@/app/teachers/join/_lib/application-fields";
import { countClassSessionsForTeacherForAdmin } from "@/domain/class-session/admin-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { formatTeacherRatingSummary } from "@/domain/review/rating-summary";
import { listTeacherPhotosForAdmin } from "@/domain/teacher-photo/admin-service";
import { getTeacherProfileForAdmin } from "@/domain/teacher-profile/service";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { requireAdmin } from "@/lib/auth/session";

import { AdminConfirmButton } from "../../_components/AdminConfirmButton";
import { AdminFlash, type AdminFlashParams } from "../../_components/AdminFlash";
import { AdminReviewPanel } from "../../_components/AdminReviewPanel";
import { adminDetailHref, adminListHref, safeAdminReturnTo } from "../../_lib/list-context";
import { teacherRejectionTemplates } from "../../_components/reason-templates";
import {
  approveTeacherProfileApplicationAction,
  rejectTeacherProfileApplicationAction,
  removeTeacherPhotoAdminAction,
} from "../actions";
import { adminTeacherStatusLabels, adminTeacherStatusToneClasses } from "../status-labels";
import { TeacherStatusPanel } from "./TeacherStatusPanel";

type AdminTeacherDetailPageProps = {
  params: Promise<{ teacherProfileId: string }>;
  searchParams?: Promise<AdminFlashParams & { returnTo?: string }>;
};

// 第二批票 05：老師詳情頁先閱讀再操作。順序：返回 → 對象／狀態／時間與摘要 → 教學資料 →
// 聯絡方式 → 其他資料（收合）→ 操作區；頁首有跳到操作區的連結，不重複放整套表單。
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
  const [teacher, resolvedSearchParams, classSessionCount, photos] = await Promise.all([
    getTeacherProfileForAdmin(teacherProfileId),
    searchParams,
    countClassSessionsForTeacherForAdmin(teacherProfileId),
    listTeacherPhotosForAdmin(teacherProfileId),
  ]);

  if (!teacher) {
    notFound();
  }

  const name = teacher.displayName ?? "未填顯示名稱";
  const returnTo = safeAdminReturnTo("teachers", resolvedSearchParams?.returnTo);
  const hasAction = teacher.status !== "rejected";
  const summary = [
    teacher.serviceAreas.length > 0 ? teacher.serviceAreas.join("、") : null,
    typeof teacher.experienceYears === "number" ? `教學 ${teacher.experienceYears} 年` : null,
    teacher.teachingFormats.length > 0 ? teacher.teachingFormats.join("、") : null,
  ].filter(Boolean);
  const ratingSummary = formatTeacherRatingSummary({
    averageRating: teacher.averageRating,
    reviewCount: teacher.reviewCount,
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="text-sm font-medium text-clay underline underline-offset-4"
          href={returnTo}
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
        {summary.length > 0 ? (
          <p className="mt-2 break-words text-sm leading-6 text-ink">{summary.join("・")}</p>
        ) : null}
        {hasAction ? (
          <a
            className="mt-4 inline-flex w-full justify-center rounded-full border border-pine/40 px-5 py-2 text-sm font-medium text-pine transition hover:border-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
            href="#teacher-actions"
          >
            {teacher.status === "submitted" ? "前往審核操作" : "前往狀態操作"}
          </a>
        ) : null}
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} />

      {teacher.status === "rejected" ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">這份申請已退回</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
            {teacher.rejectionReason
              ? `退回原因：${teacher.rejectionReason}`
              : "老師修改後可以重新送審。"}
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-ink sm:col-span-2">教學資料</h2>
        <Field
          label="教學年資"
          value={
            typeof teacher.experienceYears === "number" ? `${teacher.experienceYears} 年` : null
          }
        />
        {teacher.status === "approved" || teacher.status === "suspended" ? (
          <Field label="評價" value={ratingSummary} />
        ) : null}
        {/* 第三批票 09：有課程才給入口，數量與課程列表限定後的「全部」一致。 */}
        <div className="grid gap-1">
          <p className="text-sm font-medium text-ink">課程</p>
          {classSessionCount > 0 ? (
            <Link
              className="w-fit text-sm font-medium text-clay underline underline-offset-4"
              href={adminListHref("classes", { teacherProfileId: teacher.id })}
            >
              這位老師的課程（{classSessionCount}）
            </Link>
          ) : (
            <p className="text-sm text-ink-soft">尚無課程</p>
          )}
        </div>
        <List label="擅長類型" values={teacher.specialties} />
        <List label="服務地區" values={teacher.serviceAreas} />
        <List label="授課形式" values={teacher.teachingFormats} />
        <Field label="簡介" multiline value={teacher.bio} wide />
        <Field label="教學風格" multiline value={teacher.teachingStyle} wide />
      </section>

      {photos.length > 0 ? (
        <section aria-labelledby="teacher-photos-title" className="grid scroll-mt-6 gap-4 rounded-2xl border border-ink/15 bg-white p-6" id="teacher-photos">
          <div>
            <h2 className="text-lg font-semibold text-ink" id="teacher-photos-title">老師的照片（{photos.filter((photo) => photo.status === "active").length}）</h2>
            <p className="mt-1 text-sm leading-6 text-ink-soft">
              若照片不適當，可以下架：會立即從所有頁面消失（頭像與課程封面也一併拿掉），老師會在通知裡看到你寫的原因，之後可以重新上傳。
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <li className="grid min-w-0 gap-3 rounded-2xl border border-ink/10 bg-cream p-3" key={photo.id}>
                {photo.status === "active" && photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`第 ${index + 1} 張照片${photo.isAvatar ? "（頭像）" : ""}`} className="aspect-[3/2] w-full rounded-xl bg-white object-cover" src={photo.url} />
                ) : (
                  <div className="grid aspect-[3/2] place-items-center rounded-xl bg-white text-sm text-ink-soft">已下架</div>
                )}
                {photo.status === "active" ? (
                  <form action={removeTeacherPhotoAdminAction} className="grid gap-2">
                    <input name="photoId" type="hidden" value={photo.id} />
                    <input name="teacherProfileId" type="hidden" value={teacher.id} />
                    <input name="returnTo" type="hidden" value={returnTo} />
                    <label className="text-xs font-medium text-ink" htmlFor={`remove-reason-${photo.id}`}>
                      下架原因（必填，老師會看到）
                    </label>
                    <textarea
                      className="min-h-16 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink focus:outline-2 focus:outline-clay"
                      id={`remove-reason-${photo.id}`}
                      maxLength={500}
                      minLength={5}
                      name="reason"
                      placeholder="例如：照片中有其他人的臉，無法確認對方同意。"
                      required
                    />
                    <AdminConfirmButton
                      confirmLabel="確認下架這張照片"
                      description="照片會立即從所有頁面消失，老師的頭像與課程封面若用到它也會一併拿掉；無法復原，老師可以重新上傳。"
                      pendingLabel="下架處理中…"
                      title="確定要下架這張照片嗎？"
                      triggerClassName="w-fit rounded-full border border-rose-300 px-4 py-1.5 text-sm font-medium text-rose-800 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-60"
                      triggerLabel="下架這張照片"
                    />
                  </form>
                ) : (
                  <p className="min-w-0 break-words text-xs leading-5 text-ink-soft">
                    下架原因：{photo.removedReason ?? "（未記錄）"}
                    {photo.removedAt ? `・${formatTaipeiDatetime(photo.removedAt)}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-ink sm:col-span-2">聯絡方式</h2>
        <Field label="帳號名稱" value={teacher.user.name} />
        <Field label="Email" value={teacher.user.email} />
        <Field label="電話" value={teacher.user.phone} />
      </section>

      <details className="group rounded-2xl border border-ink/15 bg-white p-6">
        <summary className="cursor-pointer text-lg font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay">
          其他資料：證照、價格與上課偏好
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <List label="證照" values={teacher.certifications} />
          <Field label="價格區間" value={teacher.priceRange} />
          <Field label="舊版照片連結（已停用，不再顯示給任何人）" value={teacher.profilePhotoUrl} wide />
          <Field
            label="偏好課程長度"
            value={
              typeof teacher.preferredSessionLengthMinutes === "number"
                ? `${teacher.preferredSessionLengthMinutes} 分鐘`
                : null
            }
          />
          <Field label="偏好頻率" value={formatMultiChoiceText(teacher.preferredFrequency)} />
          <Field label="偏好地點類型" value={formatMultiChoiceText(teacher.preferredLocationType)} />
          <Field label="偏好補充" multiline value={teacher.preferenceNotes} wide />
        </div>
      </details>

      {hasAction ? (
      <section
        aria-labelledby="next-step-title"
        className="grid scroll-mt-6 gap-4 rounded-2xl border border-pine/25 bg-pine-tint p-6"
        id="teacher-actions"
      >
        {teacher.status === "submitted" ? (
          <>
            <div>
              <h2 className="text-xl font-semibold text-ink" id="next-step-title">
                審核這位老師的申請
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                通過後老師可以回應需求、開設自己的課程；退回時，原因會顯示給老師，老師補充後可以重新送審。
              </p>
            </div>
            <AdminReviewPanel
              approveAction={approveTeacherProfileApplicationAction}
              detailHref={adminDetailHref("teachers", teacher.id, returnTo)}
              id={teacher.id}
              idField="teacherProfileId"
              labels={{
                approve: "通過申請",
                approvePending: "通過處理中…",
                approveRetry: "這位老師仍是待審，可以稍後再按一次通過。",
                rejectOpen: "退回申請",
                rejectPending: "退回處理中…",
                backToList: "回老師列表",
              }}
              reasonHint="老師會在申請頁看到這段原因，請具體、溫和地寫出需要補充的方向（10–1000 字）。"
              reasonPlaceholder="可以點上方常用原因帶入，再依這位老師的情況修改。"
              rejectAction={rejectTeacherProfileApplicationAction}
              returnTo={returnTo}
              templates={teacherRejectionTemplates}
            />
          </>
        ) : null}

        {teacher.status === "approved" ? (
          <>
            <div>
              <h2 className="text-xl font-semibold text-ink" id="next-step-title">
                這位老師已通過審核
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {ratingSummary}。需要時可以暫停這位老師。
              </p>
            </div>
            <TeacherStatusPanel
              detailHref={adminDetailHref("teachers", teacher.id, returnTo)}
              name={name}
              returnTo={returnTo}
              status="approved"
              teacherProfileId={teacher.id}
            />
          </>
        ) : null}

        {teacher.status === "suspended" ? (
          <>
            <div>
              <h2 className="text-xl font-semibold text-ink" id="next-step-title">
                這位老師目前暫停中
              </h2>
              {teacher.suspensionReason ? (
                <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-6 text-ink-soft">
                  暫停原因：{teacher.suspensionReason}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                恢復後，老師可以再被團主選定。
              </p>
            </div>
            <TeacherStatusPanel
              detailHref={adminDetailHref("teachers", teacher.id, returnTo)}
              name={name}
              returnTo={returnTo}
              status="suspended"
              teacherProfileId={teacher.id}
            />
          </>
        ) : null}
      </section>
      ) : null}
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
        className={`mt-1 wrap-anywhere leading-6 text-ink-soft ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value && value.trim().length > 0 ? value : "尚未填寫"}
      </p>
    </div>
  );
}

function List({ label, values }: { label: string; values: string[] }) {
  return <Field label={label} value={values.length > 0 ? values.join("、") : null} />;
}
