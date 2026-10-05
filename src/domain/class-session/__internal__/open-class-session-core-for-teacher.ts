// 老師把自己開的草稿課程開放報名。從 service.ts 的 openOwnClassSessionForEnrollmentForTeacher
// 抽出：service 只負責由登入身分找出 teacherProfileId，判斷與寫入都在這裡，測試可以直接驗證。
//
// organizer-usability-redesign 票 09（spec §8／13.6）：老師端只能開放 origin = teacher_initiated
// 的課。團主媒合（organizer_matched）的草稿課由團主開放，團主直接開團（organizer_direct）一建立
// 就是開放報名；即使授課老師是同一人，也不能從老師端改狀態。條件寫在同一個 updateMany 與分類
// 查詢裡，非本人開的課一律回 class_session_not_found，不透露存在與否。

import { prisma } from "@/lib/prisma";

export type OpenClassSessionForTeacherErrorCode =
  | "class_session_not_found"
  | "class_session_not_draft"
  | "class_session_already_started"
  | "teacher_not_approved";

export type OpenClassSessionForTeacherResult =
  | { ok: true }
  | { ok: false; code: OpenClassSessionForTeacherErrorCode };

export async function openClassSessionForEnrollmentForTeacher(
  teacherProfileId: string,
  classSessionId: string,
): Promise<OpenClassSessionForTeacherResult> {
  // teacher-class-scheduling 票 04（推導規則 11）：老師須為 approved 才能開放報名。條件寫進同一個
  // updateMany，判斷與寫入一次完成，暫停中的老師無法開放。
  const updateResult = await prisma.classSession.updateMany({
    where: {
      id: classSessionId,
      teacherProfileId,
      origin: "teacher_initiated",
      status: "draft",
      startAt: { gt: new Date() },
      teacherProfile: { status: "approved" },
    },
    data: { status: "open_for_enrollment" },
  });

  if (updateResult.count > 0) {
    return { ok: true };
  }

  const classSession = await prisma.classSession.findFirst({
    where: { id: classSessionId, teacherProfileId, origin: "teacher_initiated" },
    select: { status: true, startAt: true, teacherProfile: { select: { status: true } } },
  });

  if (!classSession) {
    return { ok: false, code: "class_session_not_found" };
  }

  if (classSession.teacherProfile.status !== "approved") {
    return { ok: false, code: "teacher_not_approved" };
  }

  if (classSession.startAt.getTime() <= Date.now()) {
    return { ok: false, code: "class_session_already_started" };
  }

  return { ok: false, code: "class_session_not_draft" };
}
