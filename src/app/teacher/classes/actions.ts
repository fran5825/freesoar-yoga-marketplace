"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cancelOwnClassSessionForTeacher,
  completeOwnClassSessionForTeacher,
  openOwnClassSessionForEnrollmentForTeacher,
} from "@/domain/class-session/service";
import {
  confirmPendingEnrollmentForTeacher,
  declinePendingEnrollmentForTeacher,
} from "@/domain/enrollment/service";

// teacher-initiated-open-classes Slice A：這三個動作只對老師自建（teacher_initiated）的課程
// 有意義——團主媒合的課程仍由 Organizer own-scoped 操作，這裡的 service 層函式本身也只會
// 比對 teacherProfileId，不會誤動到團主媒合的課程（因為那些課程的 teacherProfileId 雖然是
// 這位老師，但 own-scope 檢查通過不代表允許操作；此處刻意只在 UI 上對 teacher_initiated
// 課程顯示這些按鈕，避免混淆兩種來源的操作邊界，即使底層函式本身已經有 own-scope 保護）。

export async function openOwnClassSessionForEnrollmentAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await openOwnClassSessionForEnrollmentForTeacher(classSessionId);

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "已開放報名。");
}

export async function cancelOwnClassSessionAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await cancelOwnClassSessionForTeacher(classSessionId);

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "課程已取消。");
}

export async function completeOwnClassSessionAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await completeOwnClassSessionForTeacher(classSessionId);

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "課程已標記完成。");
}

// 第 8 節（Gate G2/G3）：requiresApproval=true 課程收到的 pending 報名，老師確認/拒絕。
// 這兩個動作對兩種來源（team_initiated／organizer_matched）的課程都有意義——審核權限是
// 「這位老師的課」，不是「這位老師自己開的課才能審核」，因此 UI 上不像取消/開放報名/標記
// 完成那樣限定只在 teacher_initiated 顯示，roster 上只要有 pending 報名就顯示這兩個按鈕。
export async function confirmPendingEnrollmentAction(formData: FormData): Promise<void> {
  const enrollmentId = readFormString(formData, "enrollmentId");

  const result = await confirmPendingEnrollmentForTeacher(enrollmentId);

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "已確認這筆報名。");
}

export async function declinePendingEnrollmentAction(formData: FormData): Promise<void> {
  const enrollmentId = readFormString(formData, "enrollmentId");

  const result = await declinePendingEnrollmentForTeacher(enrollmentId);

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "已拒絕這筆報名。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

// teacher-usability 第 06 票：操作都在課程詳情頁上，做完回到同一堂課的詳情頁。
// 表單會帶 classSessionId；只接受 id 形式的字串（英數、底線、連字號）組成站內路徑，
// 不接受任何外部網址。沒有帶或格式不符時退回課程列表。
function getReturnPath(formData: FormData): string {
  const classSessionId = readFormString(formData, "classSessionId");

  return /^[A-Za-z0-9_-]{1,64}$/.test(classSessionId)
    ? `/teacher/classes/${classSessionId}`
    : "/teacher/classes";
}

function revalidateTeacherClassPages(formData: FormData) {
  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/dashboard");

  const returnPath = getReturnPath(formData);

  if (returnPath !== "/teacher/classes") {
    revalidatePath(returnPath);
  }
}

function redirectWithFeedback(
  formData: FormData,
  result: "success" | "error",
  message: string,
): never {
  redirect(
    `${getReturnPath(formData)}?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
