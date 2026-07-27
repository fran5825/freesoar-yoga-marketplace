import type { EnrollmentStatus } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type OwnEnrollment = {
  id: string;
  status: EnrollmentStatus;
  notes: string | null;
  createdAt: Date;
  classSession: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    location: string;
  };
};

// Member own-scoped，供 /member/enrollments 顯示。
export async function listOwnEnrollmentsForMember(): Promise<OwnEnrollment[]> {
  const currentUser = await requireUser();

  return prisma.enrollment.findMany({
    where: { userId: currentUser.id },
    select: {
      id: true,
      status: true,
      notes: true,
      createdAt: true,
      classSession: {
        select: { id: true, title: true, startAt: true, endAt: true, location: true },
      },
    },
    orderBy: { classSession: { startAt: "asc" } },
  });
}

export type MemberFacingClassSession = {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  status: string;
  organization: { name: string };
  teacherProfile: { displayName: string | null };
  ownEnrollment: { id: string; status: EnrollmentStatus } | null;
};

// D4：只回傳 status === "open_for_enrollment" 的 class session，draft 一律回傳 null
// （not-found 語意）——draft 代表 Organizer 根本還沒開放、也還沒產生過任何分享連結，
// 不應該讓任何人透過猜測 classSessionId 就看到未開放課程的完整內容。這個過濾不會讓
// 「目前無法報名」這個 UI 狀態變成不可達：D3 確定本輪不接線 open_for_enrollment 之後的
// 任何狀態轉換，所以一個「已經開始但還沒被任何機制關閉」的 class session 依然是
// open_for_enrollment，這個函式依然會回傳它，UI 層再用 startAt 判斷要顯示報名表單
// 還是「目前無法報名」（見 D14）。
export async function getClassSessionForMember(
  classSessionId: string,
): Promise<MemberFacingClassSession | null> {
  const currentUser = await requireUser();

  const classSession = await prisma.classSession.findFirst({
    where: { id: classSessionId, status: "open_for_enrollment" },
    select: {
      id: true,
      title: true,
      description: true,
      serviceType: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      status: true,
      organization: { select: { name: true } },
      teacherProfile: { select: { displayName: true } },
    },
  });

  if (!classSession) {
    return null;
  }

  const ownEnrollment = await prisma.enrollment.findUnique({
    where: { classSessionId_userId: { classSessionId, userId: currentUser.id } },
    select: { id: true, status: true },
  });

  return { ...classSession, ownEnrollment };
}

export type ClassSessionRosterEntry = {
  id: string;
  memberLabel: string;
  notes: string | null;
};

// D9：僅供 Organizer 的單一 class session 詳情頁使用（own-scoped，檢查
// organizerProfileId 屬於自己），只回傳 confirmed enrollment。這個函式一次只服務一個
// class session，沒有 N+1 問題（Teacher 列表頁的 roster 改用
// class-session/read-service.ts 的 listOwnClassSessionsForTeacher() 一次查詢帶出）。
export async function listConfirmedEnrollmentsForClassSession(
  classSessionId: string,
): Promise<ClassSessionRosterEntry[] | null> {
  const currentUser = await requireUser();

  const ownClassSession = await prisma.classSession.findFirst({
    where: { id: classSessionId, organizerProfile: { userId: currentUser.id } },
    select: { id: true },
  });

  if (!ownClassSession) {
    return null;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { classSessionId, status: "confirmed" },
    select: { id: true, notes: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    memberLabel: enrollment.user.name ?? enrollment.user.email ?? "會員",
    notes: enrollment.notes,
  }));
}
