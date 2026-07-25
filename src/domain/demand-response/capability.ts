import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type ApprovedTeacherContext = {
  userId: string;
  teacherProfileId: string;
};

// 僅適用於「瀏覽新 demand」的 eligibility gate（pool/detail）。
// 查看/withdraw own response 不套用此 gate，見 service.ts 的個別函式說明（D12）。
export async function requireApprovedTeacher(): Promise<ApprovedTeacherContext> {
  const currentUser = await requireUser();

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true, status: true },
  });

  if (!teacherProfile || teacherProfile.status !== "approved") {
    throw new Error("Approved teacher profile required");
  }

  return {
    userId: currentUser.id,
    teacherProfileId: teacherProfile.id,
  };
}

export async function getOwnTeacherProfileId(): Promise<string | null> {
  const currentUser = await requireUser();

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  return teacherProfile?.id ?? null;
}
