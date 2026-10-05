import Link from "next/link";
import { redirect } from "next/navigation";

import { listOwnClassSessionsForOrganizer } from "@/domain/class-session/read-service";
import { classOriginLabelsForOrganizer } from "@/domain/class-session/origin-labels";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { listOwnActiveProposalsForOrganizer } from "@/domain/organizer-class-proposal/service";
import { DIRECT_CLASS_ENTRY_PUBLIC } from "@/domain/organizer-profile/intent";
import { requireUser } from "@/lib/auth/session";

import {
  proposalStatusLabels,
  proposalStatusToneClasses,
} from "../class-proposals/_components/page-helpers";
import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "./_components/status-labels";

export default async function OrganizerClassesPage() {
  try {
    await requireUser();
  } catch {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/organizer/classes")}`);
  }

  const [classSessions, proposals] = await Promise.all([
    listOwnClassSessionsForOrganizer(),
    listOwnActiveProposalsForOrganizer(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          我的課程
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          這裡列出你的團主課程，包含找老師媒合成立的，以及直接邀請合作老師開放報名的課程。
        </p>
        {DIRECT_CLASS_ENTRY_PUBLIC ? (
          <div className="mt-4">
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-2 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/organizer/class-proposals/new"
            >
              已有合作老師，直接開團
            </Link>
          </div>
        ) : null}
      </header>

      {/* 票 10：還沒開放報名的直接開團（草稿、等待老師確認、已確認、被婉拒）列在正式課程上方，
          建立後找得回來；待我處理／等待對方的細分在票 12。 */}
      {proposals.length > 0 ? (
        <section aria-labelledby="proposal-progress-heading" className="grid gap-3">
          <h2 className="text-lg font-semibold text-ink" id="proposal-progress-heading">
            直接開團的進度
          </h2>
          <ul className="grid gap-3">
            {proposals.map((proposal) => (
              <li key={proposal.id}>
                <Link
                  className="grid gap-2 rounded-2xl border border-ink/15 bg-white p-5 transition hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                  href={`/organizer/class-proposals/${proposal.id}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 break-words text-base font-semibold text-ink">
                      {proposal.title ?? "尚未命名的課程"}
                    </span>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${proposalStatusToneClasses[proposal.status]}`}
                    >
                      {proposalStatusLabels[proposal.status]}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">
                    {[
                      proposal.organizationName,
                      proposal.teacherDisplayName ? `老師：${proposal.teacherDisplayName}` : "尚未選老師",
                      proposal.startAt ? formatTaipeiDatetime(proposal.startAt) : "尚未填時間",
                    ].join("・")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {classSessions.length === 0 ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">
            尚未建立任何課程
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            找老師的需求選定老師後，可以在需求詳情頁建立正式課程；已有合作老師時，老師確認邀請後就能開放報名。
          </p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/organizer/demands"
            >
              回到需求列表
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4">
          {classSessions.map((classSession) => (
            <article
              className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-5"
              key={classSession.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-lg font-semibold text-ink">
                  {classSession.title}
                </h2>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
                >
                  {classSessionStatusLabels[classSession.status]}
                </span>
                <span className="w-fit rounded-full border border-ink/15 px-3 py-1 text-xs text-ink-soft">
                  {classOriginLabelsForOrganizer[classSession.origin]}
                </span>
              </div>
              <p className="text-sm text-ink-faint">
                {formatTaipeiDatetime(classSession.startAt)} 開始
              </p>
              <div>
                <Link
                  className="rounded-full border border-ink/25 px-4 py-2 text-center text-sm font-medium text-ink transition hover:bg-cream"
                  href={`/organizer/classes/${classSession.id}`}
                >
                  查看詳情
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
