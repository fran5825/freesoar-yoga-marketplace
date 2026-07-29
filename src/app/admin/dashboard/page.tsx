import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminDashboardKpis } from "@/domain/admin/dashboard-service";
import { requireAdmin } from "@/lib/auth/session";

import { AdminNav } from "../_components/admin-nav";

export default async function AdminDashboardPage() {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const kpis = await getAdminDashboardKpis();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Admin</p>
        <AdminNav />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          Dashboard
        </h1>
      </header>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold text-gray-950">待審事項</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            className="rounded border border-gray-200 bg-white p-5 transition hover:border-sky-300"
            href="/admin/teachers"
          >
            <p className="text-sm font-medium text-gray-950">
              Teacher applications pending
            </p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {kpis.teacherApplicationsPending}
            </p>
          </Link>
          <Link
            className="rounded border border-gray-200 bg-white p-5 transition hover:border-sky-300"
            href="/admin/demands"
          >
            <p className="text-sm font-medium text-gray-950">
              Demand requests pending review
            </p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {kpis.demandRequestsPendingReview}
            </p>
          </Link>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold text-gray-950">Basic KPIs</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-950">Approved teachers</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {kpis.approvedTeachers}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-950">Published demand requests</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {kpis.publishedDemandRequests}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-950">Matched demand requests</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {kpis.matchedDemandRequests}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-950">Upcoming class sessions</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {kpis.upcomingClassSessions}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-950">Confirmed enrollments</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {kpis.confirmedEnrollments}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
