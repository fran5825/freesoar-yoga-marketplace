import type {
  ClassSessionOrigin,
  ClassSessionStatus,
  DemandRequestStatus,
  EnrollmentPaymentStatus,
  EnrollmentStatus,
  OrganizationType,
  TeacherProfileStatus,
} from "@prisma/client";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  cancelClassSessionForAdmin as cancelClassSessionForAdminCore,
  type CancelClassSessionForOrganizerResult,
} from "./__internal__/cancel-class-session-core";
import { describeEnrollmentCancelReason } from "@/domain/enrollment/cancel-reason";
import { occupyingEnrollmentWhere } from "@/domain/enrollment/seat-occupancy";

// D6（admin-class-enrollment-management）：Admin 總覽用，一次查詢回傳所有狀態的 class
// session（不像 admin/demands 那樣只顯示單一「待處理」狀態——ClassSession 從來不需要
// Admin 核准才能推進，沒有天然的待處理子集），頁面自己依狀態分組顯示。
export type AdminClassSessionSummary = {
  // organizer-usability-redesign 票 09：管理員依 origin 辨識三種課程來源。
  origin: ClassSessionOrigin;
  id: string;
  title: string;
  status: ClassSessionStatus;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  updatedAt: Date;
  // teacher-initiated-open-classes：老師自建課程沒有 organizerProfile／organization，
  // 兩個顯示欄位改為 nullable；消費頁面需自行提供中性 fallback 文案。
  organizerDisplayName: string | null;
  teacherDisplayName: string | null;
  organizationName: string | null;
  confirmedEnrollmentCount: number;
  // 第三批票 09：只用來在「只看這個團體／老師」時依 id 篩選，不是授權依據。
  organizationId: string | null;
  teacherProfileId: string;
};

// 第三批票 09：老師詳情「這位老師的課程」入口顯示的數量，與課程列表限定後的「全部」一致。
export async function countClassSessionsForTeacherForAdmin(teacherProfileId: string): Promise<number> {
  await requireAdmin();

  return prisma.classSession.count({ where: { teacherProfileId } });
}

