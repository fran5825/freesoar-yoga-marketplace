import Link from "next/link";
import { getClassServiceTypes } from "@/domain/class-session/service-types-display";
import { notFound, redirect } from "next/navigation";

import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import {
  getOwnRecurringClassSeriesDetailForTeacher,
  type RecurringClassSeriesDetail,
  type RecurringClassSeriesOccurrence,
} from "@/domain/class-session/read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import {
  listOwnTermEnrollmentsForTeacher,
  type TeacherTermEnrollmentView,
} from "@/domain/enrollment/term-service";
import { requireUser } from "@/lib/auth/session";

import {
  CancelFromHereDialog,
  occurrencesFromHere,
} from "../../_components/CancelFromHereDialog";
import { ConfirmActionDialog } from "../../_components/ConfirmActionDialog";
import { CopyEnrollLinkButton } from "../../_components/CopyEnrollLinkButton";
import { teacherClassDetailHref } from "../../_lib/return-context";
import {
  addMakeupSessionAction,
  cancelRecurringClassSeriesAction,
  decideTermEnrollmentAction,
  generateMoreOccurrencesAction,
  openAllDraftOccurrencesAction,
} from "./actions";
import { GenerateMoreForm } from "./GenerateMoreForm";

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

type RecurringClassSeriesPageProps = {
  params: Promise<{ recurringClassSeriesId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

// teacher-initiated-open-classes Slice B：常規／固定期課程系列管理頁。
// teacher-usability-redesign 票 05：每場顯示日期、狀態、已確認／待確認人數並可點進單堂（返回會回到這裡的同一場）；
// 取消整個系列先在確認視窗列出真正會被取消的場次與報名，確認後才沿用既有取消 service。
export default async function RecurringClassSeriesPage({
  params,
  searchParams,
}: RecurringClassSeriesPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [{ recurringClassSeriesId }, resolvedSearchParams] = await Promise.all([
    params,
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

  const series = await getOwnRecurringClassSeriesDetailForTeacher(recurringClassSeriesId);

  if (!series) {
    notFound();
  }

  const now = new Date().getTime();
  const cancellableOccurrences = series.occurrences.filter((occurrence) =>
    isCancellableOccurrence(occurrence, now),
  );
  const affectedConfirmed = cancellableOccurrences.reduce((sum, item) => sum + item.confirmedCount, 0);
  const affectedPending = cancellableOccurrences.reduce((sum, item) => sum + item.pendingCount, 0);
  // 票 01：可以一次開放報名的場次＝尚未開始的草稿。
  const openableDrafts = series.occurrences.filter(
    (occurrence) => occurrence.status === "draft" && occurrence.startAt.getTime() > now,
  );
  // 票 07：期班標示實際堂數（不含已取消）；只有持續開課可以生成更多。
  const isTerm = series.kind === "term";
  const termSessionCount = series.occurrences.filter((occurrence) => occurrence.status !== "cancelled").length;
  const canGenerateMore = series.kind === "continuous" && series.dayOfWeek !== null;
  // 票 10：期班的整期學員名單（own-scoped）。
  const termEnrollments = isTerm ? await listOwnTermEnrollmentsForTeacher(series.id) : null;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium text-clay hover:underline"
          href="/teacher/classes"
        >
          ← 回我的課程
        </Link>
        <p className="mt-1 text-sm font-medium text-clay">系列管理</p>
        <h1 className="mt-1 min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
          {series.title}
        </h1>
        <p className="mt-3 inline-flex rounded-full bg-pine-tint px-3 py-1 text-sm font-medium text-pine-deep">
          {isTerm
            ? `期班・共 ${termSessionCount} 堂・${termEnrollmentModeLabel(series.termEnrollmentMode)}`
            : "持續開課"}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          {series.dayOfWeek === null
            ? `指定日期——${series.startTime}–${series.endTime}，堂數在建立時已經固定，不能生成更多。`
            : isTerm
              ? `每週固定——每${dayOfWeekLabels[series.dayOfWeek]} ${series.startTime}–${series.endTime}，堂數在建立時已經固定，不能生成更多；要續開請建立新的一期。`
              : `每週固定——每${dayOfWeekLabels[series.dayOfWeek]} ${series.startTime}–${series.endTime}。`}
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
          {isTerm
            ? "期班的公開設定整期一致，改任何一場都會套用到這一期所有尚未開始的場次。"
            : "每一場都是獨立的課，學員一場一場報名、你也一場一場處理報名。"}
          草稿可以用「全部開放報名」一次開放。{series.isPublic
            ? "這個系列設定為公開，作為新場次的預設。"
            : "這個系列僅透過連結招募，作為新場次的預設。"}
          已生成場次依各場的公開設定；公開、開放報名且尚未開始的場次才會列在公開課程列表。開放報名的場次可以複製報名連結傳給學員（學員需先登入）。
          {series.requiresApproval ? "新報名需要你確認才算成立。" : "新報名送出即成立。"}
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      {openableDrafts.length > 0 ? (
        <section
          aria-labelledby="open-all-title"
          className="grid gap-3 rounded-2xl border border-clay/30 bg-clay-tint p-5 sm:p-6"
        >
          <h2 className="text-lg font-medium text-ink" id="open-all-title">
            還有 {openableDrafts.length} 場草稿沒開放報名
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            確認內容沒問題後，可以一次把這些草稿全部開放報名；已開始或已取消的場次不受影響。
          </p>
          <div>
            <ConfirmActionDialog
              action={openAllDraftOccurrencesAction}
              confirmClassName="min-h-11 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
              confirmLabel={`開放 ${openableDrafts.length} 場報名`}
              hiddenFields={{ recurringClassSeriesId: series.id }}
              title="全部開放報名？"
              triggerClassName="min-h-11 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
              triggerLabel={`全部開放報名（${openableDrafts.length} 場）`}
            >
              <p>
                系列：<span className="break-words font-medium text-ink">{series.title}</span>
              </p>
              <p>會開放以下 {openableDrafts.length} 場：</p>
              <ul
                aria-label="會開放報名的場次"
                className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-3"
              >
                {openableDrafts.map((occurrence) => (
                  <li key={occurrence.id}>{formatTaipeiDatetime(occurrence.startAt)}</li>
                ))}
              </ul>
              <p>
                開放後學員就能透過報名連結報名；各場原有的公開設定會保留，設為公開且符合公開條件的場次才會列在公開課程列表。
              </p>
            </ConfirmActionDialog>
          </div>
        </section>
      ) : null}

      {termEnrollments ? (
        <TermEnrollmentsSection seriesId={series.id} termEnrollments={termEnrollments} />
      ) : null}

      {isTerm ? (
        <section
          aria-labelledby="makeup-title"
          className="grid scroll-mt-6 gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
          id="makeup"
        >
          <h2 className="text-lg font-medium text-ink" id="makeup-title">
            追加補課日期
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            補課沿用這一期目前的時間（{series.startTime}–{series.endTime}）、地點與名額。整期學員會自動報上並收到通知；不能來的人可以自行請假。
            這一期已全部開放報名時，補課也直接開放。尚未開始的場次合計最多 26 堂。
          </p>
          <form action={addMakeupSessionAction} className="flex flex-wrap items-end gap-3">
            <input name="recurringClassSeriesId" type="hidden" value={series.id} />
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="makeup-date">
                補課日期
              </label>
              <input
                className="mt-2 block min-h-11 rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-pine"
                id="makeup-date"
                name="date"
                required
                type="date"
              />
            </div>
            <button
              className="min-h-11 rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
              type="submit"
            >
              追加補課
            </button>
          </form>
        </section>
      ) : null}

      <section
        aria-labelledby="occurrences-title"
        className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
      >
        <h2 className="text-lg font-medium text-ink" id="occurrences-title">
          已生成場次（{series.occurrences.length}）
        </h2>
        {series.occurrences.length === 0 ? (
          <p className="text-sm leading-6 text-ink-soft">目前還沒有生成任何場次。</p>
        ) : (
          <ul className="grid gap-2">
            {/* 票 04／05：每場可點進單堂詳情，詳情頁的「返回」會回到這個系列的同一場位置。 */}
            {series.occurrences.map((occurrence) => {
              const isOver =
                occurrence.status === "cancelled" ||
                occurrence.status === "completed" ||
                occurrence.endAt.getTime() <= now;

              return (
                <li className="grid scroll-mt-6 gap-1" id={`class-${occurrence.id}`} key={occurrence.id}>
                  <Link
                    className={`grid min-h-11 gap-2 rounded-2xl border p-3 text-sm transition hover:border-pine/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:grid-cols-[1fr_auto] sm:items-center ${
                      isOver ? "border-ink/10 bg-cream/60 text-ink-soft" : "border-ink/10 bg-cream text-ink"
                    }`}
                    href={teacherClassDetailHref(occurrence.id, { kind: "series", seriesId: series.id })}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {formatTaipeiDatetime(occurrence.startAt)} – {formatTaipeiDatetime(occurrence.endAt)}
                      </span>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[occurrence.status]}`}
                      >
                        {classSessionStatusLabels[occurrence.status]}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
                      <span>
                        已報名 {occurrence.confirmedCount} / {occurrence.capacity} 人
                      </span>
                      {occurrence.pendingCount > 0 ? (
                        <span className="font-medium text-clay-deep">
                          待確認 {occurrence.pendingCount} 人
                        </span>
                      ) : null}
                      <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                  {/* 複製與取消按鈕放在場次連結外面，避免連結裡再包按鈕。 */}
                  {occurrence.status === "open_for_enrollment" || isCancellableOccurrence(occurrence, now) ? (
                    <div className="flex flex-wrap gap-x-2 pl-3">
                      {occurrence.status === "open_for_enrollment" ? (
                        <CopyEnrollLinkButton
                          ariaLabel={`複製 ${formatTaipeiDatetime(occurrence.startAt)} 這一場的報名連結`}
                          className="min-h-11 rounded-full px-3 text-sm font-medium text-pine underline-offset-4 hover:underline"
                          classSessionId={occurrence.id}
                        />
                      ) : null}
                      {isCancellableOccurrence(occurrence, now) ? (
                        <CancelFromHereDialog
                          affected={occurrencesFromHere(series.occurrences, occurrence, now)}
                          canGenerateMore={canGenerateMore}
                          fromClassSessionId={occurrence.id}
                          recurringClassSeriesId={series.id}
                          seriesTitle={series.title}
                          triggerAriaLabel={`從 ${formatTaipeiDatetime(occurrence.startAt)} 這一場以後全部取消`}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="series-info-title"
        className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
      >
        <h2 className="text-lg font-medium text-ink" id="series-info-title">
          系列內容
        </h2>
        <dl className="grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-medium text-ink">地點</dt>
            <dd className="mt-1 break-words">{series.location}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">名額上限（系列設定，新場次沿用）</dt>
            <dd className="mt-1">{series.capacity} 人</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">公開列表（系列設定，新場次沿用）</dt>
            <dd className="mt-1">{series.isPublic ? "開放報名後列在公開課程列表" : "僅透過連結招募"}</dd>
          </div>
          {getClassServiceTypes(series).length > 0 ? (
            <div className="min-w-0">
              <dt className="font-medium text-ink">課程風格</dt>
              <dd className="mt-1 break-words">{getClassServiceTypes(series).join("、")}</dd>
            </div>
          ) : null}
          {series.yogaStyles.length > 0 ? (
            <div className="min-w-0">
              <dt className="font-medium text-ink">瑜伽類型</dt>
              <dd className="mt-1 break-words">{series.yogaStyles.join("、")}</dd>
            </div>
          ) : null}
        </dl>
        {series.description ? (
          <p className="whitespace-pre-wrap break-words border-t border-ink/10 pt-3 text-sm leading-6 text-ink-soft">
            {series.description}
          </p>
        ) : null}
        {/* member-flow 票 04：系列上的兩段，之後生成的場次會沿用；已生成的各場可能各自改過。 */}
        {[
          { label: "適合對象", value: series.suitableFor },
          { label: "準備事項", value: series.preparationNotes },
        ].map((item) => (
          <div className="border-t border-ink/10 pt-3 text-sm leading-6" key={item.label}>
            <p className="font-medium text-ink">{item.label}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-ink-soft">
              {item.value || "未填寫，學員會看到「尚未提供」。"}
            </p>
          </div>
        ))}
      </section>

      {canGenerateMore && series.dayOfWeek !== null ? (
        <section
          className="grid scroll-mt-6 gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
          id="generate-more"
        >
          <GenerateMoreForm
            action={generateMoreOccurrencesAction}
            dayLabel={dayOfWeekLabels[series.dayOfWeek]}
            recurringClassSeriesId={series.id}
          />
        </section>
      ) : null}

      {cancellableOccurrences.length > 0 ? (
        <section
          aria-labelledby="cancel-series-title"
          className="grid gap-3 rounded-2xl border border-ink/10 p-5 sm:p-6"
        >
          <h2 className="text-base font-medium text-ink" id="cancel-series-title">
            取消這個系列
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            只會取消還沒開始的草稿與開放報名場次；已開始、已結束或已取消的場次不受影響。
          </p>
          <div>
            <ConfirmActionDialog
              action={cancelRecurringClassSeriesAction}
              confirmLabel={`確定取消 ${cancellableOccurrences.length} 場`}
              hiddenFields={{ recurringClassSeriesId: series.id }}
              title="取消這個系列尚未開始的場次？"
              triggerClassName="min-h-11 rounded-full border border-clay/40 px-5 py-2 text-left text-sm font-medium text-clay transition hover:bg-clay-tint"
              triggerLabel="取消整個系列（僅影響尚未開始的場次）"
            >
              <p>
                系列：<span className="break-words font-medium text-ink">{series.title}</span>
              </p>
              <p>會取消以下 {cancellableOccurrences.length} 場：</p>
              <ul
                aria-label="會被取消的場次"
                className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-3"
              >
                {cancellableOccurrences.map((occurrence) => (
                  <li key={occurrence.id}>
                    {formatTaipeiDatetime(occurrence.startAt)}
                    {occurrence.confirmedCount + occurrence.pendingCount > 0
                      ? `（已報名 ${occurrence.confirmedCount}、待確認 ${occurrence.pendingCount}）`
                      : ""}
                  </li>
                ))}
              </ul>
              <p>
                {affectedConfirmed + affectedPending > 0
                  ? `這些場次共有已報名 ${affectedConfirmed} 筆、待確認 ${affectedPending} 筆報名，會一起取消，學員會收到通知。`
                  : "這些場次目前沒有人報名。"}
              </p>
              <p>取消後這些場次不能再開放報名。系列本身會保留，不會被刪除。</p>
            </ConfirmActionDialog>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const termEnrollmentStatusLabels: Record<TeacherTermEnrollmentView["status"], string> = {
  pending: "待確認",
  confirmed: "已報名",
  declined: "已婉拒",
  withdrawn: "已退出",
};

// teacher-class-scheduling 票 10：整期學員名單。待確認的整期報名在這裡確認或婉拒一次，套用到整期。
function TermEnrollmentsSection({
  seriesId,
  termEnrollments,
}: {
  seriesId: string;
  termEnrollments: TeacherTermEnrollmentView[];
}) {
  const pendingCount = termEnrollments.filter((item) => item.status === "pending").length;

  return (
    <section
      aria-labelledby="term-enrollments-title"
      className="grid scroll-mt-6 gap-3 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6"
      id="term-enrollments"
    >
      <h2 className="text-lg font-medium text-ink" id="term-enrollments-title">
        整期學員（{termEnrollments.length}）{pendingCount > 0 ? `・待確認 ${pendingCount}` : ""}
      </h2>
      {termEnrollments.length === 0 ? (
        <p className="text-sm leading-6 text-ink-soft">目前還沒有學員報整期。</p>
      ) : (
        <ul className="grid gap-2">
          {termEnrollments.map((item) => (
            <li className="grid min-w-0 gap-2 rounded-2xl border border-ink/10 bg-cream p-3 text-sm" key={item.id}>
              <p className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words font-medium text-ink">{item.memberLabel}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-ink-soft">
                  {termEnrollmentStatusLabels[item.status]}
                </span>
                {item.status === "pending" || item.status === "confirmed" ? (
                  <span className="text-ink-soft">之後 {item.activeUpcomingCount} 堂</span>
                ) : null}
              </p>
              {item.notes ? (
                <p className="min-w-0 whitespace-pre-wrap break-words text-ink-soft">{item.notes}</p>
              ) : null}
              {item.leaveDates.length > 0 ? (
                <p className="text-ink-soft">
                  請假或取消：{item.leaveDates.map((date) => formatTaipeiDatetime(date)).join("、")}
                </p>
              ) : null}
              {item.status === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <form action={decideTermEnrollmentAction}>
                    <input name="recurringClassSeriesId" type="hidden" value={seriesId} />
                    <input name="seriesEnrollmentId" type="hidden" value={item.id} />
                    <input name="decision" type="hidden" value="confirm" />
                    <button
                      aria-label={`確認 ${item.memberLabel} 的整期報名`}
                      className="min-h-11 rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
                      type="submit"
                    >
                      確認整期報名
                    </button>
                  </form>
                  <ConfirmActionDialog
                    action={decideTermEnrollmentAction}
                    confirmLabel="確定婉拒整期"
                    hiddenFields={{ recurringClassSeriesId: seriesId, seriesEnrollmentId: item.id, decision: "decline" }}
                    title="婉拒這筆整期報名？"
                    triggerAriaLabel={`婉拒 ${item.memberLabel} 的整期報名`}
                    triggerClassName="min-h-11 rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-cream"
                    triggerLabel="婉拒"
                  >
                    <p>
                      學員：<span className="break-words font-medium text-ink">{item.memberLabel}</span>
                    </p>
                    <p>會取消報整期時新增的 {item.declineCancelCount} 堂，學員會收到一則通知。</p>
                    {item.declineRestoreCount > 0 ? (
                      <p>學員原本單堂報名的 {item.declineRestoreCount} 堂會恢復為單堂，維持原本狀態。</p>
                    ) : null}
                    <p>婉拒後，這位學員不能再報這一期的整期。</p>
                  </ConfirmActionDialog>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function termEnrollmentModeLabel(mode: RecurringClassSeriesDetail["termEnrollmentMode"]): string {
  return mode === "term_only" ? "只收整期" : "整期和單堂都收";
}

function isCancellableOccurrence(occurrence: RecurringClassSeriesOccurrence, now: number): boolean {
  return (
    ["draft", "open_for_enrollment"].includes(occurrence.status) &&
    occurrence.startAt.getTime() > now
  );
}
