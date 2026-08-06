"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cancelRecurringClassSeriesForTeacher,
  generateMoreOccurrencesForTeacher,
} from "@/domain/class-session/service";

export async function generateMoreOccurrencesAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");
  const count = readFormNumber(formData, "count") ?? 0;

  const result = await generateMoreOccurrencesForTeacher(recurringClassSeriesId, count);

  revalidatePath(`/teacher/classes/series/${recurringClassSeriesId}`);

  if (!result.ok) {
    redirectWithFeedback(recurringClassSeriesId, "error", result.message);
  }

  const message =
    result.skipped.length === 0
      ? `已生成 ${result.createdClassSessionIds.length} 場。`
      : `已生成 ${result.createdClassSessionIds.length} 場；以下日期因時段衝突未生成：${result.skipped
          .map((occurrence) => occurrence.date)
          .join("、")}。`;

  redirectWithFeedback(recurringClassSeriesId, "success", message);
}

export async function cancelRecurringClassSeriesAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");

  const result = await cancelRecurringClassSeriesForTeacher(recurringClassSeriesId);

  revalidatePath(`/teacher/classes/series/${recurringClassSeriesId}`);
  revalidatePath("/teacher/classes");

  if (!result.ok) {
    redirectWithFeedback(recurringClassSeriesId, "error", result.message);
  }

  redirectWithFeedback(
    recurringClassSeriesId,
    "success",
    `已取消 ${result.cancelledCount} 場尚未開始的課程。`,
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

function redirectWithFeedback(
  recurringClassSeriesId: string,
  result: "success" | "error",
  message: string,
): never {
  redirect(
    `/teacher/classes/series/${recurringClassSeriesId}?result=${result}&message=${encodeURIComponent(message)}`,
  );
}
