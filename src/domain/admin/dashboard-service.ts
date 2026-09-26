import { requireAdmin } from "@/lib/auth/session";

import {
  getAdminDashboardKpisCore,
  type AdminDashboardKpis,
} from "./__internal__/dashboard-kpis-core";

import {
  listAdminPendingItemsCore,
  type AdminPendingItem,
  type AdminPendingItems,
} from "./__internal__/pending-items-core";

export type { AdminDashboardKpis, AdminPendingItem, AdminPendingItems };

// D5：requireAdmin() 把關一次，委派給不含權限檢查的 __internal__ 核心。
export async function getAdminDashboardKpis(): Promise<AdminDashboardKpis> {
  await requireAdmin();

  return getAdminDashboardKpisCore();
}

// admin-usability 票 03：總覽「待你處理」。同樣由 requireAdmin() 把關一次。
export async function listAdminPendingItems(): Promise<AdminPendingItems> {
  await requireAdmin();

  return listAdminPendingItemsCore();
}
