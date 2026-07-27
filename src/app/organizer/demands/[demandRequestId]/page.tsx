import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SERVICE_TYPES } from "@/domain/demand-request/service-types";
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
import { createClassSessionAction, selectDemandResponseAction } from "./actions";
import { ResponseList } from "./_components/ResponseList";

type DemandRequestDetailPageProps = {
  params: Promise<{ demandRequestId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

export default async function DemandRequestDetailPage({
  params,
  searchParams,
}: DemandRequestDetailPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [{ demandRequestId }, resolvedSearchParams] = await Promise.all([
    params,
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

      <ResponseList
        demandRequestId={demandRequestId}
        responses={responses}
        selectDemandResponseAction={selectDemandResponseAction}
      />

      {demandRequest.status === "matched" ? (
        <section className="grid gap-5 rounded border border-gray-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-medium text-gray-950">建立課程</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              這會把這則需求轉為正式課程，之後無法修改，請確認資訊無誤後再送出。
            </p>
          </div>

          <form action={createClassSessionAction} className="grid gap-4">
            <input name="demandRequestId" type="hidden" value={demandRequestId} />

            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="title">
                課程名稱
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={demandRequest.title ?? ""}
                id="title"
                maxLength={200}
                name="title"
                required
                type="text"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="serviceType">
                課程類型
              </label>
              <select
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={demandRequest.serviceType ?? ""}
                id="serviceType"
                name="serviceType"
                required
              >
                <option disabled value="">
                  請選擇課程類型
                </option>
                {SERVICE_TYPES.map((serviceType) => (
                  <option key={serviceType} value={serviceType}>
                    {serviceType}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="text-sm font-medium text-gray-950"
                  htmlFor="startAt"
                >
                  開始時間
                </label>
                <input
                  className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  id="startAt"
                  name="startAt"
                  required
                  type="datetime-local"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-950" htmlFor="endAt">
                  結束時間
                </label>
                <input
                  className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  id="endAt"
                  name="endAt"
                  required
                  type="datetime-local"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="location">
                地點
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                id="location"
                maxLength={200}
                name="location"
                placeholder="例如：台北市信義區 OO 大樓 3F"
                required
                type="text"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="capacity">
                名額上限
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                id="capacity"
                max={500}
                min={1}
                name="capacity"
                required
                type="number"
              />
            </div>

            <div>
              <label
                className="text-sm font-medium text-gray-950"
                htmlFor="description"
              >
                課程說明（選填）
              </label>
              <textarea
                className="mt-2 min-h-24 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                id="description"
                maxLength={2000}
                name="description"
                placeholder="向老師與未來可能報名的會員說明這堂課的重點。"
              />
            </div>

            <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
              <input className="mt-1 shrink-0" name="isPublic" type="checkbox" value="yes" />
              允許公開課程詳情頁與分享連結（未來功能，本輪送出後暫不生效）
            </label>

            <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
              <input
                className="mt-1 shrink-0"
                name="confirmCreate"
                required
                type="checkbox"
                value="yes"
              />
              我確認以上資訊無誤，同意建立課程。
            </label>

            <button
              className="w-full rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800 sm:w-auto"
              type="submit"
            >
              建立課程
            </button>
          </form>
        </section>
      ) : null}

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
