import { notFound, redirect } from "next/navigation";

import { requireApprovedTeacher } from "@/domain/teacher-profile/capability";
import { getPublishedDemandRequestDetailForTeacher } from "@/domain/demand-response/demand-read-service";
import { getOwnDemandResponseForDemand } from "@/domain/demand-response/service";
import { PREFERRED_TIME_SLOTS } from "@/domain/demand-request/service-types";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { submitDemandResponseAction, withdrawDemandResponseAction } from "./actions";

type TeacherDemandDetailPageProps = {
  params: Promise<{ demandRequestId: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

const responseStatusCopy: Record<string, { label: string; body: string }> = {
  submitted: {
    label: "已送出",
    body: "你的回應已送出，請等待團主查看。",
  },
  shortlisted: {
    label: "候選中",
    body: "團主已將你的回應列為候選，請等待後續通知。",
  },
  selected: {
    label: "已被選中",
    body: "恭喜，團主已選擇你的回應！後續合作細節將另行安排。",
  },
  declined: {
    label: "未獲選",
    body: "團主這次選擇了其他老師，感謝你的回應。",
  },
  withdrawn: {
    label: "已撤回",
    body: "你已撤回這則回應，無法再對這則需求重新提交。",
  },
  expired: {
    label: "已過期",
    body: "這則需求的回應機會已過期。",
  },
};

export default async function TeacherDemandDetailPage({
  params,
  searchParams,
}: TeacherDemandDetailPageProps) {
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

  // D12：查看 own response 不受 approved-teacher eligibility gate 限制。
  const ownResponse = await getOwnDemandResponseForDemand(demandRequestId);

  if (ownResponse) {
    const demand = await prisma.demandRequest.findUnique({
      where: { id: demandRequestId },
      select: { title: true, status: true },
    });
    // D9（demand-request-cancellation 修正版）：declined 狀態的既有文案假設是「團主選了
    // 別人」，但這則回應也可能是因為 demand 本身被取消而連帶轉為 declined——那種情況下
    // 既有文案是不實敘述，改用取消專用的文案。
    const statusCopy =
      ownResponse.status === "declined" && demand?.status === "cancelled"
        ? { label: "需求已取消", body: "團主已取消這則需求，感謝你的回應。" }
        : responseStatusCopy[ownResponse.status];

    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="border-b border-gray-200 pb-6">
          <p className="text-sm font-medium text-sky-700">Teacher demands</p>
          <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-gray-950">
            {demand?.title ?? "團體需求"}
          </h1>
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

        <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
          <div>
            <span className="w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
              {statusCopy?.label ?? ownResponse.status}
            </span>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {statusCopy?.body ?? "你已對這則需求提交回應。"}
            </p>
          </div>

          <div className="grid gap-3 rounded border border-gray-100 bg-gray-50 p-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-gray-950">你的回覆</p>
              <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-gray-700">
                {ownResponse.message}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-950">可配合時段</p>
              <p className="mt-1 break-words leading-6 text-gray-700">
                {ownResponse.proposedTimeSlots.join("、")}
              </p>
            </div>
            {ownResponse.proposedPrice ? (
              <div className="min-w-0">
                <p className="font-medium text-gray-950">建議價格</p>
                <p className="mt-1 break-words leading-6 text-gray-700">
                  {ownResponse.proposedPrice}
                </p>
              </div>
            ) : null}
          </div>

          {ownResponse.status === "submitted" ? (
            <details className="rounded border border-amber-200 bg-amber-50/60">
              <summary className="cursor-pointer list-none rounded px-4 py-2 text-sm font-medium text-amber-800 marker:hidden">
                撤回回應…
              </summary>
              <form
                action={withdrawDemandResponseAction}
                className="grid gap-3 border-t border-amber-100 p-4"
              >
                <input name="demandRequestId" type="hidden" value={demandRequestId} />
                <input
                  name="demandResponseId"
                  type="hidden"
                  value={ownResponse.id}
                />
                <p className="text-sm leading-6 text-gray-700">
                  這個動作會撤回你對這個需求的回應，之後不會再送出，也無法重新提交。
                </p>
                <label className="flex items-start gap-2 text-sm leading-6 text-gray-700">
                  <input
                    className="mt-1 shrink-0"
                    name="confirmWithdraw"
                    required
                    type="checkbox"
                    value="yes"
                  />
                  我確認要撤回這則回應。
                </label>
                <button
                  className="w-full rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 sm:w-auto"
                  type="submit"
                >
                  確認撤回
                </button>
              </form>
            </details>
          ) : null}
        </section>
      </main>
    );
  }

  let capabilityError: "not_approved_teacher" | null = null;

  try {
    await requireApprovedTeacher();
  } catch {
    capabilityError = "not_approved_teacher";
  }

  if (capabilityError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="border-b border-gray-200 pb-6">
          <p className="text-sm font-medium text-sky-700">Teacher demands</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
            團體需求
          </h1>
        </header>
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">
            你的老師資格審核完成後，就可以在這裡查看並回應需求
          </h2>
        </section>
      </main>
    );
  }

  const demand = await getPublishedDemandRequestDetailForTeacher(demandRequestId);

  if (!demand) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Teacher demands</p>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-gray-950">
          {demand.title ?? "團體需求"}
        </h1>
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

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-950">需求概述</h2>
        <dl className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
          {demand.organization ? (
            <div className="min-w-0">
              <dt className="font-medium text-gray-950">團體</dt>
              <dd className="mt-1 break-words">{demand.organization.name}</dd>
            </div>
          ) : null}
          {demand.serviceType ? (
            <div className="min-w-0">
              <dt className="font-medium text-gray-950">課程類型</dt>
              <dd className="mt-1 break-words">{demand.serviceType}</dd>
            </div>
          ) : null}
          {demand.targetLevel ? (
            <div className="min-w-0">
              <dt className="font-medium text-gray-950">程度</dt>
              <dd className="mt-1 break-words">{demand.targetLevel}</dd>
            </div>
          ) : null}
          {typeof demand.expectedParticipants === "number" ? (
            <div className="min-w-0">
              <dt className="font-medium text-gray-950">預估人數</dt>
              <dd className="mt-1">{demand.expectedParticipants} 人</dd>
            </div>
          ) : null}
          {typeof demand.classLengthMinutes === "number" ? (
            <div className="min-w-0">
              <dt className="font-medium text-gray-950">每堂課長</dt>
              <dd className="mt-1">{demand.classLengthMinutes} 分鐘</dd>
            </div>
          ) : null}
          {demand.frequency ? (
            <div className="min-w-0">
              <dt className="font-medium text-gray-950">頻率</dt>
              <dd className="mt-1 break-words">{demand.frequency}</dd>
            </div>
          ) : null}
        </dl>

        {demand.preferredAreas.length > 0 ? (
          <div className="min-w-0">
            <p className="font-medium text-gray-950">偏好地區</p>
            <p className="mt-1 break-words text-sm leading-6 text-gray-600">
              {demand.preferredAreas.join("、")}
            </p>
          </div>
        ) : null}
        {demand.preferredTimeSlots.length > 0 ? (
          <div className="min-w-0">
            <p className="font-medium text-gray-950">偏好時段</p>
            <p className="mt-1 break-words text-sm leading-6 text-gray-600">
              {demand.preferredTimeSlots.join("、")}
            </p>
          </div>
        ) : null}
        {demand.description ? (
          <div className="min-w-0">
            <p className="font-medium text-gray-950">需求描述</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
              {demand.description}
            </p>
          </div>
        ) : null}
        {demand.budgetRange ? (
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">參考預算</p>
            <p className="mt-1 break-words text-xs leading-5 text-gray-500">
              {demand.budgetRange}
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 rounded border border-gray-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-medium text-gray-950">回應這則需求</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            請簡單說明你的教學風格與這次合作的想法，讓團主更容易理解你的專業。
          </p>
        </div>

        <form action={submitDemandResponseAction} className="grid gap-4">
          <input name="demandRequestId" type="hidden" value={demandRequestId} />

          <div>
            <label className="text-sm font-medium text-gray-950" htmlFor="message">
              給團主的回覆
            </label>
            <textarea
              className="mt-2 min-h-28 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              id="message"
              maxLength={1000}
              minLength={10}
              name="message"
              placeholder="例如：我常帶領企業團體練習，重視呼吸與身體覺察，很樂意了解更多這次的需求細節。"
              required
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-950">
              可配合時段
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PREFERRED_TIME_SLOTS.map((slot) => (
                <label
                  className="flex items-center gap-2 text-sm leading-6 text-gray-700"
                  key={slot}
                >
                  <input
                    name="proposedTimeSlots"
                    type="checkbox"
                    value={slot}
                  />
                  {slot}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              className="text-sm font-medium text-gray-950"
              htmlFor="proposedPrice"
            >
              建議價格（選填）
            </label>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              僅供團主參考，不作為排序依據。
            </p>
            <input
              className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              id="proposedPrice"
              name="proposedPrice"
              placeholder="例如：依實際安排討論"
              type="text"
            />
          </div>

          <button
            className="w-full rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800 sm:w-auto"
            type="submit"
          >
            送出回應
          </button>
        </form>
      </section>
    </main>
  );
}
