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

// 開放報名失敗時給老師看的原因（單堂課頁的「開放報名」與建立時直接開放共用）。
export const openClassSessionForTeacherErrorMessages: Record<OpenClassSessionForTeacherErrorCode, string> = {
  class_session_not_found: "找不到這堂課程，或你沒有權限操作。",
  teacher_not_approved: "老師資格暫停期間不能開放報名。",
  class_session_already_started: "這堂課程已經開始，無法開放報名。",
  class_session_not_draft: "這堂課程目前狀態不允許開放報名。",
};

// teacher-first-run 票 02：開放成功後的回饋，單堂課頁的「開放報名」與建立時直接開放共用。
export const OPENED_FOR_ENROLLMENT_MESSAGE = "已開放報名。下一步：把報名連結傳給學員。";

export type OpenNewlyCreatedClassSessionResult =
  | { opened: true }
  | { opened: false; message: string };

// teacher-first-run 票 02：單堂建立後直接開放報名。判斷與寫入完全沿用上面的
// openClassSessionForEnrollmentForTeacher（own-scope、approved、草稿、尚未開始），狀態機不變。
// 呼叫時課程已經寫入，所以這裡的任何失敗（含例外）都只代表「還沒開放」：一律回傳原因、不往外丟，
// 讓呼叫端照樣導到這堂草稿的詳情頁，不會被當成「尚未建立」而讓老師重送、建出第二堂。
// hooks.beforeOpen 只給測試用：在建立與開放之間插入動作（例如暫停老師資格），驗證失敗路徑。
export async function openNewlyCreatedClassSessionForTeacher(
  teacherProfileId: string,
  classSessionId: string,
  hooks?: { beforeOpen?: () => Promise<void> },
): Promise<OpenNewlyCreatedClassSessionResult> {
  try {
    await hooks?.beforeOpen?.();

    const result = await openClassSessionForEnrollmentForTeacher(teacherProfileId, classSessionId);

    if (result.ok) {
      return { opened: true };
    }

    return { opened: false, message: createdButNotOpenedMessage(openClassSessionForTeacherErrorMessages[result.code]) };
  } catch {
    return {
      opened: false,
      message: createdButNotOpenedMessage("系統暫時沒有完成開放報名，請看下方的課程狀態，需要時再按一次「開放報名」。"),
    };
  }
}

function createdButNotOpenedMessage(reason: string): string {
  return `課程已建立，但還沒開放報名：${reason}`;
}
