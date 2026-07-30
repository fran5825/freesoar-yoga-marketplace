import { redirect } from "next/navigation";
import Link from "next/link";

import { formatAvailabilityExceptionDate } from "@/domain/teacher-availability/date-format";
import { getOwnAvailabilityOverview } from "@/domain/teacher-availability/read-service";
import { requireUser } from "@/lib/auth/session";

import {
  createAvailabilityExceptionAction,
  createTeacherAvailabilityAction,
  deleteAvailabilityExceptionAction,
  deleteTeacherAvailabilityAction,
  updateAvailabilityExceptionAction,
  updateTeacherAvailabilityAction,
} from "./actions";

type TeacherAvailabilityPageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
};

type NonApprovedStatus = "missing" | "draft" | "submitted" | "rejected";

const nonApprovedCopy: Record<
  NonApprovedStatus,
  { title: string; body: string; actionLabel: string }
> = {
  missing: {
    title: "尚未建立老師申請",
    body: "完成老師資格審核後，就可以在這裡管理你的可授課時間。",
    actionLabel: "前往建立老師申請",
  },
  draft: {
    title: "老師申請還在準備中",
    body: "完成並送出申請、通過審核後，就可以在這裡管理你的可授課時間。",
    actionLabel: "繼續整理申請",
  },
  submitted: {
    title: "老師申請審核中",
    body: "審核期間請耐心等候。通過審核後，就可以在這裡管理你的可授課時間。",
    actionLabel: "查看申請狀態",
  },
  rejected: {
    title: "老師申請可修正後重新送出",
    body: "依平台提供的修正方向調整並重新送審後，就可以在這裡管理你的可授課時間。",
    actionLabel: "查看退回說明",
  },
};

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

const exceptionTypeLabels: Record<string, string> = {
  blocked: "封鎖",
  extra_available: "額外開放",
};

