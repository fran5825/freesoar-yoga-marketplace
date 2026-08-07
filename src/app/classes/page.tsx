import Link from "next/link";

import { SERVICE_TYPES } from "@/domain/demand-request/service-types";
import { getPublicClassSessionListItems } from "@/domain/class-session/public-read-service";
import { formatTaipeiDatetime } from "@/domain/class-session/timezone";

const dayOfWeekLabels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

type PublicClassesPageProps = {
  searchParams?: Promise<{ serviceType?: string; dayOfWeek?: string }>;
};

// teacher-initiated-open-classes 第 9 節（Slice D）：完全不檢查登入狀態，任何人（Visitor 或
// Member）都能瀏覽。Gate G6 = A，視覺沿用現有頁面既有元件與 Tailwind class 慣例，不引入新
// 色票——品牌視覺計畫核准後再套用（比照 lightweight-payment-v0-plan 的既有先例）。
export default async function PublicClassesPage({ searchParams }: PublicClassesPageProps) {
  const resolvedSearchParams = await searchParams;
  const serviceType = resolvedSearchParams?.serviceType?.trim() || undefined;
  const dayOfWeek =
    resolvedSearchParams?.dayOfWeek !== undefined && resolvedSearchParams.dayOfWeek !== ""
      ? Number(resolvedSearchParams.dayOfWeek)
      : undefined;

  const classSessions = await getPublicClassSessionListItems({
    serviceType,
    dayOfWeek: Number.isInteger(dayOfWeek) ? dayOfWeek : undefined,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Classes</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          瀏覽公開課程
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          這裡列出老師公開招募的課程，登入後即可直接報名。
        </p>
      </header>

      <form className="grid gap-4 rounded border border-gray-200 bg-white p-5 sm:grid-cols-3" method="get">
        <div>
          <label className="text-sm font-medium text-gray-950" htmlFor="serviceType">
            課程類型
          </label>
          <select
            className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            defaultValue={serviceType ?? ""}
            id="serviceType"
            name="serviceType"
          >
            <option value="">不限類型</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-950" htmlFor="dayOfWeek">
            星期幾
          </label>
          <select
            className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            defaultValue={resolvedSearchParams?.dayOfWeek ?? ""}
            id="dayOfWeek"
            name="dayOfWeek"
          >
            <option value="">不限星期</option>
            {dayOfWeekLabels.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            className="w-full rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            type="submit"
          >
            套用篩選
          </button>
        </div>
      </form>

      {classSessions.length === 0 ? (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-950">目前沒有符合條件的公開課程</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            請調整篩選條件，或稍後再回來看看。
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {classSessions.map((classSession) => (
            <Link
              className="grid gap-2 rounded border border-gray-200 bg-white p-5 transition hover:border-sky-300 hover:bg-sky-50/40"
              href={`/classes/${classSession.id}`}
              key={classSession.id}
            >
              <h2 className="min-w-0 break-words text-lg font-medium text-gray-950">
                {classSession.title}
              </h2>
              <p className="text-sm text-gray-600">
                {classSession.teacherProfile.displayName ?? "老師"}
                {classSession.serviceType ? ` ・ ${classSession.serviceType}` : ""}
              </p>
              <p className="text-sm text-gray-600">
                {formatTaipeiDatetime(classSession.startAt)} 開始 ・ {classSession.location}
              </p>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
