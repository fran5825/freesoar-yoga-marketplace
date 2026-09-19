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
      <header className="border-b border-ink/15 pb-6">
        <p className="text-sm font-medium text-clay">Admin</p>
        <AdminNav />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          Dashboard
        </h1>
      </header>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold text-ink">待審事項</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            className="rounded-2xl border border-ink/15 bg-white p-5 transition hover:border-pine/40"
            href="/admin/teachers"
          >
            <p className="text-sm font-medium text-ink">
              Teacher applications pending
            </p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {kpis.teacherApplicationsPending}
            </p>
          </Link>
          <Link
            className="rounded-2xl border border-ink/15 bg-white p-5 transition hover:border-pine/40"
            href="/admin/demands"
          >
            <p className="text-sm font-medium text-ink">
              Demand requests pending review
            </p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {kpis.demandRequestsPendingReview}
            </p>
          </Link>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold text-ink">Basic KPIs</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-ink/15 bg-white p-5">
            <p className="text-sm font-medium text-ink">Approved teachers</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {kpis.approvedTeachers}
            </p>
          </div>
          <div className="rounded-2xl border border-ink/15 bg-white p-5">
            <p className="text-sm font-medium text-ink">Published demand requests</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {kpis.publishedDemandRequests}
            </p>
          </div>
          <div className="rounded-2xl border border-ink/15 bg-white p-5">
            <p className="text-sm font-medium text-ink">Matched demand requests</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {kpis.matchedDemandRequests}
            </p>
          </div>
          <div className="rounded-2xl border border-ink/15 bg-white p-5">
            <p className="text-sm font-medium text-ink">Upcoming class sessions</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {kpis.upcomingClassSessions}
            </p>
          </div>
          <div className="rounded-2xl border border-ink/15 bg-white p-5">
            <p className="text-sm font-medium text-ink">Confirmed enrollments</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {kpis.confirmedEnrollments}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
