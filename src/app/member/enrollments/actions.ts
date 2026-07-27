"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelOwnEnrollment } from "@/domain/enrollment/service";

export async function cancelEnrollmentAction(formData: FormData): Promise<void> {
  const enrollmentId = readFormString(formData, "enrollmentId");

  const result = await cancelOwnEnrollment(enrollmentId);

  revalidatePath("/member/enrollments");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "報名已取消。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/member/enrollments?result=${result}&message=${encodeURIComponent(message)}`);
}
