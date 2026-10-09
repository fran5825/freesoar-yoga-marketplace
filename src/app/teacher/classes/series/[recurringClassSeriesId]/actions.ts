"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cancelRecurringClassSeriesForTeacher,
  cancelSeriesFromOccurrenceForTeacher,
  generateMoreOccurrencesForTeacher,
  openAllDraftOccurrencesForTeacher,
} from "@/domain/class-session/service";
import { decideSeriesEnrollmentAsTeacher } from "@/domain/enrollment/term-service";

export async function generateMoreOccurrencesAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");
  const count = readFormNumber(formData, "count") ?? 0;

  const openForEnrollment = formData.get("openForEnrollment") === "yes";

  const result = await generateMoreOccurrencesForTeacher(recurringClassSeriesId, count, {
    openForEnrollment,
  });

  revalidatePath(`/teacher/classes/series/${recurringClassSeriesId}`);

  if (!result.ok) {
    redirectWithFeedback(recurringClassSeriesId, "error", result.message);
  }

  const createdText = openForEnrollment
    ? `已生成 ${result.createdClassSessionIds.length} 場，並已開放報名`
    : `已生成 ${result.createdClassSessionIds.length} 場草稿`;
  const message =
    result.skipped.length === 0
      ? `${createdText}。`
      : `${createdText}；以下日期因時段衝突未生成：${result.skipped
          .map((occurrence) => occurrence.date)
          .join("、")}。`;

  redirectWithFeedback(recurringClassSeriesId, "success", message);
}

// teacher-class-scheduling 票 01：系列頁「全部開放報名」。
export async function openAllDraftOccurrencesAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");

  const result = await openAllDraftOccurrencesForTeacher(recurringClassSeriesId);

  revalidatePath(`/teacher/classes/series/${recurringClassSeriesId}`);
  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/dashboard");

  if (!result.ok) {
    redirectWithFeedback(recurringClassSeriesId, "error", result.message);
  }

  redirectWithFeedback(
    recurringClassSeriesId,
    "success",
    result.openedCount > 0
      ? `已開放 ${result.openedCount} 場報名，可以複製每一場的報名連結傳給學員。`
      : "沒有需要開放的草稿場次。",
  );
}

// teacher-class-scheduling 票 03：從這場以後全部取消。系列頁與單堂詳情頁都用這個 action，
// 完成後回到系列頁（這一場已取消，留在詳情頁沒有下一步可做）。
export async function cancelSeriesFromOccurrenceAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");
  const fromClassSessionId = readFormString(formData, "fromClassSessionId");

  const result = await cancelSeriesFromOccurrenceForTeacher(recurringClassSeriesId, fromClassSessionId);

  revalidatePath(`/teacher/classes/series/${recurringClassSeriesId}`);
  revalidatePath(`/teacher/classes/${fromClassSessionId}`);
  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/dashboard");

  if (!result.ok) {
    redirectWithFeedback(recurringClassSeriesId, "error", result.message);
  }

  redirectWithFeedback(
    recurringClassSeriesId,
    "success",
    result.cancelledCount > 0
      ? `已取消這一場之後共 ${result.cancelledCount} 場尚未開始的課程，之前的場次照常。`
      : "沒有需要取消的場次。",
  );
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

// teacher-class-scheduling 票 10：整期報名確認／婉拒一次（規則與 own-scope 在 decideSeriesEnrollmentAsTeacher）。
export async function decideTermEnrollmentAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");
  const decision = readFormString(formData, "decision") === "decline" ? "decline" : "confirm";
  const result = await decideSeriesEnrollmentAsTeacher(readFormString(formData, "seriesEnrollmentId"), decision);

  revalidatePath(`/teacher/classes/series/${recurringClassSeriesId}`);
  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/dashboard");

  redirectWithFeedback(recurringClassSeriesId, result.ok ? "success" : "error", result.message);
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
