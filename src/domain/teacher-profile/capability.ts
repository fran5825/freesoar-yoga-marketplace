import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type ApprovedTeacherContext = {
  userId: string;
  teacherProfileId: string;
};

// teacher-availability D10：從 demand-response/capability.ts 搬遷過來——這是 TeacherProfile
// 狀態機本身的判斷（「這個使用者是不是 approved teacher」），不是 demand-response 專屬邏輯。
// 用於「瀏覽新 demand」的 eligibility gate（pool/detail）與 teacher-availability 的新增/刪除
// 動作。查看/withdraw own demand response、查看 own availability 不套用此 gate，各自見
// demand-response/service.ts 與 teacher-availability/read-service.ts 的個別函式說明。
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
