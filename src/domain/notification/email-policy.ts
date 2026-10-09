import type { NotificationType } from "@prisma/client";

import type { NotificationRecipientRole } from "./types";

// transactional-email M1（產品主人 2026-10-09 確認照 plan 建議）：每種通知要對哪些收件角色寄 email。
// 這張表是唯一的依據，各觸發點不自行決定；空陣列＝只發站內通知。
// 表的內容對應目前實際接線的「類型 × 角色」：已接線的事件對收件人都有行動或結果意義，所以都寄；
// review_submitted 寄給授課老師（counterpart）；class_reminder_basic 尚未接線（需排程，另案）。
// 用 Record<NotificationType, …>：schema 新增通知類型而這裡沒補時，TypeScript 會直接報錯。
export const EMAIL_POLICY: Readonly<Record<NotificationType, readonly NotificationRecipientRole[]>> = {
  teacher_application_submitted: ["self", "admin"],
  teacher_application_approved: ["self"],
  teacher_application_rejected: ["self"],
  teacher_profile_suspended: ["self"],
  teacher_profile_restored: ["self"],
  demand_request_submitted: ["self", "admin"],
  demand_request_published: ["self"],
  demand_request_rejected: ["self"],
  demand_request_cancelled: ["self", "affected_responder"],
  demand_response_submitted: ["counterpart", "admin"],
  demand_response_selected: ["self", "counterpart"],
  class_session_created: ["self", "counterpart"],
  class_session_changed: ["affected_member"],
  class_session_cancelled: ["self", "counterpart", "affected_member"],
  class_session_completed: ["affected_member"],
  enrollment_confirmed: ["self"],
  enrollment_pending_review: ["self", "counterpart"],
  enrollment_cancelled: ["self"],
  class_reminder_basic: [],
  review_submitted: ["counterpart"],
  class_proposal_invited: ["counterpart"],
  class_proposal_confirmed: ["counterpart"],
  class_proposal_declined: ["counterpart"],
  class_proposal_withdrawn: ["counterpart"],
  class_proposal_revised: ["counterpart"],
};

export function shouldSendEmail(type: NotificationType, role: NotificationRecipientRole): boolean {
  return EMAIL_POLICY[type].includes(role);
}
