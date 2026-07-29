"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelClassSessionForAdmin } from "@/domain/class-session/admin-service";
import { cancelEnrollmentForAdmin } from "@/domain/enrollment/admin-service";

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
    redirectWithFeedback(classSessionId, "error", "請先勾選確認，才能取消這堂課程。");
  }

  const result = await cancelClassSessionForAdmin(classSessionId);

  revalidateClassSessionPaths(classSessionId);

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", result.message);
  }

  redirectWithFeedback(classSessionId, "success", "課程已取消。");
}

export async function cancelEnrollmentAdminAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const enrollmentId = readFormString(formData, "enrollmentId");

  if (formData.get("confirmCancel") !== "yes") {
    redirectWithFeedback(classSessionId, "error", "請先勾選確認，才能取消這筆報名。");
  }

  const result = await cancelEnrollmentForAdmin(enrollmentId);

  revalidateClassSessionPaths(classSessionId);

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", result.message);
  }

  redirectWithFeedback(classSessionId, "success", "報名已取消。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(
  classSessionId: string,
  result: "success" | "error",
  message: string,
): never {
  redirect(
    `/admin/classes/${classSessionId}?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
