import { listSubmittedDemandRequestsForAdmin } from "@/domain/demand-request/admin-service";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";
import { requireAdmin } from "@/lib/auth/session";
import { notFound } from "next/navigation";

import { AdminNav } from "@/app/admin/_components/admin-nav";

import { publishDemandRequestAction, rejectDemandRequestAction } from "./actions";

type AdminDemandsPageProps = {
  searchParams?: Promise<{
    result?: string;
    message?: string;
  }>;
};

const targetLevelLabels: Record<string, string> = {
  beginner: "初學",
  general: "一般",
  advanced: "進階",
  mixed: "混合程度",
};

const frequencyLabels: Record<string, string> = {
  single: "單堂",
  weekly: "每週",
  biweekly: "雙週",
  monthly: "每月",
};

export default async function AdminDemandsPage({
  searchParams,
}: AdminDemandsPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const [demandRequests, resolvedSearchParams] = await Promise.all([
    listSubmittedDemandRequestsForAdmin(),
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

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="grid gap-3 border-b border-gray-200 pb-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-sm font-medium text-sky-700">Admin review</p>
          <AdminNav />
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            Demand requests
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            檢視已送出審核的團課需求，公開合適的需求，或退回並說明原因。
          </p>
        </div>
        <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm">
          <p className="font-medium text-gray-950">Submitted</p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">
            {demandRequests.length}
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

      {demandRequests.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">
            No submitted demand requests
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Draft、published、rejected 的需求不會顯示在此審核佇列中。
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {demandRequests.map((demandRequest) => (
            <article
              className="grid gap-5 rounded border border-gray-200 bg-white p-5"
              key={demandRequest.id}
            >
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="min-w-0 break-words text-xl font-semibold text-gray-950">
                      {demandRequest.title ?? "尚未命名的需求"}
                    </h2>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                      submitted
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="font-medium text-gray-950">Organizer</dt>
                      <dd className="mt-1 break-words">
                        {demandRequest.organizerProfile.displayName}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-medium text-gray-950">
                        Organization
                      </dt>
                      <dd className="mt-1 break-words">
                        {demandRequest.organization.name}（
                        {organizationTypeLabels[demandRequest.organization.type] ??
                          demandRequest.organization.type}
                        ）
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-medium text-gray-950">
                        Contact name
                      </dt>
                      <dd className="mt-1 break-words">
                        {demandRequest.organization.contactName ??
                          "Not provided"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-medium text-gray-950">
                        Contact email
                      </dt>
                      <dd className="mt-1 break-words">
                        {demandRequest.organization.contactEmail ??
                          "Not provided"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-medium text-gray-950">
                        Contact phone
                      </dt>
                      <dd className="mt-1 break-words">
                        {demandRequest.organization.contactPhone ??
                          "Not provided"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-medium text-gray-950">Submitted</dt>
                      <dd className="mt-1">
                        {formatDateTime(demandRequest.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-72">
                  <form action={publishDemandRequestAction}>
                    <input
                      name="demandRequestId"
                      type="hidden"
                      value={demandRequest.id}
                    />
                    <button
                      className="w-full rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                      type="submit"
                    >
                      Publish
                    </button>
                  </form>

                  <details className="rounded border border-rose-200 bg-rose-50/60">
                    <summary className="cursor-pointer list-none rounded px-4 py-2 text-sm font-medium text-rose-800 marker:hidden">
                      Reject…
                    </summary>
                    <form
                      action={rejectDemandRequestAction}
                      className="grid gap-3 border-t border-rose-100 p-4"
                    >
                      <input
                        name="demandRequestId"
                        type="hidden"
                        value={demandRequest.id}
                      />
                      <div>
                        <label
                          className="text-sm font-medium text-gray-950"
                          htmlFor={`reject-reason-${demandRequest.id}`}
                        >
                          退回原因
                        </label>
                        <p className="mt-1 text-xs leading-5 text-gray-600">
                          此說明會顯示給團主，請具體、溫和地寫出需要修正的方向（10–1000 字）。
                        </p>
                        <textarea
                          className="mt-2 min-h-24 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          id={`reject-reason-${demandRequest.id}`}
                          maxLength={1000}
                          minLength={10}
                          name="rejectionReason"
                          placeholder="例如：需求說明過於簡略，請補充上課對象與希望呈現的課程樣貌。"
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
                        我確認要退回這筆需求，且以上原因會顯示給團主。
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
                <ReadOnlyText
                  label="Service type"
                  value={demandRequest.serviceType}
                />
                <ReadOnlyText
                  label="Target level"
                  value={
                    demandRequest.targetLevel
                      ? (targetLevelLabels[demandRequest.targetLevel] ??
                        demandRequest.targetLevel)
                      : null
                  }
                />
                <ReadOnlyText
                  label="Expected participants"
                  value={
                    typeof demandRequest.expectedParticipants === "number"
                      ? `${demandRequest.expectedParticipants} 人`
                      : null
                  }
                />
                <ReadOnlyText
                  label="Class length"
                  value={
                    typeof demandRequest.classLengthMinutes === "number"
                      ? `${demandRequest.classLengthMinutes} 分鐘`
                      : null
                  }
                />
                <ReadOnlyText
                  label="Frequency"
                  value={
                    demandRequest.frequency
                      ? (frequencyLabels[demandRequest.frequency] ??
                        demandRequest.frequency)
                      : null
                  }
                />
                <ReadOnlyText
                  label="Preferred start date"
                  value={
                    demandRequest.preferredStartDate
                      ? formatDate(demandRequest.preferredStartDate)
                      : null
                  }
                />
                <ReadOnlyText
                  label="Budget range"
                  value={demandRequest.budgetRange}
                />
                <ReadOnlyList
                  label="Preferred areas"
                  values={demandRequest.preferredAreas}
                />
                <ReadOnlyList
                  label="Preferred time slots"
                  values={demandRequest.preferredTimeSlots}
                />
                <div className="min-w-0 md:col-span-2">
                  <ReadOnlyText
                    label="Description"
                    multiline
                    value={demandRequest.description}
                  />
                </div>
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
        {value && value.trim().length > 0 ? value : "Not provided"}
      </p>
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
    <div className="min-w-0 text-sm">
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(
    value,
  );
}
