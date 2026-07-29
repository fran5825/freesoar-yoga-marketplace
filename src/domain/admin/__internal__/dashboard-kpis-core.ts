// __internal__：不是通用 API。只給 (1) 唯一的 auth-resolving 外層（dashboard-service.ts 的
// getAdminDashboardKpis）與 (2) Playwright 測試直接呼叫——這裡不呼叫 requireAdmin()。
// 可選的 `client` 參數（admin-dashboard D5 修正版）純粹是為了讓測試可以傳入一個
// REPEATABLE READ transaction client，在同一個交易快照內前後兩次呼叫這個函式做精確差值
// 驗證，不受其他平行測試影響（見 admin-dashboard-plan D9）；production 呼叫路徑（
// dashboard-service.ts）不傳這個參數，用預設的真正 prisma singleton，行為不變。

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminDashboardKpis = {
  teacherApplicationsPending: number;
  approvedTeachers: number;
  demandRequestsPendingReview: number;
  publishedDemandRequests: number;
  matchedDemandRequests: number;
  upcomingClassSessions: number;
  confirmedEnrollments: number;
};

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

// D1：7 個獨立、輕量的 count 查詢，Promise.all 平行送出（D4）。
export async function getAdminDashboardKpisCore(
  client: PrismaClientOrTransaction = prisma,
): Promise<AdminDashboardKpis> {
  const now = new Date();

  const [
    teacherApplicationsPending,
    approvedTeachers,
    demandRequestsPendingReview,
    publishedDemandRequests,
    matchedDemandRequests,
    upcomingClassSessions,
    confirmedEnrollments,
  ] = await Promise.all([
    client.teacherProfile.count({ where: { status: "submitted" } }),
    client.teacherProfile.count({ where: { status: "approved" } }),
    client.demandRequest.count({ where: { status: "submitted" } }),
    client.demandRequest.count({ where: { status: "published" } }),
    client.demandRequest.count({ where: { status: "matched" } }),
    client.classSession.count({
      where: { status: "open_for_enrollment", startAt: { gt: now } },
    }),
    client.enrollment.count({ where: { status: "confirmed" } }),
  ]);

  return {
    teacherApplicationsPending,
    approvedTeachers,
    demandRequestsPendingReview,
    publishedDemandRequests,
    matchedDemandRequests,
    upcomingClassSessions,
    confirmedEnrollments,
  };
}