export async function listAllClassSessionsForAdmin(): Promise<AdminClassSessionSummary[]> {
  await requireAdmin();

  const classSessions = await prisma.classSession.findMany({
    select: {
      id: true,
      title: true,
      origin: true,
      status: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      updatedAt: true,
      organizationId: true,
      teacherProfileId: true,
      organizerProfile: { select: { displayName: true } },
      teacherProfile: { select: { displayName: true, status: true } },
      organization: { select: { name: true } },
      _count: { select: { enrollments: { where: { status: "confirmed" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return classSessions.map((classSession) => ({
    id: classSession.id,
    title: classSession.title,
    origin: classSession.origin,
    status: classSession.status,
    startAt: classSession.startAt,
    endAt: classSession.endAt,
    location: classSession.location,
    capacity: classSession.capacity,
    updatedAt: classSession.updatedAt,
    organizerDisplayName: classSession.organizerProfile?.displayName ?? null,
    // 第三批票 10：草稿老師的姓名管理員看不到（列表顯示與搜尋都不使用）。
    teacherDisplayName:
      classSession.teacherProfile.status === "draft" ? null : classSession.teacherProfile.displayName,
    organizationName: classSession.organization?.name ?? null,
    confirmedEnrollmentCount: classSession._count.enrollments,
    organizationId: classSession.organizationId,
    teacherProfileId: classSession.teacherProfileId,
  }));
}

// D7 修正版（codex round 2）：跟 Organizer own-scoped 用的 ClassSessionRosterEntry 不同，
// 這裡刻意帶 status——Admin 需要看到「這位 Member 是不是已經自己取消過了」這種歷史狀態，
// 才能正確判斷要不要／能不能介入，不是單純的報名名單。
// 第三批票 12：姓名與 email 分開帶，只在這個 admin 專用型別出現（requireAdmin() 之後），
// 不放進公開、老師、團主或學員共用的 DTO。
export type AdminClassSessionRosterEntry = {
  id: string;
  memberName: string | null;
  memberEmail: string | null;
  notes: string | null;
  status: EnrollmentStatus;
  // enrollment-re-enrollment 票 04：已取消的報名顯示取消原因；沒取消就是 null。
  cancelReason: string | null;
  // lightweight-payment-v0：管理員可看付款狀態與全部對帳備註（只限 requireAdmin() 之後的這個型別）。
  paymentStatus: EnrollmentPaymentStatus;
  transferNote: string | null;
  paymentNote: string | null;
  paymentRefundReason: string | null;
};

export type AdminClassSessionDetail = {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  // 第三批票 11：課程本身既有的欄位，補讀給管理員看（不夾帶其他使用者資料）。
  serviceTypes: string[];
  yogaStyles: string[];
  origin: ClassSessionOrigin;
  requiresApproval: boolean;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  isPublic: boolean;
  status: ClassSessionStatus;
  createdAt: Date;
  // teacher-initiated-open-classes：老師自建課程沒有 demandRequest／organizerProfile／
  // organization，三者皆改為 nullable；消費頁面需自行提供中性 fallback 文案。
  // 第三批票 10：id／status 只用來決定要不要顯示關聯連結（草稿需求不給連結），不是授權依據。
  demandRequest: { id: string; status: DemandRequestStatus; targetLevel: string | null } | null;
  // 管理員需要能分辨「是誰」，所以除了名稱還帶聯絡方式（帳號 email、團體聯絡窗口）。
  organizerProfile: { displayName: string; user: { email: string | null } } | null;
  teacherProfile: { id: string; status: TeacherProfileStatus; displayName: string | null; user: { email: string | null } };
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  } | null;
  roster: AdminClassSessionRosterEntry[];
  // enrollment-re-enrollment 票 03：占用名額（含 term_only 期班請假中保留的名額），與報名時的名額規則一致。
  occupiedSeatCount: number;
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
      serviceTypes: true,
      yogaStyles: true,
      origin: true,
      requiresApproval: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      isPublic: true,
      status: true,
      createdAt: true,
      demandRequest: { select: { id: true, status: true, targetLevel: true } },
      organizerProfile: {
        select: { displayName: true, user: { select: { email: true } } },
      },
      teacherProfile: {
        select: { id: true, status: true, displayName: true, user: { select: { email: true } } },
      },
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
      enrollments: {
        select: {
          id: true,
          notes: true,
          status: true,
          cancelledBy: true,
          seriesEnrollmentId: true,
          paymentStatus: true,
          transferNote: true,
          paymentNote: true,
          paymentRefundReason: true,
          seriesEnrollment: { select: { status: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!classSession) {
    return null;
  }

  const { enrollments, demandRequest, teacherProfile, ...rest } = classSession;
  const occupiedSeatCount = await prisma.enrollment.count({ where: { classSessionId, ...occupyingEnrollmentWhere } });

  // 第三批票 10：草稿是管理員看不到的資料。正常流程下課程不會連到草稿需求／草稿老師，但讀取層仍防守：
  // 草稿需求整筆不回傳（連程度都不露），草稿老師只留 id／status，不回傳姓名與 email。
  return {
    ...rest,
    demandRequest: demandRequest && demandRequest.status !== "draft" ? demandRequest : null,
    teacherProfile:
      teacherProfile.status === "draft"
        ? { ...teacherProfile, displayName: null, user: { email: null } }
        : teacherProfile,
    occupiedSeatCount,
    roster: enrollments.map((enrollment) => ({
      id: enrollment.id,
      memberName: enrollment.user.name?.trim() || null,
      memberEmail: enrollment.user.email,
      notes: enrollment.notes,
      status: enrollment.status,
      paymentStatus: enrollment.paymentStatus,
      transferNote: enrollment.transferNote,
      paymentNote: enrollment.paymentNote,
      paymentRefundReason: enrollment.paymentRefundReason,
      cancelReason: describeEnrollmentCancelReason({
        status: enrollment.status,
        cancelledBy: enrollment.cancelledBy,
        seriesEnrollmentId: enrollment.seriesEnrollmentId,
        seriesEnrollmentStatus: enrollment.seriesEnrollment?.status ?? null,
        classSessionStatus: classSession.status,
      }),
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
