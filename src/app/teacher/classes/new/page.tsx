import Link from "next/link";
import { redirect } from "next/navigation";

import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

import { ClassSessionCreateForm } from "./_components/ClassSessionCreateForm";

type NewClassSessionPageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
};

export default async function NewClassSessionPage({
  searchParams,
}: NewClassSessionPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [profile, resolvedSearchParams] = await Promise.all([
    getOwnTeacherProfileApplicationSnapshot(),
    searchParams,
  ]);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success" ? ("success" as const) : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  // teacher-initiated-open-classes：只有 approved 老師才能自建課程，suspended 老師只能唯讀
  // 查看既有課程，不能開新的——比照既有 demand-response 資格檢查慣例。
  if (!profile || profile.status !== "approved") {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="border-b border-gray-200 pb-6">
          <p className="text-sm font-medium text-sky-700">Teacher</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            建立課程
          </h1>
        </header>
        <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-medium text-gray-950">
            {profile?.status === "suspended"
              ? "老師資格已暫停"
              : "只有審核通過的老師才能建立課程"}
          </h2>
          <p className="text-sm leading-6 text-gray-600">
            {profile?.status === "suspended"
              ? "暫停期間無法開立新課程，既有課程仍可在「我的課程」查看。"
              : "完成並通過老師資格審核後，就可以在這裡直接開課，不需要等待團主媒合。"}
          </p>
          <div>
            <Link
              className="inline-flex rounded bg-gray-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
              href="/teacher/dashboard"
            >
              查看老師申請狀態
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Teacher</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          建立課程
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          不需要團主媒合，直接開一堂自己的課。建立後會出現在「我的課程」，可以自行取消或標記完成。
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
        <ClassSessionCreateForm />
      </section>
    </main>
  );
}
