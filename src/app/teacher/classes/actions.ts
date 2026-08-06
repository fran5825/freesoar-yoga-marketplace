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

  revalidatePath("/teacher/classes");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已開放報名。");
}

export async function cancelOwnClassSessionAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await cancelOwnClassSessionForTeacher(classSessionId);

  revalidatePath("/teacher/classes");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "課程已取消。");
}

export async function completeOwnClassSessionAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await completeOwnClassSessionForTeacher(classSessionId);

  revalidatePath("/teacher/classes");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "課程已標記完成。");
}

// 第 8 節（Gate G2/G3）：requiresApproval=true 課程收到的 pending 報名，老師確認/拒絕。
// 這兩個動作對兩種來源（team_initiated／organizer_matched）的課程都有意義——審核權限是
// 「這位老師的課」，不是「這位老師自己開的課才能審核」，因此 UI 上不像取消/開放報名/標記
// 完成那樣限定只在 teacher_initiated 顯示，roster 上只要有 pending 報名就顯示這兩個按鈕。
export async function confirmPendingEnrollmentAction(formData: FormData): Promise<void> {
  const enrollmentId = readFormString(formData, "enrollmentId");

  const result = await confirmPendingEnrollmentForTeacher(enrollmentId);

  revalidatePath("/teacher/classes");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已確認這筆報名。");
}

export async function declinePendingEnrollmentAction(formData: FormData): Promise<void> {
  const enrollmentId = readFormString(formData, "enrollmentId");

  const result = await declinePendingEnrollmentForTeacher(enrollmentId);

  revalidatePath("/teacher/classes");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已拒絕這筆報名。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/teacher/classes?result=${result}&message=${encodeURIComponent(message)}`);
}
