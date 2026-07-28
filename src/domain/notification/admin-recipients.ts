import { prisma } from "@/lib/prisma";

// D5：本輪唯一的 admin 收件人來源，只給 domain/service layer 內部呼叫，不對外匯出。
export async function listAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { isAdmin: true },
    select: { id: true },
  });

  return admins.map((admin) => admin.id);
}