export default async function TeacherAvailabilityPage({
  searchParams,
}: TeacherAvailabilityPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [overview, resolvedSearchParams] = await Promise.all([
    getOwnAvailabilityOverview(),
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

  if (!overview || (overview.teacherProfileStatus !== "approved" && overview.teacherProfileStatus !== "suspended")) {
    const copy =
      nonApprovedCopy[(overview?.teacherProfileStatus as NonApprovedStatus | undefined) ?? "missing"];

    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="border-b border-gray-200 pb-6">
          <p className="text-sm font-medium text-sky-700">Teacher availability</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            可授課時間
          </h1>
        </header>
        <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-medium text-gray-950">{copy.title}</h2>
          <p className="text-sm leading-6 text-gray-600">{copy.body}</p>
          <div>
            <Link
              className="inline-flex rounded bg-gray-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
              href="/teacher/dashboard"
            >
              {copy.actionLabel}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const isApproved = overview.teacherProfileStatus === "approved";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Teacher availability</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          可授課時間
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          管理你每週固定的可授課時段，以及特定日期的封鎖或額外開放。
        </p>
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

      {!isApproved ? (
        <section
          aria-live="polite"
          className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700"
        >
          帳號目前暫停中，暫時無法新增、編輯或刪除可授課時間，但你仍然可以查看既有資料。
        </section>
      ) : null}

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-950">固定可授課時段</h2>
        {overview.availability.length === 0 ? (
          <p className="text-sm leading-6 text-gray-600">目前還沒有任何固定時段。</p>
        ) : (
          <ul className="grid gap-2">
            {overview.availability.map((entry) => (
              <li
                className="min-w-0 rounded border border-gray-100 bg-gray-50 p-3 text-sm"
                key={entry.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words font-medium text-gray-950">
                    {dayOfWeekLabels[entry.dayOfWeek]}・{entry.startTime}–{entry.endTime}
                    {entry.locationArea ? `・${entry.locationArea}` : ""}
                  </p>
                  {isApproved ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <details>
                        <summary className="cursor-pointer list-none rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-900 marker:hidden hover:bg-gray-100">
                          編輯…
                        </summary>
                        <form
                          action={updateTeacherAvailabilityAction}
                          className="mt-3 grid gap-3 rounded border border-gray-200 bg-white p-3"
                        >
                          <input name="availabilityId" type="hidden" value={entry.id} />
                          <div>
                            <label
                              className="text-sm font-medium text-gray-950"
                              htmlFor={`edit-dayOfWeek-${entry.id}`}
                            >
                              星期幾
                            </label>
                            <select
                              className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                              defaultValue={entry.dayOfWeek}
                              id={`edit-dayOfWeek-${entry.id}`}
                              name="dayOfWeek"
                              required
                            >
                              {dayOfWeekLabels.map((label, index) => (
                                <option key={label} value={index}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label
                                className="text-sm font-medium text-gray-950"
                                htmlFor={`edit-startTime-${entry.id}`}
                              >
                                開始時間
                              </label>
                              <input
                                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                defaultValue={entry.startTime}
                                id={`edit-startTime-${entry.id}`}
                                name="startTime"
                                required
                                type="time"
                              />
                            </div>
                            <div>
                              <label
                                className="text-sm font-medium text-gray-950"
                                htmlFor={`edit-endTime-${entry.id}`}
                              >
                                結束時間
                              </label>
                              <input
                                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                defaultValue={entry.endTime}
                                id={`edit-endTime-${entry.id}`}
                                name="endTime"
                                required
                                type="time"
                              />
                            </div>
                          </div>
                          <div>
                            <label
                              className="text-sm font-medium text-gray-950"
                              htmlFor={`edit-locationArea-${entry.id}`}
                            >
                              地區（選填）
                            </label>
                            <input
                              className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                              defaultValue={entry.locationArea ?? ""}
                              id={`edit-locationArea-${entry.id}`}
                              maxLength={100}
                              name="locationArea"
                            />
                          </div>
                          <button
                            className="w-full rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 sm:w-auto"
                            type="submit"
                          >
                            儲存變更
                          </button>
                        </form>
                      </details>
                      <form action={deleteTeacherAvailabilityAction}>
                        <input name="availabilityId" type="hidden" value={entry.id} />
                        <button
                          className="rounded border border-rose-200 px-3 py-1 text-xs font-medium text-rose-800 transition hover:bg-rose-50"
                          type="submit"
                        >
                          刪除
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {isApproved ? (
          <form
            action={createTeacherAvailabilityAction}
            className="grid gap-3 border-t border-gray-100 pt-4"
          >
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="dayOfWeek">
                星期幾
              </label>
              <select
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue=""
                id="dayOfWeek"
                name="dayOfWeek"
                required
              >
                <option disabled value="">
                  請選擇星期幾
                </option>
                {dayOfWeekLabels.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-950" htmlFor="startTime">
                  開始時間
                </label>
                <input
                  className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  id="startTime"
                  name="startTime"
                  required
                  type="time"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-950" htmlFor="endTime">
                  結束時間
                </label>
                <input
                  className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  id="endTime"
                  name="endTime"
                  required
                  type="time"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="locationArea">
                地區（選填）
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                id="locationArea"
                maxLength={100}
                name="locationArea"
                placeholder="例如：台北市信義區"
              />
            </div>
            <button
              className="w-full rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 sm:w-auto"
              type="submit"
            >
              新增固定時段
            </button>
          </form>
        ) : null}
      </section>

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-950">特殊日期例外</h2>
        {overview.exceptions.length === 0 ? (
          <p className="text-sm leading-6 text-gray-600">目前還沒有任何日期例外。</p>
        ) : (
          <ul className="grid gap-2">
            {overview.exceptions.map((entry) => (
              <li
                className="min-w-0 rounded border border-gray-100 bg-gray-50 p-3 text-sm"
                key={entry.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-gray-950">
                      {formatAvailabilityExceptionDate(entry.date)}
                      <span className="w-fit rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {exceptionTypeLabels[entry.type] ?? entry.type}
                      </span>
                    </p>
                    <p className="mt-1 text-gray-600">
                      {entry.startTime && entry.endTime
                        ? `${entry.startTime}–${entry.endTime}`
                        : "整天"}
                    </p>
                    {entry.reason ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-gray-600">
                        {entry.reason}
                      </p>
                    ) : null}
                  </div>
                  {isApproved ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <details>
                        <summary className="cursor-pointer list-none rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-900 marker:hidden hover:bg-gray-100">
                          編輯…
                        </summary>
                        <form
                          action={updateAvailabilityExceptionAction}
                          className="mt-3 grid gap-3 rounded border border-gray-200 bg-white p-3"
                        >
                          <input name="exceptionId" type="hidden" value={entry.id} />
                          <div>
                            <label
                              className="text-sm font-medium text-gray-950"
                              htmlFor={`edit-date-${entry.id}`}
                            >
                              日期
                            </label>
                            <input
                              className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                              defaultValue={formatAvailabilityExceptionDate(entry.date)}
                              id={`edit-date-${entry.id}`}
                              name="date"
                              required
                              type="date"
                            />
                          </div>
                          <fieldset className="grid gap-2">
                            <legend className="text-sm font-medium text-gray-950">類型</legend>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                defaultChecked={entry.type === "blocked"}
                                name="type"
                                type="radio"
                                value="blocked"
                              />
                              封鎖（這天無法授課）
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                defaultChecked={entry.type === "extra_available"}
                                name="type"
                                type="radio"
                                value="extra_available"
                              />
                              額外開放（原本沒有排班，但這天可以授課）
                            </label>
                          </fieldset>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label
                                className="text-sm font-medium text-gray-950"
                                htmlFor={`edit-startTime-${entry.id}`}
                              >
                                開始時間（選填，留空代表整天）
                              </label>
                              <input
                                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                defaultValue={entry.startTime ?? ""}
                                id={`edit-startTime-${entry.id}`}
                                name="startTime"
                                type="time"
                              />
                            </div>
                            <div>
                              <label
                                className="text-sm font-medium text-gray-950"
                                htmlFor={`edit-endTime-${entry.id}`}
                              >
                                結束時間（選填）
                              </label>
                              <input
                                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                defaultValue={entry.endTime ?? ""}
                                id={`edit-endTime-${entry.id}`}
                                name="endTime"
                                type="time"
                              />
                            </div>
                          </div>
                          <div>
                            <label
                              className="text-sm font-medium text-gray-950"
                              htmlFor={`edit-reason-${entry.id}`}
                            >
                              原因（選填）
                            </label>
                            <textarea
                              className="mt-2 min-h-20 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                              defaultValue={entry.reason ?? ""}
                              id={`edit-reason-${entry.id}`}
                              maxLength={500}
                              name="reason"
                            />
                          </div>
                          <button
                            className="w-full rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 sm:w-auto"
                            type="submit"
                          >
                            儲存變更
                          </button>
                        </form>
                      </details>
                      <form action={deleteAvailabilityExceptionAction}>
                        <input name="exceptionId" type="hidden" value={entry.id} />
                        <button
                          className="rounded border border-rose-200 px-3 py-1 text-xs font-medium text-rose-800 transition hover:bg-rose-50"
                          type="submit"
                        >
                          刪除
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {isApproved ? (
          <form
            action={createAvailabilityExceptionAction}
            className="grid gap-3 border-t border-gray-100 pt-4"
          >
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="date">
                日期
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                id="date"
                name="date"
                required
                type="date"
              />
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-gray-950">類型</legend>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input defaultChecked name="type" type="radio" value="blocked" />
                封鎖（這天無法授課）
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input name="type" type="radio" value="extra_available" />
                額外開放（原本沒有排班，但這天可以授課）
              </label>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-950" htmlFor="exceptionStartTime">
                  開始時間（選填，留空代表整天）
                </label>
                <input
                  className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  id="exceptionStartTime"
                  name="startTime"
                  type="time"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-950" htmlFor="exceptionEndTime">
                  結束時間（選填）
                </label>
                <input
                  className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  id="exceptionEndTime"
                  name="endTime"
                  type="time"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="reason">
                原因（選填）
              </label>
              <textarea
                className="mt-2 min-h-20 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                id="reason"
                maxLength={500}
                name="reason"
                placeholder="例如：請假、臨時加開"
              />
            </div>
            <button
              className="w-full rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 sm:w-auto"
              type="submit"
            >
              新增例外
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
