"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createOwnEnrollment } from "@/domain/enrollment/service";

export async function enrollAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await createOwnEnrollment(classSessionId, {
    notes: readFormString(formData, "notes"),
    basicConsent: formData.get("basicConsent") === "yes",
  });

  revalidatePath(`/classes/${classSessionId}`);

  if (!result.ok) {
    redirectWithFeedback(
      classSessionId,
      "error",
      buildErrorMessage(result.message, result.validationErrors),
    );
  }

  revalidatePath("/member/enrollments");
  redirectWithFeedback(
    classSessionId,
    "success",
    result.status === "pending" ? "報名已送出，等待老師確認。" : "報名成功。",
  );
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function buildErrorMessage(
  message: string,
  validationErrors?: { message: string }[],
): string {
  if (!validationErrors || validationErrors.length === 0) {
    return message;
  }

  return [message, ...validationErrors.map((error) => error.message)].join(" ");
}

function redirectWithFeedback(
  classSessionId: string,
  result: "success" | "error",
  message: string,
): never {
  redirect(
    `/classes/${classSessionId}?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
