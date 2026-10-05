"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelClassSessionForAdmin } from "@/domain/class-session/admin-service";
import { cancelEnrollmentForAdmin } from "@/domain/enrollment/admin-service";
import { adminClassRosterHref, adminFeedbackHref, normalizeAdminRosterQuery } from "../../_lib/list-context";

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

  // 取消資格仍由 service 依 enrollmentId 與當下狀態判斷。
  // 第三批票 12：結果提示會進網址，所以這裡不帶任何學員姓名或 email，只帶通用文字與格式合法的
  // enrollment id（item）；頁面再用 item 對照自己讀到的名單，把學員名稱補進提示。
  const item = /^[A-Za-z0-9_-]{1,64}$/.test(enrollmentId) ? enrollmentId : undefined;

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", `這筆報名沒有取消：${result.message}${failureNextStep}`, formData, item);
  }

  redirectWithFeedback(classSessionId, "success", "已取消這筆報名，同一位學員不能再報名這堂課。", formData, item);
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
  item?: string,
): never {
  // 第三批票 12：回到同一堂課時保留名單的搜尋與分類（rq／rstatus）與原本的 returnTo。
  const url = new URL(
    adminClassRosterHref(classSessionId, readFormString(formData, "returnTo"), {
      rq: readFormString(formData, "rq"),
      rstatus: normalizeAdminRosterQuery({ rstatus: formData.get("rstatus") }).rstatus,
    }),
    "https://admin.invalid",
  );
  url.searchParams.set("result", result);
  url.searchParams.set("message", message);
  if (item) url.searchParams.set("item", item);
  redirect(`${url.pathname}?${url.searchParams}`);
}
