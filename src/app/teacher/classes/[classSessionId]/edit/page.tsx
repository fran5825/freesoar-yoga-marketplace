import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  getOwnClassSessionDetailForTeacher,
  getOwnRecurringClassSeriesDetailForTeacher,
} from "@/domain/class-session/read-service";
import { formatTaipeiDatetimeLocal } from "@/domain/class-session/timezone";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

import { ClassSessionCreateForm } from "../../new/_components/ClassSessionCreateForm";

type EditClassSessionPageProps = {
  params: Promise<{ classSessionId: string }>;
};

// teacher-class-scheduling 票 04：改課頁（單堂）。只讀自己的課（與詳情頁同一個 own-scoped 讀取），
// 別人的課一律 404。不能改的課（團主媒合、系列場次、已開始／完成／取消、老師非 approved）只顯示原因與返回連結；
// 真正的檢查在 domain 的鎖內，這裡只是避免顯示一張送出一定會被拒的表單。
export default async function EditClassSessionPage({ params }: EditClassSessionPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const { classSessionId } = await params;
  const [classSession, profile] = await Promise.all([
    getOwnClassSessionDetailForTeacher(classSessionId),
    getOwnTeacherProfileApplicationSnapshot(),
  ]);

  if (!classSession) {
    notFound();
  }

  const detailHref = `/teacher/classes/${classSession.id}`;
  // 名單也含「已付款後被取消」的報名（付款計畫 P9），人數只算仍有效的報名。
  const activeEnrollmentCount = classSession.enrollments.filter(
    (enrollment) => enrollment.status === "confirmed" || enrollment.status === "pending",
  ).length;
  const blockedReason =
    profile?.status !== "approved"
      ? "老師資格暫停期間不能修改課程。"
      : classSession.origin !== "teacher_initiated"
        ? "這堂課是團主安排的課，內容由團主管理，不能在這裡修改。"
        : !["draft", "open_for_enrollment"].includes(classSession.status)
            ? "這堂課已經完成或取消，不能再修改。"
            : classSession.startAt.getTime() <= new Date().getTime()
              ? "這堂課已經開始，不能再修改。"
              : null;

  // 票 05：系列場次可選「改這一場和之後所有場次」，列出這一場起尚未開始的草稿／開放報名場次。
  const series = classSession.recurringClassSeriesId
    ? await getOwnRecurringClassSeriesDetailForTeacher(classSession.recurringClassSeriesId)
    : null;
  const nowMs = new Date().getTime();
  const following = series
    ? series.occurrences
        .filter(
          (occurrence) =>
            ["draft", "open_for_enrollment"].includes(occurrence.status) &&
            occurrence.startAt.getTime() > nowMs &&
            occurrence.startAt.getTime() >= classSession.startAt.getTime(),
        )
        .map((occurrence) => ({
          date: formatTaipeiDatetimeLocal(occurrence.startAt).split("T")[0],
          enrolledCount: occurrence.confirmedCount + occurrence.pendingCount,
        }))
    : [];

  const [startDate, startTime] = formatTaipeiDatetimeLocal(classSession.startAt).split("T");
  const [, endTime] = formatTaipeiDatetimeLocal(classSession.endAt).split("T");

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium text-clay hover:underline"
          href={detailHref}
        >
          ← 回課程詳情
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">修改課程</h1>
        <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-ink-soft">
          {classSession.title}
          {activeEnrollmentCount > 0
            ? `・目前已報名（含待確認）${activeEnrollmentCount} 人，改時間或地點會通知他們。`
            : ""}
        </p>
      </header>

      {blockedReason ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <p className="text-sm leading-6 text-ink-soft">{blockedReason}</p>
          <div>
            <Link
              className="inline-flex min-h-11 items-center rounded-full border border-ink/25 px-5 py-2 text-sm font-medium text-ink"
              href={detailHref}
            >
              回課程詳情
            </Link>
          </div>
        </section>
      ) : (
        <ClassSessionCreateForm
          defaults={null}
          edit={{
            classSessionId: classSession.id,
            title: classSession.title,
            description: classSession.description ?? "",
            suitableFor: classSession.suitableFor ?? "",
            preparationNotes: classSession.preparationNotes ?? "",
            priceNote: classSession.priceNote ?? "",
            serviceTypes: classSession.serviceTypes.length
              ? classSession.serviceTypes
              : classSession.serviceType
                ? [classSession.serviceType]
                : [],
            yogaStyles: classSession.yogaStyles,
            date: startDate,
            startTime,
            endTime,
            location: classSession.location,
            capacity: classSession.capacity,
            requiresApproval: classSession.requiresApproval,
            isPublic: classSession.isPublic,
            enrolledCount: activeEnrollmentCount,
            series: series
              ? { id: series.id, title: series.title, following, isTerm: series.kind === "term" }
              : undefined,
          }}
        />
      )}
    </div>
  );
}
