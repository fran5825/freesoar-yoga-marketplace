import Link from "next/link";

import {
  getDemandNextStep,
  type DemandNextStep,
} from "@/domain/demand-request/next-step";
import type { OwnDemandRequestSummary } from "@/domain/demand-request/service";

const kindClassNames: Record<DemandNextStep["kind"], string> = {
  action: "border-clay/30 bg-clay-tint",
  waiting: "border-pine/20 bg-pine-tint",
  info: "border-ink/15 bg-sand",
};

const kindLabels: Record<DemandNextStep["kind"], string> = {
  action: "下一步",
  waiting: "目前進度",
  info: "目前狀態",
};

// 票 08：詳情頁最上方的「下一步」提示，文案來自 domain 層的 getDemandNextStep。
// 票 11：主要動作依下一步決定——有可選的回應就跳到回應列表、已媒合就跳到建立課程表單、
// 已成課就直接連到那一堂課（不是課程列表）。
export function NextStepCard({
  demandRequest,
}: {
  demandRequest: Pick<
    OwnDemandRequestSummary,
    "id" | "status" | "effectiveResponseCount" | "classSessionId"
  >;
}) {
  const nextStep = getDemandNextStep({
    status: demandRequest.status,
    effectiveResponseCount: demandRequest.effectiveResponseCount,
  });

  const action = getNextStepAction(demandRequest, nextStep);

  return (
    <section
      aria-label="下一步提示"
      className={`grid gap-3 rounded-2xl border p-5 ${kindClassNames[nextStep.kind]}`}
    >
      <div>
        <p className="text-xs font-medium text-clay-deep">
          {kindLabels[nextStep.kind]}
        </p>
        <p className="mt-1 text-base font-medium leading-7 text-ink">
          {nextStep.message}
        </p>
      </div>
      {action ? (
        <div>
          <Link
            className="inline-flex rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
            href={action.href}
          >
            {action.label}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function getNextStepAction(
  demandRequest: Pick<OwnDemandRequestSummary, "id" | "status" | "classSessionId">,
  nextStep: DemandNextStep,
): { href: string; label: string } | null {
  switch (demandRequest.status) {
    case "draft":
      return { href: `/organizer/demands/${demandRequest.id}/edit`, label: "繼續編輯草稿" };
    case "published":
    case "teacher_responded":
      return nextStep.kind === "action"
        ? { href: "#responses", label: "查看老師回應" }
        : null;
    case "matched":
      return { href: "#create-class", label: "填寫課程資訊" };
    case "converted_to_class":
    case "completed":
      return demandRequest.classSessionId
        ? { href: `/organizer/classes/${demandRequest.classSessionId}`, label: "前往這堂課" }
        : { href: "/organizer/classes", label: "前往我的課程" };
    case "rejected":
      return { href: "/organizer/demands/new", label: "建立新的需求" };
    default:
      return null;
  }
}
