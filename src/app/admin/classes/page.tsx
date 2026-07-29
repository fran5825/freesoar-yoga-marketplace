import Link from "next/link";
import { notFound } from "next/navigation";

import {
  classSessionStatusLabels,
  classSessionStatusToneClasses,
} from "@/app/organizer/classes/_components/status-labels";
import { AdminNav } from "@/app/admin/_components/admin-nav";
import {
  listAllClassSessionsForAdmin,
  type AdminClassSessionSummary,
} from "@/domain/class-session/admin-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireAdmin } from "@/lib/auth/session";

// D6（admin-class-enrollment-management）：ClassSession 從來不需要 Admin 核准才能推進
// 狀態，沒有天然的「待處理」子集，一次查詢回傳所有狀態，頁面依狀態分組顯示。
const statusGroups: { status: AdminClassSessionSummary["status"]; heading: string }[] = [
  { status: "open_for_enrollment", heading: "開放中" },
  { status: "completed", heading: "已完成" },
  { status: "cancelled", heading: "已取消" },
  { status: "draft", heading: "草稿" },
];

export default async function AdminClassesPage() {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const classSessions = await listAllClassSessionsForAdmin();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Admin</p>
        <AdminNav />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          Class sessions
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          查看全平台所有課程場次，並在必要時介入取消。
        </p>
      </header>

      {classSessions.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">目前沒有任何課程</h2>
        </section>
      ) : (
        statusGroups.map(({ status, heading }) => {
          const group = classSessions.filter((classSession) => classSession.status === status);

          return (
            <section className="grid gap-4" key={status}>
              <h2 className="text-xl font-semibold text-gray-950">
                {heading}（{group.length}）
              </h2>
              {group.length === 0 ? (
                <p className="text-sm leading-6 text-gray-600">目前沒有這個狀態的課程。</p>
              ) : (
                group.map((classSession) => (
                  <Link
                    className="grid gap-3 rounded border border-gray-200 bg-white p-5 transition hover:border-sky-300"
                    href={`/admin/classes/${classSession.id}`}
                    key={classSession.id}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="min-w-0 break-words text-lg font-medium text-gray-950">
                        {classSession.title}
                      </h3>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${classSessionStatusToneClasses[classSession.status]}`}
                      >
                        {classSessionStatusLabels[classSession.status]}
                      </span>
                    </div>
                    <dl className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="font-medium text-gray-950">團主</dt>
                        <dd className="mt-1 break-words">{classSession.organizerDisplayName}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-medium text-gray-950">授課老師</dt>
                        <dd className="mt-1 break-words">
                          {classSession.teacherDisplayName ?? "尚未填寫"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-medium text-gray-950">團體</dt>
                        <dd className="mt-1 break-words">{classSession.organizationName}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-medium text-gray-950">開始時間</dt>
                        <dd className="mt-1">{formatTaipeiDatetime(classSession.startAt)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-medium text-gray-950">已報名（confirmed）</dt>
                        <dd className="mt-1">{classSession.confirmedEnrollmentCount} 人</dd>
                      </div>
                    </dl>
                  </Link>
                ))
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
