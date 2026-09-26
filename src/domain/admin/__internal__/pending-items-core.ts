// __internal__：不含 requireAdmin()，只給 dashboard-service.ts 的 listAdminPendingItems 呼叫。
// 只讀取現有資料（待審老師申請、待審需求），不改任何狀態。

import { prisma } from "@/lib/prisma";

export const ADMIN_PENDING_ITEMS_LIMIT = 5;

export type AdminPendingItem = {
  id: string;
  // 主要文字：老師顯示名稱／需求標題。
  title: string;
  // 補充文字：需求所屬團體；老師申請沒有。
  subtitle: string | null;
  // 最後更新時間（送審後不會再被老師編輯，所以等同送審時間）。
  updatedAt: Date;
};

export type AdminPendingItems = {
  teacherApplications: { total: number; items: AdminPendingItem[] };
  demandRequests: { total: number; items: AdminPendingItem[] };
};

// 等最久的排最前面：管理員應該先處理已經等很久的。
export async function listAdminPendingItemsCore(): Promise<AdminPendingItems> {
  const [teacherTotal, teachers, demandTotal, demands] = await Promise.all([
    prisma.teacherProfile.count({ where: { status: "submitted" } }),
    prisma.teacherProfile.findMany({
      where: { status: "submitted" },
      orderBy: { updatedAt: "asc" },
      take: ADMIN_PENDING_ITEMS_LIMIT,
      select: { id: true, displayName: true, updatedAt: true },
    }),
    prisma.demandRequest.count({ where: { status: "submitted" } }),
    prisma.demandRequest.findMany({
      where: { status: "submitted" },
      orderBy: { updatedAt: "asc" },
      take: ADMIN_PENDING_ITEMS_LIMIT,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        organization: { select: { name: true } },
      },
    }),
  ]);

  return {
    teacherApplications: {
      total: teacherTotal,
      items: teachers.map((teacher) => ({
        id: teacher.id,
        title: teacher.displayName ?? "未填顯示名稱",
        subtitle: null,
        updatedAt: teacher.updatedAt,
      })),
    },
    demandRequests: {
      total: demandTotal,
      items: demands.map((demand) => ({
        id: demand.id,
        title: demand.title ?? "未命名的需求",
        subtitle: demand.organization.name,
        updatedAt: demand.updatedAt,
      })),
    },
  };
}
