"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createOwnAvailabilityException,
  createOwnTeacherAvailability,
  deleteOwnAvailabilityException,
  deleteOwnTeacherAvailability,
} from "@/domain/teacher-availability/service";

export async function createTeacherAvailabilityAction(formData: FormData): Promise<void> {
  const dayOfWeekValue = readFormString(formData, "dayOfWeek");

  const result = await createOwnTeacherAvailability({
    dayOfWeek: dayOfWeekValue.length > 0 ? Number(dayOfWeekValue) : null,
    startTime: readFormString(formData, "startTime"),
    endTime: readFormString(formData, "endTime"),
    locationArea: readOptionalFormString(formData, "locationArea"),
  });

  revalidatePath("/teacher/availability");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已新增固定可授課時段。");
}

export async function deleteTeacherAvailabilityAction(formData: FormData): Promise<void> {
  const availabilityId = readFormString(formData, "availabilityId");

  const result = await deleteOwnTeacherAvailability(availabilityId);

  revalidatePath("/teacher/availability");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已刪除固定可授課時段。");
}

export async function createAvailabilityExceptionAction(formData: FormData): Promise<void> {
  const typeValue = readFormString(formData, "type");

  const result = await createOwnAvailabilityException({
    date: readFormString(formData, "date"),
    type: typeValue.length > 0 ? typeValue : null,
    startTime: readOptionalFormString(formData, "startTime"),
    endTime: readOptionalFormString(formData, "endTime"),
    reason: readOptionalFormString(formData, "reason"),
  });

  revalidatePath("/teacher/availability");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已新增日期例外。");
}

export async function deleteAvailabilityExceptionAction(formData: FormData): Promise<void> {
  const exceptionId = readFormString(formData, "exceptionId");

  const result = await deleteOwnAvailabilityException(exceptionId);

  revalidatePath("/teacher/availability");

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已刪除日期例外。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function readOptionalFormString(formData: FormData, name: string): string | null {
  const value = formData.get(name);

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/teacher/availability?result=${result}&message=${encodeURIComponent(message)}`);
}
