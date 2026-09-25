import Link from "next/link";

import {
  getDemandNextStep,
  type DemandNextStep,
} from "@/domain/demand-request/next-step";
import type { DemandRequestSnapshot } from "@/domain/demand-request/service";

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
export function NextStepCard({
  demandRequest,
  responseCount,
}: {
  demandRequest: Pick<DemandRequestSnapshot, "id" | "status">;
  responseCount: number;
}) {
  const nextStep = getDemandNextStep({
    status: demandRequest.status,
    responseCount,
  });

  const action =
    demandRequest.status === "draft"
      ? { href: `/organizer/demands/${demandRequest.id}/edit`, label: "繼續編輯草稿" }
      : demandRequest.status === "converted_to_class"
        ? { href: "/organizer/classes", label: "前往我的課程" }
        : demandRequest.status === "rejected"
          ? { href: "/organizer/demands/new", label: "建立新的需求" }
          : null;

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
