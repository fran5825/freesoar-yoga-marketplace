import { listSubmittedTeacherProfileApplicationsForAdmin } from "@/domain/teacher-profile/service";
import { requireAdmin } from "@/lib/auth/session";
import { notFound } from "next/navigation";

import {
  approveTeacherProfileApplicationAction,
  rejectTeacherProfileApplicationAction,
} from "./actions";

type AdminTeachersPageProps = {
  searchParams?: Promise<{
    result?: string;
    message?: string;
  }>;
};

export default async function AdminTeachersPage({
  searchParams,
}: AdminTeachersPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const [applications, resolvedSearchParams] = await Promise.all([
    listSubmittedTeacherProfileApplicationsForAdmin(),
    searchParams,
  ]);
  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success" ? "success" : "error",
          message: resolvedSearchParams.message,
        }
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="grid gap-3 border-b border-gray-200 pb-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-sm font-medium text-sky-700">Admin review</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            Teacher applications
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Review submitted TeacherProfile applications and approve teachers
            for the next marketplace capability stage.
          </p>
        </div>
        <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm">
          <p className="font-medium text-gray-950">Submitted</p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {applications.length}
          </p>
        </div>
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

      {applications.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">
            No submitted applications
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Approved, draft, rejected, and suspended profiles are not shown in
            this minimal review queue.
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {applications.map((application) => (
            <article
              className="grid gap-5 rounded border border-gray-200 bg-white p-5"
              key={application.id}
            >
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-950">
                      {application.displayName ?? "Unnamed teacher"}
                    </h2>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                      {application.status}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-gray-950">Email</dt>
                      <dd className="mt-1">
                        {application.user.email ?? "Not provided"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-950">Phone</dt>
                      <dd className="mt-1">
                        {application.user.phone ?? "Not provided"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-950">
                        Experience
                      </dt>
                      <dd className="mt-1">
                        {typeof application.experienceYears === "number"
                          ? `${application.experienceYears} years`
                          : "Not provided"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-950">Submitted</dt>
                      <dd className="mt-1">
                        {formatDateTime(application.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-72">
                  <form action={approveTeacherProfileApplicationAction}>
                    <input
                      name="teacherProfileId"
                      type="hidden"
                      value={application.id}
                    />
                    <button
                      className="w-full rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                      type="submit"
                    >
                      Approve
                    </button>
                  </form>

                  <details className="rounded border border-rose-200 bg-rose-50/60">
                    <summary className="cursor-pointer list-none rounded px-4 py-2 text-sm font-medium text-rose-800 marker:hidden">
                      Reject…
                    </summary>
                    <form
                      action={rejectTeacherProfileApplicationAction}
                      className="grid gap-3 border-t border-rose-100 p-4"
                    >
                      <input
                        name="teacherProfileId"
                        type="hidden"
                        value={application.id}
                      />
                      <div>
                        <label
                          className="text-sm font-medium text-gray-950"
                          htmlFor={`reject-reason-${application.id}`}
                        >
                          退回原因
                        </label>
                        <p className="mt-1 text-xs leading-5 text-gray-600">
                          此說明會顯示給老師，請具體、溫和地寫出需要修正的方向（10–1000 字）。
                        </p>
                        <textarea
                          className="mt-2 min-h-24 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          id={`reject-reason-${application.id}`}
                          maxLength={1000}
                          minLength={10}
                          name="rejectionReason"
                          placeholder="例如：教學經歷需要更具體，請補充帶領團課的實際經驗與時數。"
                          required
                        />
                      </div>
                      <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
                        <input
                          className="mt-1 shrink-0"
                          name="confirmReject"
                          required
                          type="checkbox"
                          value="yes"
                        />
                        我確認要退回這位老師，且以上原因會顯示給老師。
                      </label>
                      <button
                        className="w-full rounded bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800"
                        type="submit"
                      >
                        確認退回
                      </button>
                    </form>
                  </details>
                </div>
              </div>

              <div className="grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-2">
                <ReadOnlyText label="Bio" value={application.bio} />
                <ReadOnlyText
                  label="Teaching style"
                  value={application.teachingStyle}
                />
                <ReadOnlyList
                  label="Specialties"
                  values={application.specialties}
                />
                <ReadOnlyList
                  label="Service areas"
                  values={application.serviceAreas}
                />
                <ReadOnlyList
                  label="Teaching formats"
                  values={application.teachingFormats}
                />
                <ReadOnlyList
                  label="Certifications"
                  values={application.certifications}
                />
                <ReadOnlyText
                  label="Price range"
                  value={application.priceRange}
                />
                <ReadOnlyText
                  label="Profile photo URL"
                  value={application.profilePhotoUrl}
                />
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function ReadOnlyText({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="text-sm">
      <h3 className="font-medium text-gray-950">{label}</h3>
      <p className="mt-2 leading-6 text-gray-600">{value ?? "Not provided"}</p>
    </div>
  );
}

function ReadOnlyList({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  const visibleValues = values.filter((value) => value.trim().length > 0);

  return (
    <div className="text-sm">
      <h3 className="font-medium text-gray-950">{label}</h3>
      {visibleValues.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {visibleValues.map((value) => (
            <li
              className="rounded-full border border-gray-200 px-3 py-1 text-gray-700"
              key={value}
            >
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 leading-6 text-gray-600">Not provided</p>
      )}
    </div>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
