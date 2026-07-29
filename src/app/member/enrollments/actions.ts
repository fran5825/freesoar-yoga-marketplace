"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelOwnEnrollment } from "@/domain/enrollment/service";
import { submitOwnReview } from "@/domain/review/service";

export async function cancelEnrollmentAction(formData: FormData): Promise<void> {
  const enrollmentId = readFormString(formData, "enrollmentId");

  const result = await cancelOwnEnrollment(enrollmentId);

  revalidatePath("/member/enrollments");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "報名已取消。");
}

export async function submitReviewAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const ratingValue = readFormString(formData, "rating");
  const commentValue = formData.get("comment");

  const result = await submitOwnReview(classSessionId, {
    rating: ratingValue.length > 0 ? Number(ratingValue) : null,
    comment: typeof commentValue === "string" ? commentValue : null,
  });

  revalidatePath("/member/enrollments");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "評價已送出，謝謝你的回饋。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/member/enrollments?result=${result}&message=${encodeURIComponent(message)}`);
}
