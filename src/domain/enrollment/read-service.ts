import type {
  ClassSessionOrigin,
  ClassSessionStatus,
  EnrollmentCancelledBy,
  EnrollmentStatus,
  SeriesEnrollmentStatus,
  TermEnrollmentMode,
} from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getClassAvailability } from "@/domain/class-session/availability";

import { getReEnrollState, type ReEnrollState } from "./re-enroll-eligibility";
import { occupyingEnrollmentWhere } from "./seat-occupancy";
import { getTermRowControl, type TermRowControl } from "./term-row-controls";

export type OwnEnrollment = {
  id: string;
  status: EnrollmentStatus;
  notes: string | null;
  createdAt: Date;
  cancelledBy: EnrollmentCancelledBy | null;
  // inline-member-actions 票 01：整期的這一堂要顯示請假、取消請假還是說明文字（service layer 算好）。
  rowControl: TermRowControl;
  termEnrollmentMode: TermEnrollmentMode | null;
  // teacher-class-scheduling 票 12：屬於整期報名時，「我的報名」把即將上課的場次合併成一張期班卡片。
  seriesEnrollment: {
    id: string;
    status: SeriesEnrollmentStatus;
    recurringClassSeries: { id: string; title: string };
  } | null;
  classSession: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    location: string;
    status: ClassSessionStatus;
    reviews: { id: string; rating: number; comment: string | null }[];
  };
};

// Member own-scoped，供 /member/enrollments 顯示。
// class-session-review-plan D7 修正版：nested `reviews`（用 reviewerUserId 過濾成只有
// 自己留的那一筆）與 classSession.status 一起隨列表帶出，避免對每一筆 completed 課程
// 各自呼叫一次額外查詢判斷「是否已經評價過」（N+1，codex round 1 指出的問題）。
export async function listOwnEnrollmentsForMember(): Promise<OwnEnrollment[]> {
  const currentUser = await requireUser();

  const rows = await prisma.enrollment.findMany({
    where: { userId: currentUser.id },
    select: {
      id: true,
      status: true,
      notes: true,
      createdAt: true,
      cancelledBy: true,
      seriesEnrollmentId: true,
      seriesEnrollment: {
        select: { id: true, status: true, recurringClassSeries: { select: { id: true, title: true } } },
      },
      classSession: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          location: true,
          status: true,
          capacity: true,
          recurringClassSeries: { select: { kind: true, termEnrollmentMode: true } },
          teacherProfile: { select: { status: true } },
          _count: { select: { enrollments: { where: occupyingEnrollmentWhere } } },
          reviews: {
            where: { reviewerUserId: currentUser.id },
            select: { id: true, rating: true, comment: true },
          },
        },
      },
    },
    orderBy: { classSession: { startAt: "asc" } },
  });

  return rows.map(({ seriesEnrollmentId, classSession, ...row }) => {
    const { capacity, recurringClassSeries, teacherProfile, _count, ...sessionFields } = classSession;
    const termEnrollmentMode = recurringClassSeries?.kind === "term" ? recurringClassSeries.termEnrollmentMode : null;

    return {
      ...row,
      termEnrollmentMode,
      rowControl: getTermRowControl({
        status: row.status,
        cancelledBy: row.cancelledBy,
        seriesEnrollmentId,
        seriesEnrollmentStatus: row.seriesEnrollment?.status ?? null,
        termEnrollmentMode,
        classStatus: sessionFields.status,
        startAt: sessionFields.startAt,
        capacity,
        occupiedCount: _count.enrollments,
        teacherApproved: teacherProfile.status === "approved",
      }),
      classSession: sessionFields,
    };
  });
}

export type MemberFacingClassSession = {
  id: string;
  title: string;
  description: string | null;
  // member-flow 票 03：適合對象、準備事項（沒填是 null；票 14 起畫面不顯示該段）。
  suitableFor: string | null;
  preparationNotes: string | null;
  serviceType: string | null;
  serviceTypes: string[];
  yogaStyles: string[];
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  // pending + confirmed（都佔名額），供顯示剩餘名額用。
  activeEnrollmentCount: number;
  origin: ClassSessionOrigin;
  status: string;
  // teacher-initiated-open-classes：老師自建課程沒有 organization，改為 nullable；
  // 消費頁面需自行提供中性 fallback 文案（不假設一律有團體名稱）。
  organization: { name: string } | null;
  teacherProfile: { displayName: string | null };
  // teacher-class-scheduling 票 09：屬於整期報名時有值（取消這一堂就是「請假」）。
  // enrollment-re-enrollment 票 02：已取消的報名能不能重新報名，由 service layer 一次算好（spec 4.6）。
  // inline-member-actions 票 03：rowControl＝整期的這一堂要顯示請假、取消請假還是說明（不屬於整期時是 none）。
  ownEnrollment: { id: string; status: EnrollmentStatus; seriesEnrollmentId: string | null; reEnroll: ReEnrollState; rowControl: TermRowControl } | null;
  termEnrollmentMode: TermEnrollmentMode | null;
  requiresApproval: boolean;
  canAcceptNewEnrollments: boolean;
};

