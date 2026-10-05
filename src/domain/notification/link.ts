import type { NotificationTargetType, NotificationType } from "@prisma/client";

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

// organizer-usability-redesign 票 12（spec 13.7）：有 target 的通知直達單筆。網址只從白名單
// targetType 推導（不存任意網址）；點進去的頁面照原本規則檢查權限，越權或已失效就 not-found。
const targetLinks: Record<NotificationTargetType, (id: string) => NotificationLink> = {
  organizer_class_proposal: (id) => ({ href: `/organizer/class-proposals/${encodeURIComponent(id)}`, label: "查看這份合作邀請" }),
  teacher_class_proposal: (id) => ({ href: `/teacher/class-proposals/${encodeURIComponent(id)}`, label: "查看這份合作邀請" }),
  organizer_class_session: (id) => ({ href: `/organizer/classes/${encodeURIComponent(id)}`, label: "查看這堂課" }),
  teacher_class_session: (id) => ({ href: `/teacher/classes/${encodeURIComponent(id)}`, label: "查看這堂課" }),
};

export function getNotificationLink(
  type: NotificationType,
  identity: NotificationRecipientIdentity,
  target?: { targetType: NotificationTargetType | null; targetId: string | null },
): NotificationLink | null {
  if (target?.targetType && target.targetId) {
    return targetLinks[target.targetType](target.targetId);
  }

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
    // 票 12：合作邀請通知都會帶 target；沒有 target 時（理論上不會發生）退回列表頁。
    case "class_proposal_invited":
    case "class_proposal_revised":
    case "class_proposal_withdrawn":
      if (isTeacher) return { href: "/teacher/dashboard", label: "前往老師總覽" };
      return null;
    case "class_proposal_confirmed":
    case "class_proposal_declined":
      if (isOrganizer) return { href: "/organizer/classes", label: "前往我的課程" };
      return null;
  }
}
