import Link from "next/link";
import { redirect } from "next/navigation";

import { getOwnDemandRequestList } from "@/domain/demand-request/service";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

import {
  demandRequestStatusLabels,
  demandRequestStatusToneClasses,
  formatDemandRequestDateTime,
} from "./_components/status-labels";

export default async function OrganizerDemandsPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [organizerContext, demandRequests] = await Promise.all([
    getOwnOrganizerContext(),
    getOwnDemandRequestList(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="grid gap-3 border-b border-ink/15 pb-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            我的需求列表
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            這裡列出你提出過的所有團課需求與目前狀態。
          </p>
        </div>
        {organizerContext ? (
          <Link
            className="inline-flex justify-center rounded-full bg-pine px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-pine-deep"
            href="/organizer/demands/new"
          >
            建立新的需求
          </Link>
        ) : null}
      </header>

      {!organizerContext ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">
            請先建立團主資料
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            建立團主資料後，你就可以開始提出並管理團課需求。
          </p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/organizer/profile"
            >
              前往建立團主資料
            </Link>
          </div>
        </section>
      ) : demandRequests.length === 0 ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">
            尚未提出任何需求
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            你可以先建立一筆需求草稿，準備好後再送出審核。
          </p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/organizer/demands/new"
            >
              建立新的需求
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4">
          {demandRequests.map((demandRequest) => (
            <article
              className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5"
              key={demandRequest.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-lg font-semibold text-ink">
                  {demandRequest.title ?? "尚未命名的需求"}
                </h2>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${demandRequestStatusToneClasses[demandRequest.status]}`}
                >
                  {demandRequestStatusLabels[demandRequest.status]}
                </span>
              </div>
              <p className="text-sm text-ink-faint">
                最後更新：{formatDemandRequestDateTime(demandRequest.updatedAt)}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  className="rounded-full border border-ink/25 px-4 py-2 text-center text-sm font-medium text-ink transition hover:bg-cream"
                  href={`/organizer/demands/${demandRequest.id}`}
                >
                  查看詳情
                </Link>
                {demandRequest.status === "draft" ? (
                  <Link
                    className="rounded-full bg-pine px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-pine-deep"
                    href={`/organizer/demands/${demandRequest.id}/edit`}
                  >
                    繼續編輯草稿
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