// D4：只回傳 status === "open_for_enrollment" 的 class session，draft 一律回傳 null
// （not-found 語意）——draft 代表 Organizer 根本還沒開放、也還沒產生過任何分享連結，
// 不應該讓任何人透過猜測 classSessionId 就看到未開放課程的完整內容。
// 修正（class-session-completion D7）：也允許 completed，否則過期課程一旦真的被標記
// 完成，既有連結會第一次因此變成 404（過期但還沒標記完成時仍是 open_for_enrollment，
// 連結本來就看得到）——這是本輪造成的新行為劣化，不是延續既有先例，見該輪 plan。
// completed 一定代表 endAt 已過（因此 startAt 也已過），下方既有的 hasClassSessionStarted
// 判斷會自然把它導向既有的「目前無法報名」分支，不需要新增第四種分支。
export async function getClassSessionForMember(
  classSessionId: string,
): Promise<MemberFacingClassSession | null> {
  const currentUser = await requireUser();

  const classSession = await prisma.classSession.findFirst({
    where: { id: classSessionId, status: { in: ["open_for_enrollment", "completed"] } },
    select: {
      id: true,
      title: true,
      description: true,
      suitableFor: true,
      preparationNotes: true,
      serviceType: true,
      serviceTypes: true,
      yogaStyles: true,
      startAt: true,
      endAt: true,
      location: true,
      capacity: true,
      requiresApproval: true,
      status: true,
      origin: true,
      organization: { select: { name: true } },
      teacherProfile: { select: { displayName: true, status: true } },
      recurringClassSeries: { select: { kind: true, termEnrollmentMode: true } },
      _count: {
        select: {
          enrollments: { where: occupyingEnrollmentWhere },
        },
      },
    },
  });

  if (!classSession) {
    return null;
  }

  const { _count, teacherProfile, recurringClassSeries, ...classSessionFields } = classSession;
  const ownRow = await prisma.enrollment.findUnique({
    where: { classSessionId_userId: { classSessionId, userId: currentUser.id } },
    select: { id: true, status: true, seriesEnrollmentId: true, cancelledBy: true, seriesEnrollment: { select: { status: true } } },
  });
  const termEnrollmentMode = recurringClassSeries?.kind === "term" ? recurringClassSeries.termEnrollmentMode : null;
  const ownEnrollment = ownRow
    ? {
        id: ownRow.id,
        status: ownRow.status,
        seriesEnrollmentId: ownRow.seriesEnrollmentId,
        rowControl: getTermRowControl({
          status: ownRow.status,
          cancelledBy: ownRow.cancelledBy,
          seriesEnrollmentId: ownRow.seriesEnrollmentId,
          seriesEnrollmentStatus: ownRow.seriesEnrollment?.status ?? null,
          termEnrollmentMode,
          classStatus: classSession.status,
          startAt: classSession.startAt,
          capacity: classSession.capacity,
          occupiedCount: _count.enrollments,
          teacherApproved: teacherProfile.status === "approved",
        }),
        reEnroll: getReEnrollState({
          status: ownRow.status,
          cancelledBy: ownRow.cancelledBy,
          seriesEnrollmentId: ownRow.seriesEnrollmentId,
          seriesEnrollmentStatus: ownRow.seriesEnrollment?.status ?? null,
          termEnrollmentMode,
          classStatus: classSession.status,
          startAt: classSession.startAt,
          capacity: classSession.capacity,
          occupiedCount: _count.enrollments,
          teacherApproved: teacherProfile.status === "approved",
        }),
      }
    : null;

  return {
    ...classSessionFields,
    teacherProfile: { displayName: teacherProfile.displayName },
    canAcceptNewEnrollments: teacherProfile.status === "approved" && classSession.status === "open_for_enrollment" && getClassAvailability({ capacity: classSession.capacity, activeEnrollmentCount: _count.enrollments, startAt: classSession.startAt }).state === "open",
    activeEnrollmentCount: _count.enrollments,
    // 整期的請假確認文字依期班報名方式不同（term_only／term_and_single）。
    termEnrollmentMode,
    ownEnrollment,
  };
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
