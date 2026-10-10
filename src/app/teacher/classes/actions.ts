"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cancelOwnClassSessionForTeacher,
  completeOwnClassSessionForTeacher,
  openOwnClassSessionForEnrollmentForTeacher,
} from "@/domain/class-session/service";
import {
  markEnrollmentPaidForTeacher,
  markEnrollmentRefundedForTeacher,
  markSeriesEnrollmentPaidForTeacher,
  markSeriesEnrollmentRefundedForTeacher,
} from "@/domain/enrollment/payment-service";
import {
  confirmPendingEnrollmentForTeacher,
  declinePendingEnrollmentForTeacher,
} from "@/domain/enrollment/service";

import {
  parseListStatusFilter,
  parseListTab,
  returnContextParams,
  type TeacherClassReturnContext,
} from "./_lib/return-context";

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

  redirectWithFeedback(formData, "success", "已婉拒這筆報名。");
}

// lightweight-payment-v0（付款計畫 P3）：老師手動標記已收款／已退款，金錢不經過飛索。
// 單堂在課程詳情頁操作；整期學員一次標記整期，在期班頁操作（帶 returnSeriesId 回到期班頁）。
export async function markEnrollmentPaidAction(formData: FormData): Promise<void> {
  const result = await markEnrollmentPaidForTeacher(
    readFormString(formData, "enrollmentId"),
    readFormString(formData, "note"),
  );

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "已標記為已收款。");
}

export async function markEnrollmentRefundedAction(formData: FormData): Promise<void> {
  const result = await markEnrollmentRefundedForTeacher(
    readFormString(formData, "enrollmentId"),
    readFormString(formData, "note"),
  );

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "已標記為已退款。");
}

export async function markSeriesEnrollmentPaidAction(formData: FormData): Promise<void> {
  const result = await markSeriesEnrollmentPaidForTeacher(
    readFormString(formData, "seriesEnrollmentId"),
    readFormString(formData, "note"),
  );

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "已將整期標記為已收款。");
}

export async function markSeriesEnrollmentRefundedAction(formData: FormData): Promise<void> {
  const result = await markSeriesEnrollmentRefundedForTeacher(
    readFormString(formData, "seriesEnrollmentId"),
    readFormString(formData, "note"),
  );

  revalidateTeacherClassPages(formData);

  if (!result.ok) {
    redirectWithFeedback(formData, "error", result.message);
  }

  redirectWithFeedback(formData, "success", "已將整期標記為已退款。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

// teacher-usability 第 06 票：操作都在課程詳情頁上，做完回到同一堂課的詳情頁。
// 表單會帶 classSessionId；只接受 id 形式的字串（英數、底線、連字號）組成站內路徑，
// 不接受任何外部網址。沒有帶或格式不符時退回課程列表。
function getReturnPath(formData: FormData): string {
  // 整期付款在期班頁操作，做完回到期班頁（只接受 id 形式的字串）。
  const returnSeriesId = readFormString(formData, "returnSeriesId");

  if (/^[A-Za-z0-9_-]{1,64}$/.test(returnSeriesId)) {
    return `/teacher/classes/series/${returnSeriesId}`;
  }

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

// 票 04：詳情頁的返回上下文（從哪個列表分頁／系列進來）跟著操作表單送來，做完帶回同一堂課。
// 這裡只收白名單值（分頁、cancelled、id 格式的系列）；系列是否真的屬於這堂課由詳情頁再檢查。
function readReturnContext(formData: FormData): TeacherClassReturnContext | null {
  const from = readFormString(formData, "from");

  if (from === "series") {
    const seriesId = readFormString(formData, "series");

    return /^[A-Za-z0-9_-]{1,64}$/.test(seriesId) ? { kind: "series", seriesId } : null;
  }

  if (from === "list") {
    const tab = parseListTab(readFormString(formData, "tab"));

    return { kind: "list", tab, status: parseListStatusFilter(tab, readFormString(formData, "status")) };
  }

  return null;
}

function redirectWithFeedback(
  formData: FormData,
  result: "success" | "error",
  message: string,
): never {
  const query = new URLSearchParams([
    ["result", result],
    ["message", message],
    ...returnContextParams(readReturnContext(formData)),
  ]);

  redirect(`${getReturnPath(formData)}?${query.toString()}`);
}
