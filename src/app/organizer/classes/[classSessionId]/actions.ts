"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cancelOwnClassSession,
  openOwnClassSessionForEnrollment,
} from "@/domain/class-session/service";

export async function openForEnrollmentAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await openOwnClassSessionForEnrollment(classSessionId);

  revalidatePath(`/organizer/classes/${classSessionId}`);

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", result.message);
  }

  redirectWithFeedback(classSessionId, "success", "已開放報名。");
}

export async function cancelClassSessionAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await cancelOwnClassSession(classSessionId);

  revalidatePath(`/organizer/classes/${classSessionId}`);
  revalidatePath("/organizer/classes");
  revalidatePath("/teacher/classes");
  revalidatePath("/member/enrollments");

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", result.message);
  }

  redirectWithFeedback(classSessionId, "success", "課程已取消。");
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
    `/organizer/classes/${classSessionId}?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
