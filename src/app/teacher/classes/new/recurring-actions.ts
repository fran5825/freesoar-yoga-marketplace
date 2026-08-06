"use server";

import { redirect } from "next/navigation";

import { createOwnRecurringClassSeriesForTeacher } from "@/domain/class-session/service";
import type { RecurringSeriesInput } from "@/domain/class-session/recurring-series-validation";

// teacher-initiated-open-classes Slice B：常規（每週固定星期）／固定期（明確日期清單）
// 課程系列建立，mode 由前端的兩個獨立表單各自帶入固定值。
export async function createOwnRecurringClassSeriesAction(formData: FormData): Promise<void> {
  const mode = readFormString(formData, "mode");

  const input: RecurringSeriesInput = {
    title: readFormString(formData, "title"),
    description: readFormString(formData, "description"),
    serviceType: readFormString(formData, "serviceType"),
    startTime: readFormString(formData, "startTime"),
    endTime: readFormString(formData, "endTime"),
    location: readFormString(formData, "location"),
    capacity: readFormNumber(formData, "capacity"),
    requiresApproval: formData.get("requiresApproval") === "yes",
    mode,
    dayOfWeek: mode === "weekly" ? readFormNumber(formData, "dayOfWeek") : undefined,
    generateCount: mode === "weekly" ? readFormNumber(formData, "generateCount") : undefined,
    dates:
      mode === "fixed_dates"
        ? readFormString(formData, "dates")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        : undefined,
  };

  const result = await createOwnRecurringClassSeriesForTeacher(input);

  if (!result.ok) {
    redirectWithFeedback(
      "error",
      buildErrorMessage(result.message, result.validationErrors),
    );
  }

  redirect(
    `/teacher/classes/series/${result.recurringClassSeriesId}?result=success&message=${encodeURIComponent(
      buildCreatedMessage(result.createdClassSessionIds.length, result.skipped),
    )}`,
  );
}

function buildCreatedMessage(
  createdCount: number,
  skipped: { date: string }[],
): string {
  if (skipped.length === 0) {
    return `課程系列已建立，共生成 ${createdCount} 場。`;
  }

  const skippedDates = skipped.map((occurrence) => occurrence.date).join("、");

  return `課程系列已建立，共生成 ${createdCount} 場；以下日期因時段衝突未生成：${skippedDates}。`;
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
