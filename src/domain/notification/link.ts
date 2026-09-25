import type { NotificationType } from "@prisma/client";

// organizer-usability 票 11（方案 B）：通知沒有記錄「是哪一筆需求／課程」，也沒有記錄收件人是
// 哪個角色，所以這裡只依「通知類型＋收件人目前擁有的身分」決定要連到哪一個列表頁，
// 不連到單筆詳情。同一種通知可能給不同角色（例如 enrollment_pending_review 給學員與老師），
// 優先順序在各 case 內註明；找不到合適身分就不顯示連結。
export type NotificationRecipientIdentity = {
  isOrganizer: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
};

export type NotificationLink = { href: string; label: string };

export function getNotificationLink(
  type: NotificationType,
  identity: NotificationRecipientIdentity,
): NotificationLink | null {
  const { isOrganizer, isTeacher, isAdmin } = identity;

  switch (type) {
    case "teacher_application_submitted":
      // 申請人本人 → 老師資料；管理員收到的是「有人送審」→ 審核頁。
      if (isTeacher) return { href: "/teacher/profile", label: "前往老師資料" };
      if (isAdmin) return { href: "/admin/teachers", label: "前往老師審核" };
      return null;
    case "teacher_application_approved":
    case "teacher_application_rejected":
    case "teacher_profile_suspended":
    case "teacher_profile_restored":
      return isTeacher
        ? { href: "/teacher/profile", label: "前往老師資料" }
        : null;
    case "demand_request_submitted":
      if (isOrganizer) return { href: "/organizer/demands", label: "前往我的需求" };
      if (isAdmin) return { href: "/admin/demands", label: "前往需求審核" };
      return null;
    case "demand_request_published":
    case "demand_request_rejected":
      return isOrganizer
        ? { href: "/organizer/demands", label: "前往我的需求" }
        : null;
    case "demand_request_cancelled":
      // 團主本人取消 → 我的需求；因連帶取消而受影響的老師 → 需求池。
      if (isOrganizer) return { href: "/organizer/demands", label: "前往我的需求" };
      if (isTeacher) return { href: "/teacher/demands", label: "前往需求列表" };
      return null;
    case "demand_response_submitted":
      if (isOrganizer) return { href: "/organizer/demands", label: "前往我的需求" };
      if (isAdmin) return { href: "/admin/demands", label: "前往需求審核" };
      return null;
    case "demand_response_selected":
      if (isTeacher) return { href: "/teacher/demands", label: "前往需求列表" };
      if (isOrganizer) return { href: "/organizer/demands", label: "前往我的需求" };
      return null;
    case "class_session_created":
    case "class_session_changed":
    case "class_session_cancelled":
      if (isOrganizer) return { href: "/organizer/classes", label: "前往我的課程" };
      if (isTeacher) return { href: "/teacher/classes", label: "前往我的課程" };
      return { href: "/member/enrollments", label: "前往我的報名" };
    case "class_session_completed":
    case "enrollment_confirmed":
    case "enrollment_cancelled":
    case "class_reminder_basic":
      return { href: "/member/enrollments", label: "前往我的報名" };
    case "enrollment_pending_review":
      // 學員本人 → 我的報名；課程的老師收到的是「有人報名待審核」。
      if (isTeacher) return { href: "/teacher/classes", label: "前往我的課程" };
      return { href: "/member/enrollments", label: "前往我的報名" };
    case "review_submitted":
      return isTeacher
        ? { href: "/teacher/classes", label: "前往我的課程" }
        : null;
  }
}
