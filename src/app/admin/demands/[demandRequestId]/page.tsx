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
import { AdminReviewPanel } from "../../_components/AdminReviewPanel";
import { adminDetailHref, safeAdminReturnTo } from "../../_lib/list-context";
import { demandRejectionTemplates } from "../../_components/reason-templates";
import { publishDemandRequestAction, rejectDemandRequestAction } from "../actions";
import { adminDemandStatusLabel, adminDemandStatusToneClass } from "../status-labels";

type AdminDemandDetailPageProps = {
  params: Promise<{ demandRequestId: string }>;
  searchParams?: Promise<AdminFlashParams & { returnTo?: string }>;
};

const frequencyLabels: Record<string, string> = {
  single: "單堂",
  weekly: "每週",
  biweekly: "雙週",
  monthly: "每月",
};

// 第二批票 06：需求詳情頁先閱讀再操作。順序：返回 → 對象／狀態／時間與摘要 → 處理結果 →
// 需求內容 → 團主與聯絡資料 → 其他資料（收合）→ 審核操作；頁首有跳到審核區的連結。
// 已處理過（已公開、已退回、之後的各狀態）的需求只顯示結果，不再顯示審核按鈕。
// 需求退回是終局：文案一律說明「另建需求」，不寫成修改後重新送審。
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
  const returnTo = safeAdminReturnTo("demands", resolvedSearchParams?.returnTo);
  const contact = [
    demand.organization.contactName,
    demand.organization.contactEmail,
    demand.organization.contactPhone,
  ];
  const locations = getDemandLocationItems(demand).join("、");
  const frequency = demand.frequency ? (frequencyLabels[demand.frequency] ?? demand.frequency) : null;
  const summary = [
    demand.organization.name,
    typeof demand.expectedParticipants === "number" ? `預期 ${demand.expectedParticipants} 人` : null,
    frequency,
    locations || null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <Link
          className="text-sm font-medium text-clay underline underline-offset-4"
          href={returnTo}
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
        {summary.length > 0 ? (
          <p className="mt-2 wrap-anywhere text-sm leading-6 text-ink">{summary.join("・")}</p>
        ) : null}
        {demand.status === "submitted" ? (
          <a
            className="mt-4 inline-flex w-full justify-center rounded-full border border-pine/40 px-5 py-2 text-sm font-medium text-pine transition hover:border-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-auto"
            href="#demand-actions"
          >
            前往審核操作
          </a>
        ) : null}
      </header>

      <AdminFlash message={resolvedSearchParams?.message} result={resolvedSearchParams?.result} />

      {demand.status === "rejected" ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">這筆需求已退回</h2>
          {demand.rejectionReason ? (
            <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-6 text-ink-soft">
              退回原因：{demand.rejectionReason}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            退回後這筆需求不會再進入審核；團主需要另建一筆需求送審，原需求不能修改後重新送出。
          </p>
        </section>
      ) : null}

      {demand.status !== "submitted" && demand.status !== "rejected" ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">這筆需求已處理</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            目前狀態：{adminDemandStatusLabel(demand.status)}。這個階段不需要管理員審核。
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-ink sm:col-span-2">需求內容</h2>
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
        <Field label="偏好時段" value={demand.preferredTimeSlots.join("、") || null} />
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
        <Field label="期望地點" value={locations || null} />
        <Field label="頻率" value={frequency} />
        <Field label="預算" value={demand.budgetRange} />
        <Field label="服務類型" value={getDemandServiceTypes(demand).join("、") || null} />
        <Field label="需求說明" multiline value={demand.description} wide />
      </section>

      <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-ink sm:col-span-2">團主與聯絡資料</h2>
        <Field label="團主" value={demand.organizerProfile.displayName} />
        <Field label="團體" value={demand.organization.name} />
        <Field label="聯絡人" value={contact[0]} />
        <Field label="聯絡 Email" value={contact[1]} />
        <Field label="聯絡電話" value={contact[2]} />
      </section>

      <details className="rounded-2xl border border-ink/15 bg-white p-6">
        <summary className="cursor-pointer text-lg font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay">
          其他資料：每堂長度與團體類型
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="每堂長度"
            value={
              typeof demand.classLengthMinutes === "number"
                ? `${demand.classLengthMinutes} 分鐘`
                : null
            }
          />
          <Field
            label="團體類型"
            value={organizationTypeLabels[demand.organization.type] ?? demand.organization.type}
          />
        </div>
      </details>

      {demand.status === "submitted" ? (
        <section
          aria-labelledby="next-step-title"
          className="grid scroll-mt-6 gap-4 rounded-2xl border border-pine/25 bg-pine-tint p-6"
          id="demand-actions"
        >
          <div>
            <h2 className="text-xl font-semibold text-ink" id="next-step-title">
              審核這筆需求
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              公開後，合適的老師會在「需求池」看到；退回時，原因會顯示給團主，團主需要另建一筆需求才能再送審。
            </p>
          </div>
          <AdminReviewPanel
            approveAction={publishDemandRequestAction}
            detailHref={adminDetailHref("demands", demand.id, returnTo)}
            id={demand.id}
            idField="demandRequestId"
            labels={{
              approve: "公開需求",
              approvePending: "公開處理中…",
              approveRetry: "這筆需求仍是待審，可以稍後再按一次公開。",
              rejectOpen: "退回需求",
              rejectPending: "退回處理中…",
              backToList: "回需求列表",
            }}
            reasonHint="團主會看到這段原因。退回後原需求不能修改重送，請具體、溫和地說明另建需求時要補充什麼（10–1000 字）。"
            reasonPlaceholder="可以點上方常用原因帶入，再依這筆需求的情況修改。"
            rejectAction={rejectDemandRequestAction}
            returnTo={returnTo}
            templates={demandRejectionTemplates}
          />
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
