import { requireAdmin } from "@/lib/auth/session";

import {
  getAdminDashboardKpisCore,
  type AdminDashboardKpis,
} from "./__internal__/dashboard-kpis-core";

export type { AdminDashboardKpis };

// D5：requireAdmin() 把關一次，委派給不含權限檢查的 __internal__ 核心。
export async function getAdminDashboardKpis(): Promise<AdminDashboardKpis> {
  await requireAdmin();

  return getAdminDashboardKpisCore();
}
