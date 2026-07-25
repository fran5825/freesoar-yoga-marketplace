import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getOwnDemandRequestDetail } from "@/domain/demand-request/service";
import { listResponsesForOwnDemandRequest } from "@/domain/demand-response/organizer-read-service";
import { requireUser } from "@/lib/auth/session";

import {
  demandRequestFrequencyLabels,
  demandRequestStatusLabels,
  demandRequestStatusToneClasses,
  demandRequestTargetLevelLabels,
  formatDemandRequestDate,
  formatDemandRequestDateTime,
} from "../_components/status-labels";
import { ResponseList } from "./_components/ResponseList";

type DemandRequestDetailPageProps = {
  params: Promise<{ demandRequestId: string }>;
};

export default async function DemandRequestDetailPage({
  params,
}: DemandRequestDetailPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const { demandRequestId } = await params;
  const demandRequest = await getOwnDemandRequestDetail(demandRequestId);

  if (!demandRequest) {
    notFound();
  }

  const responses = (await listResponsesForOwnDemandRequest(demandRequestId)) ?? [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-gray-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-amber-700">
            Organizer demand
          </p>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${demandRequestStatusToneClasses[demandRequest.status]}`}
          >
            {demandRequestStatusLabels[demandRequest.status]}
          </span>
        </div>
        <h1 className="mt-2 min-w-0 break-words text-3xl font-semibold tracking-tight text-gray-950">
          {demandRequest.title ?? "尚未命名的需求"}
        </h1>
        <p className="mt-3 text-sm text-gray-500">
          最後更新：{formatDemandRequestDateTime(demandRequest.updatedAt)}
        </p>
      </header>

      {demandRequest.status === "rejected" ? (
        <section className="min-w-0 rounded border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-950">
            平台的退回說明
          </h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-amber-900">
            {demandRequest.rejectionReason &&
            demandRequest.rejectionReason.trim().length > 0
              ? demandRequest.rejectionReason
              : "平台尚未提供具體說明。你可以參考需求內容，再建立一筆新的需求重新提出。"}
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-6 sm:grid-cols-2">
        <ReadOnlyText label="服務類型" value={demandRequest.serviceType} />
        <ReadOnlyText
          label="適合對象"
          value={
            demandRequest.targetLevel
              ? (demandRequestTargetLevelLabels[demandRequest.targetLevel] ??
                demandRequest.targetLevel)
              : null
          }
        />
        <ReadOnlyText
          label="預計參與人數"
          value={
            typeof demandRequest.expectedParticipants === "number"
              ? `${demandRequest.expectedParticipants} 人`
              : null
          }
        />
        <ReadOnlyText
          label="單堂課程長度"
          value={
            typeof demandRequest.classLengthMinutes === "number"
              ? `${demandRequest.classLengthMinutes} 分鐘`
              : null
          }
        />
        <ReadOnlyText
          label="上課頻率"
          value={
            demandRequest.frequency
              ? (demandRequestFrequencyLabels[demandRequest.frequency] ??
                demandRequest.frequency)
              : null
          }
        />
        <ReadOnlyText
          label="期望開課日期"
          value={
            demandRequest.preferredStartDate
              ? formatDemandRequestDate(demandRequest.preferredStartDate)
              : null
          }
        />
        <ReadOnlyText label="預算參考" value={demandRequest.budgetRange} />
        <ReadOnlyList label="期望地區" values={demandRequest.preferredAreas} />
        <ReadOnlyList
          label="期望時段"
          values={demandRequest.preferredTimeSlots}
        />
        <div className="min-w-0 sm:col-span-2">
          <ReadOnlyText
            label="需求說明"
            multiline
            value={demandRequest.description}
          />
        </div>
      </section>

      <ResponseList responses={responses} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          className="rounded border border-gray-300 px-5 py-3 text-center text-sm font-medium text-gray-900 transition hover:bg-gray-50"
          href="/organizer/demands"
        >
          回到需求列表
        </Link>
        {demandRequest.status === "draft" ? (
          <Link
            className="rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800"
            href={`/organizer/demands/${demandRequest.id}/edit`}
          >
            繼續編輯草稿
          </Link>
        ) : null}
      </div>
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
        {value && value.trim().length > 0 ? value : "尚未填寫"}
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
        <p className="mt-2 leading-6 text-gray-600">尚未填寫</p>
      )}
    </div>
  );
}
