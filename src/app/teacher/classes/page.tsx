import { redirect } from "next/navigation";

import { demandRequestTargetLevelLabels } from "@/app/organizer/demands/_components/status-labels";
import { listOwnClassSessionsForTeacher } from "@/domain/class-session/read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";
import { requireUser } from "@/lib/auth/session";

// D15：唯讀查看已經指派給自己的既有 class session，不透過 requireApprovedTeacher() 把關——
// 這是查看既有承諾，不是申請新機會，suspended teacher 仍可查看。
export default async function TeacherClassesPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const classSessions = await listOwnClassSessionsForTeacher();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Teacher classes</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          我的課程
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          這裡列出團主已經為你建立的正式課程。
        </p>
      </header>

      {classSessions.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">
            目前沒有已建立的課程
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            當團主選定你並建立課程後，會顯示在這裡。
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {classSessions.map((classSession) => (
            <article
              className="grid gap-3 rounded border border-gray-200 bg-white p-5"
              key={classSession.id}
            >
              <h2 className="min-w-0 break-words text-lg font-medium text-gray-950">
                {classSession.title}
              </h2>
              <dl className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">團體</dt>
                  <dd className="mt-1 break-words">{classSession.organization.name}</dd>
                </div>
                {classSession.serviceType ? (
                  <div className="min-w-0">
                    <dt className="font-medium text-gray-950">課程類型</dt>
                    <dd className="mt-1 break-words">{classSession.serviceType}</dd>
                  </div>
                ) : null}
                {classSession.demandRequest.targetLevel ? (
                  <div className="min-w-0">
                    <dt className="font-medium text-gray-950">程度</dt>
                    <dd className="mt-1 break-words">
                      {demandRequestTargetLevelLabels[
                        classSession.demandRequest.targetLevel
                      ] ?? classSession.demandRequest.targetLevel}
                    </dd>
                  </div>
                ) : null}
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">開始時間</dt>
                  <dd className="mt-1">{formatTaipeiDatetime(classSession.startAt)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">結束時間</dt>
                  <dd className="mt-1">{formatTaipeiDatetime(classSession.endAt)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">地點</dt>
                  <dd className="mt-1 break-words">{classSession.location}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium text-gray-950">名額上限</dt>
                  <dd className="mt-1">{classSession.capacity} 人</dd>
                </div>
              </dl>
              {classSession.description ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                  {classSession.description}
                </p>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
