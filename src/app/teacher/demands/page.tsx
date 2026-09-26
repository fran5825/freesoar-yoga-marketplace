import { getDemandServiceTypes } from "@/domain/demand-request/service-types";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listPublishedDemandRequestsForTeacher } from "@/domain/demand-response/demand-read-service";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getDemandLocationItems } from "@/domain/demand-request/location";

async function getOwnTeacherProfileStatus() {
  const currentUser = await requireUser();

  return prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { status: true },
  });
}

type TeacherDemandsPageProps = {
  searchParams?: Promise<{ cursor?: string }>;
};

type NonApprovedStatus = "missing" | "draft" | "submitted" | "rejected" | "suspended";

const nonApprovedCopy: Record<
  NonApprovedStatus,
  { title: string; body: string; actionLabel: string }
> = {
  missing: {
    title: "尚未建立老師申請",
    body: "完成老師資格審核後，就可以在這裡瀏覽並回應團體需求。",
    actionLabel: "前往建立老師申請",
  },
  draft: {
    title: "老師申請還在準備中",
    body: "完成並送出申請、通過審核後，就可以在這裡瀏覽並回應團體需求。",
    actionLabel: "繼續整理申請",
  },
  submitted: {
    title: "老師申請審核中",
    body: "審核期間請耐心等候。通過審核後，就可以在這裡瀏覽並回應團體需求。",
    actionLabel: "查看申請狀態",
  },
  rejected: {
    title: "老師申請可修正後重新送出",
    body: "依平台提供的修正方向調整並重新送審後，就可以在這裡瀏覽並回應團體需求。",
    actionLabel: "查看退回說明",
  },
  suspended: {
    title: "帳號目前暫停中",
    body: "此狀態下暫時無法瀏覽或回應新的團體需求。若需要協助，請聯繫平台管理者。",
    actionLabel: "查看目前狀態",
  },
};

export default async function TeacherDemandsPage({
  searchParams,
}: TeacherDemandsPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [teacherProfile, resolvedSearchParams] = await Promise.all([
    getOwnTeacherProfileStatus(),
    searchParams,
  ]);

  if (!teacherProfile || teacherProfile.status !== "approved") {
    const copy =
      nonApprovedCopy[
        (teacherProfile?.status as NonApprovedStatus | undefined) ?? "missing"
      ];

    return (
      <div className="flex flex-col gap-8">
        <header className="border-b border-ink/15 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            團體需求
          </h1>
        </header>
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-medium text-ink">{copy.title}</h2>
          <p className="text-sm leading-6 text-ink-soft">{copy.body}</p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/teacher/dashboard"
            >
              {copy.actionLabel}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const pool = await listPublishedDemandRequestsForTeacher(
    resolvedSearchParams?.cursor,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          團體需求
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          以下是目前公開、你可以回應的團體需求。之後有新的需求會顯示在這裡。
        </p>
      </header>

      {pool.items.length === 0 ? (
        <section className="rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-lg font-medium text-ink">
            目前沒有符合條件的需求
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            之後有新的需求會顯示在這裡，可以稍後再回來看看。
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {pool.items.map((demand) => (
            <Link
              className="block rounded-2xl border border-ink/15 bg-white p-5 transition hover:border-pine/40"
              href={`/teacher/demands/${demand.id}`}
              key={demand.id}
            >
              <h2 className="min-w-0 break-words text-lg font-medium text-ink">
                {demand.title ?? "團體需求"}
              </h2>
              <dl className="mt-3 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
                {getDemandServiceTypes(demand).length > 0 ? (
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">課程類型</dt>
                    <dd className="mt-1 break-words">
                      {getDemandServiceTypes(demand).join("、")}
                    </dd>
                  </div>
                ) : null}
                {typeof demand.expectedParticipants === "number" ? (
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">預估人數</dt>
                    <dd className="mt-1">{demand.expectedParticipants} 人</dd>
                  </div>
                ) : null}
                {getDemandLocationItems(demand).length > 0 ? (
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">期望地點</dt>
                    <dd className="mt-1 break-words">
                      {getDemandLocationItems(demand).join("、")}
                    </dd>
                  </div>
                ) : null}
                {demand.preferredTimeSlots.length > 0 ? (
                  <div className="min-w-0">
                    <dt className="font-medium text-ink">偏好時段</dt>
                    <dd className="mt-1 break-words">
                      {demand.preferredTimeSlots.join("、")}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Link>
          ))}
        </section>
      )}

      {pool.nextCursor ? (
        <div>
          <Link
            className="inline-flex rounded-full border border-ink/25 px-5 py-3 text-sm font-medium text-ink transition hover:bg-cream"
            href={`/teacher/demands?cursor=${pool.nextCursor}`}
          >
            載入更多
          </Link>
        </div>
      ) : null}
    </div>
  );
}
