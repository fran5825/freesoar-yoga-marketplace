import Link from "next/link";
import { notFound } from "next/navigation";

import { demandRequestTargetLevelLabels } from "@/app/organizer/demands/_components/status-labels";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { getDemandRequestForAdmin } from "@/domain/demand-request/admin-service";
import { getDemandLocationItems } from "@/domain/demand-request/location";
import { getDemandServiceTypes } from "@/domain/demand-request/service-types";
import { organizationTypeLabels } from "@/domain/organizer-profile/organization-type-labels";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { requireAdmin } from "@/lib/auth/session";

import { AdminFlash, type AdminFlashParams } from "../../_components/AdminFlash";
import { ReasonTemplateField } from "../../_components/ReasonTemplateField";
import { demandRejectionTemplates } from "../../_components/reason-templates";
import { publishDemandRequestAction, rejectDemandRequestAction } from "../actions";
import { adminDemandStatusLabel, adminDemandStatusToneClass } from "../status-labels";

type AdminDemandDetailPageProps = {
  params: Promise<{ demandRequestId: string }>;
  searchParams?: Promise<AdminFlashParams>;
};

const frequencyLabels: Record<string, string> = {
  single: "單堂",
  weekly: "每週",
  biweekly: "雙週",
  monthly: "每月",
};

// 票 07：需求審核詳情頁。順序：下一步（公開／退回）→ 團主與團體 → 需求內容。
// 已處理過（已公開、已退回、之後的各狀態）的需求只顯示結果，不再顯示審核按鈕。
export default async function AdminDemandDetailPage({
  params,
  searchParams,
}: AdminDemandDetailPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const { demandRequestId } = await params;
  const [demand, resolvedSearchParams] = await Promise.all([
    getDemandRequestForAdmin(demandRequestId),
    searchParams,
  ]);

  if (!demand) {
    notFound();
  }

  const title = demand.title ?? "尚未命名的需求";
  const contact = [
    demand.organization.contactName,
    demand.organization.contactEmail,
    demand.organization.contactPhone,
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="text-sm font-medium text-clay underline underline-offset-4"
          href="/admin/demands"
        >
          ← 回需求列表
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${adminDemandStatusToneClass(demand.status)}`}
          >
            {adminDemandStatusLabel(demand.status)}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {demand.status === "submitted" ? "送審於" : "最後更新"}{" "}
          {formatRelativeTime(demand.updatedAt)}（{formatTaipeiDatetime(demand.updatedAt)}）
        </p>
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} />

      <section
        aria-labelledby="next-step-title"
        className="grid gap-4 rounded-2xl border border-pine/25 bg-pine-tint p-6"
      >
        {demand.status === "submitted" ? (
          <>
            <div>
              <h2 className="text-xl font-semibold text-ink" id="next-step-title">
                審核這筆需求
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                看完下方內容後決定。公開後，合適的老師會在「需求池」看到；退回時，原因會顯示給團主。
              </p>
            </div>
            <form action={publishDemandRequestAction}>
              <input name="demandRequestId" type="hidden" value={demand.id} />
              <button
                className="w-full rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
                type="submit"
              >
                公開需求
              </button>
            </form>
            <form
              action={rejectDemandRequestAction}
              className="grid gap-3 rounded-xl border border-rose-200 bg-white p-4"
            >
              <input name="demandRequestId" type="hidden" value={demand.id} />
              <input name="confirmReject" type="hidden" value="yes" />
              <ReasonTemplateField
                hint="此說明會顯示給團主，請具體、溫和地寫出需要修正的方向（10–1000 字）。"
                id="reject-reason"
                label="退回原因"
                maxLength={1000}
                minLength={10}
                name="rejectionReason"
                placeholder="例如：需求說明過於簡略，請補充上課對象與希望呈現的課程樣貌。"
                templates={demandRejectionTemplates}
              />
              <button
                className="w-full rounded-full bg-rose-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
                type="submit"
              >
                退回需求
              </button>
            </form>
          </>
        ) : null}

        {demand.status === "rejected" ? (
          <div>
            <h2 className="text-xl font-semibold text-ink" id="next-step-title">
              這筆需求已退回
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
              {demand.rejectionReason
                ? `退回原因：${demand.rejectionReason}`
                : "團主修改後可以重新送審。"}
            </p>
          </div>
        ) : null}

        {demand.status !== "submitted" && demand.status !== "rejected" ? (
          <div>
            <h2 className="text-xl font-semibold text-ink" id="next-step-title">
              這筆需求已處理
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              目前狀態：{adminDemandStatusLabel(demand.status)}。這個階段不需要管理員審核。
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-ink sm:col-span-2">團主與團體</h2>
        <Field label="團主" value={demand.organizerProfile.displayName} />
        <Field
          label="團體"
          value={`${demand.organization.name}（${
            organizationTypeLabels[demand.organization.type] ?? demand.organization.type
          }）`}
        />
        <Field label="聯絡人" value={contact[0]} />
        <Field label="聯絡 Email" value={contact[1]} />
        <Field label="聯絡電話" value={contact[2]} />
      </section>

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-ink sm:col-span-2">需求內容</h2>
        <Field label="服務類型" value={getDemandServiceTypes(demand).join("、") || null} />
        <Field
          label="學員程度"
          value={
            demand.targetLevel
              ? (demandRequestTargetLevelLabels[demand.targetLevel] ?? demand.targetLevel)
              : null
          }
        />
        <Field
          label="預期人數"
          value={
            typeof demand.expectedParticipants === "number"
              ? `${demand.expectedParticipants} 人`
              : null
          }
        />
        <Field
          label="每堂長度"
          value={
            typeof demand.classLengthMinutes === "number"
              ? `${demand.classLengthMinutes} 分鐘`
              : null
          }
        />
        <Field
          label="頻率"
          value={demand.frequency ? (frequencyLabels[demand.frequency] ?? demand.frequency) : null}
        />
        <Field
          label="期望開始日期"
          value={
            demand.preferredStartDate
              ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(
                  demand.preferredStartDate,
                )
              : null
          }
        />
        <Field label="預算" value={demand.budgetRange} />
        <Field label="期望地點" value={getDemandLocationItems(demand).join("、") || null} />
        <Field label="偏好時段" value={demand.preferredTimeSlots.join("、") || null} wide />
        <Field label="需求說明" multiline value={demand.description} wide />
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
