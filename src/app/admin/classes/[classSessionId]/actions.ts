"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelClassSessionForAdmin } from "@/domain/class-session/admin-service";
import { cancelEnrollmentForAdmin } from "@/domain/enrollment/admin-service";
import { adminDetailHref, adminFeedbackHref } from "../../_lib/list-context";

function revalidateClassSessionPaths(classSessionId: string): void {
  revalidatePath(`/admin/classes/${classSessionId}`);
  revalidatePath("/admin/classes");
  revalidatePath(`/organizer/classes/${classSessionId}`);
  revalidatePath("/organizer/classes");
  revalidatePath("/teacher/classes");
  revalidatePath("/member/enrollments");
}

export async function cancelClassSessionAdminAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  if (formData.get("confirmCancel") !== "yes") {
    redirectWithFeedback(classSessionId, "error", "請先勾選確認，才能取消這堂課程。", formData);
  }

  const result = await withTransientFailure(() => cancelClassSessionForAdmin(classSessionId));

  revalidateClassSessionPaths(classSessionId);

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", `課程沒有取消：${result.message}${failureNextStep}`, formData);
  }

  redirect(
    adminFeedbackHref("classes", formData.get("returnTo"), "success", "課程已取消，已報名學員的報名也一併取消。", classSessionId),
  );
}

export async function cancelEnrollmentAdminAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const enrollmentId = readFormString(formData, "enrollmentId");

  if (formData.get("confirmCancel") !== "yes") {
    redirectWithFeedback(classSessionId, "error", "請先勾選確認，才能取消這筆報名。", formData);
  }

  const result = await withTransientFailure(() => cancelEnrollmentForAdmin(enrollmentId));

  revalidateClassSessionPaths(classSessionId);

  // 學員識別只用來寫結果提示，取消資格仍由 service 依 enrollmentId 與當下狀態判斷。
  const memberLabel = readFormString(formData, "memberLabel").slice(0, 100) || "這位學員";

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", `「${memberLabel}」的報名沒有取消：${result.message}${failureNextStep}`, formData);
  }

  redirectWithFeedback(classSessionId, "success", `已取消「${memberLabel}」的報名，同一位學員不能再報名這堂課。`, formData);
}

// 第二批票 08：失敗會回到同一堂課的詳情並重新載入，畫面只會出現當下仍合法的取消操作。
const failureNextStep = "畫面已更新為目前狀態，請確認後再操作。";

// 取消核心遇到資料庫暫時錯誤時會直接拋出例外，而不是回傳 ok: false。
// 在 action 這層接住，轉成一般的可重試失敗，走同一個回饋路徑；service 與取消規則不變。
// 只包住 service 呼叫，redirect() 丟出的跳轉不會被這裡攔下。
async function withTransientFailure<T extends { ok: boolean }>(
  run: () => Promise<T>,
): Promise<T | { ok: false; message: string }> {
  try {
    return await run();
  } catch (error) {
    console.error("[admin cancel] unexpected failure", error);
    return { ok: false, message: "系統暫時無法完成，可以稍後再試一次。" };
  }
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(
  classSessionId: string,
  result: "success" | "error",
  message: string,
  formData: FormData,
): never {
  const url = new URL(adminDetailHref("classes", classSessionId, readFormString(formData, "returnTo")), "https://admin.invalid");
  url.searchParams.set("result", result);
  url.searchParams.set("message", message);
  redirect(`${url.pathname}?${url.searchParams}`);
}
