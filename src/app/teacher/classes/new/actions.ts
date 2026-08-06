"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createOwnClassSessionForTeacher } from "@/domain/class-session/service";

export async function createOwnClassSessionAction(formData: FormData): Promise<void> {
  const result = await createOwnClassSessionForTeacher({
    title: readFormString(formData, "title"),
    description: readFormString(formData, "description"),
    serviceType: readFormString(formData, "serviceType"),
    startAt: readFormString(formData, "startAt"),
    endAt: readFormString(formData, "endAt"),
    location: readFormString(formData, "location"),
    capacity: readFormNumber(formData, "capacity"),
    isPublic: formData.get("isPublic") === "yes",
    requiresApproval: formData.get("requiresApproval") === "yes",
  });

  if (!result.ok) {
    redirectWithFeedback("error", buildErrorMessage(result.message, result.validationErrors));
  }

  revalidatePath("/teacher/classes");
  redirect(
    `/teacher/classes?result=success&message=${encodeURIComponent("課程已建立。")}`,
  );
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function readFormNumber(formData: FormData, name: string): number | null {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
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

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/teacher/classes/new?result=${result}&message=${encodeURIComponent(message)}`);
}
