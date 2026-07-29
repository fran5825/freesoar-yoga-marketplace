import type { ClassSessionStatus, EnrollmentStatus } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  cancelClassSessionForAdmin as cancelClassSessionForAdminCore,
  type CancelClassSessionForOrganizerResult,
} from "./__internal__/cancel-class-session-core";

// D6（admin-class-enrollment-management）：Admin 總覽用，一次查詢回傳所有狀態的 class
// session（不像 admin/demands 那樣只顯示單一「待處理」狀態——ClassSession 從來不需要
// Admin 核准才能推進，沒有天然的待處理子集），頁面自己依狀態分組顯示。
export type AdminClassSessionSummary = {
  id: string;
  title: string;
  status: ClassSessionStatus;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  updatedAt: Date;
  organizerDisplayName: string;
  teacherDisplayName: string | null;
  organizationName: string;
  confirmedEnrollmentCount: number;
};

export async function listAllClassSessionsForAdmin(): Promise<AdminClassSessionSummary[]> {
  await requireAdmin();

  const classSessions = await prisma.classSession.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      updatedAt: true,
      organizerProfile: { select: { displayName: true } },
      teacherProfile: { select: { displayName: true } },
      organization: { select: { name: true } },
      _count: { select: { enrollments: { where: { status: "confirmed" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return classSessions.map((classSession) => ({
    id: classSession.id,
    title: classSession.title,
    status: classSession.status,
    startAt: classSession.startAt,
    endAt: classSession.endAt,
    location: classSession.location,
    capacity: classSession.capacity,
    updatedAt: classSession.updatedAt,
    organizerDisplayName: classSession.organizerProfile.displayName,
    teacherDisplayName: classSession.teacherProfile.displayName,
    organizationName: classSession.organization.name,
    confirmedEnrollmentCount: classSession._count.enrollments,
  }));
}

// D7 修正版（codex round 2）：跟 Organizer own-scoped 用的 ClassSessionRosterEntry 不同，
// 這裡刻意帶 status——Admin 需要看到「這位 Member 是不是已經自己取消過了」這種歷史狀態，
// 才能正確判斷要不要／能不能介入，不是單純的報名名單。
export type AdminClassSessionRosterEntry = {
  id: string;
  memberLabel: string;
  notes: string | null;
  status: EnrollmentStatus;
};

export type AdminClassSessionDetail = {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  isPublic: boolean;
  status: ClassSessionStatus;
  createdAt: Date;
  demandRequest: { targetLevel: string | null };
  organizerProfile: { displayName: string };
  teacherProfile: { displayName: string | null };
  organization: { name: string };
  roster: AdminClassSessionRosterEntry[];
};

// 查無資料回傳 null（not-found 語意，比照既有 Organizer/Teacher 讀取函式的既有慣例）。
export async function getClassSessionDetailForAdmin(
  classSessionId: string,
): Promise<AdminClassSessionDetail | null> {
  await requireAdmin();

  const classSession = await prisma.classSession.findUnique({
    where: { id: classSessionId },
    select: {
      id: true,
      title: true,
      description: true,
      serviceType: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      isPublic: true,
      status: true,
      createdAt: true,
      demandRequest: { select: { targetLevel: true } },
      organizerProfile: { select: { displayName: true } },
      teacherProfile: { select: { displayName: true } },
      organization: { select: { name: true } },
      enrollments: {
        select: {
          id: true,
          notes: true,
          status: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!classSession) {
    return null;
  }

  const { enrollments, ...rest } = classSession;

  return {
    ...rest,
    roster: enrollments.map((enrollment) => ({
      id: enrollment.id,
      memberLabel: enrollment.user.name ?? enrollment.user.email ?? "會員",
      notes: enrollment.notes,
      status: enrollment.status,
    })),
  };
}

export type CancelClassSessionForAdminErrorCode =
  | "admin_permission_required"
  | Extract<CancelClassSessionForOrganizerResult, { ok: false }>["code"];

export type CancelClassSessionForAdminResult =
  | { ok: true }
  | { ok: false; code: CancelClassSessionForAdminErrorCode; message: string };

const cancelClassSessionErrorMessages: Record<
  Extract<CancelClassSessionForAdminErrorCode, string>,
  string
> = {
  admin_permission_required: "需要 Admin 權限才能取消課程。",
  class_session_not_found: "找不到這堂課程。",
  class_session_already_cancelled: "這堂課程已經取消過了。",
  class_session_already_started: "這堂課程已經開始，無法取消。",
  class_session_not_cancellable: "這堂課程目前狀態不允許取消。",
  cancel_failed: "課程暫時無法取消，請稍後再試。",
};

// D1/D5：Admin-scoped 取消，requireAdmin() 把關後委派給不含權限檢查的 __internal__ 核心
// （跟既有 cancelClassSessionForOrganizer 共用同一段鎖 + 連帶取消 + 通知邏輯），比照
// demand-request/admin-service.ts 既有的 write-function 錯誤碼慣例。
export async function cancelClassSessionForAdmin(
  classSessionId: string,
): Promise<CancelClassSessionForAdminResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (isAdminPermissionRequiredError(error)) {
      return {
        ok: false,
        code: "admin_permission_required",
        message: cancelClassSessionErrorMessages.admin_permission_required,
      };
    }

    throw error;
  }

  const result = await cancelClassSessionForAdminCore(classSessionId);

  if (result.ok) {
    return result;
  }

  return { ok: false, code: result.code, message: cancelClassSessionErrorMessages[result.code] };
}

function isAdminPermissionRequiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Authentication required" || error.message === "Admin access required")
  );
}
