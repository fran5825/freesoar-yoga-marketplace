import Link from "next/link";
import { redirect } from "next/navigation";

import { listOwnClassSessionsForOrganizer } from "@/domain/class-session/read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireUser } from "@/lib/auth/session";

import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "./_components/status-labels";

export default async function OrganizerClassesPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const classSessions = await listOwnClassSessionsForOrganizer();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-amber-700">Organizer classes</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          我的課程
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          這裡列出從已媒合需求建立的所有課程。
        </p>
      </header>

      {classSessions.length === 0 ? (
        <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-gray-950">
            尚未建立任何課程
          </h2>
          <p className="text-sm leading-6 text-gray-600">
            當你選定老師之後，就可以在需求詳情頁建立正式課程。
          </p>
          <div>
            <Link
              className="inline-flex rounded bg-gray-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
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
              className="grid gap-3 rounded border border-gray-200 bg-white p-5"
              key={classSession.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-lg font-semibold text-gray-950">
                  {classSession.title}
                </h2>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
                >
                  {classSessionStatusLabels[classSession.status]}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {formatTaipeiDatetime(classSession.startAt)} 開始
              </p>
              <div>
                <Link
                  className="rounded border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                  href={`/organizer/classes/${classSession.id}`}
                >
                  查看詳情
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
