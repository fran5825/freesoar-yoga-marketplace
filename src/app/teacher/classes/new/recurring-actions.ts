"use server";

import { redirect } from "next/navigation";

import { createOwnRecurringClassSeriesForTeacher } from "@/domain/class-session/service";
import type { RecurringSeriesInput } from "@/domain/class-session/recurring-series-validation";

import { buildCreateClassFieldErrors, type CreateClassFormState } from "./_lib/form-state";
import { readServiceTypesFromForm, readYogaStylesFromForm } from "./read-yoga-styles";

// teacher-initiated-open-classes Slice B：常規（每週固定星期）／固定期（明確日期清單）
// 課程系列建立，mode 由前端的兩個獨立表單各自帶入固定值。
// teacher-usability-redesign 票 02：失敗時回傳結果給表單（useActionState），留在原頁、保留全部場次輸入；
// 成功才 redirect（不放在 try/catch 裡）。domain service 與生成規則不變。
export async function createOwnRecurringClassSeriesAction(
  _previousState: CreateClassFormState,
  formData: FormData,
): Promise<CreateClassFormState> {
  const mode = readFormString(formData, "mode");

  const input: RecurringSeriesInput = {
    title: readFormString(formData, "title"),
    description: readFormString(formData, "description"),
    serviceTypes: readServiceTypesFromForm(formData),
    yogaStyles: readYogaStylesFromForm(formData),
    startTime: readFormString(formData, "startTime"),
    endTime: readFormString(formData, "endTime"),
    location: readFormString(formData, "location"),
    capacity: readFormNumber(formData, "capacity"),
    requiresApproval: formData.get("requiresApproval") === "yes",
    mode,
    dayOfWeek: mode === "weekly" ? readFormNumber(formData, "dayOfWeek") : undefined,
    generateCount: mode === "weekly" ? readFormNumber(formData, "generateCount") : undefined,
    startDate: mode === "weekly" ? readFormString(formData, "startDate") : undefined,
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
    return {
      status: "error",
      mode: mode === "fixed_dates" ? "fixed_dates" : "weekly",
      code: result.code,
      message: result.message,
      fieldErrors: buildCreateClassFieldErrors(result.validationErrors),
    };
  }

  redirect(
    `/teacher/classes/series/${result.recurringClassSeriesId}?result=success&message=${encodeURIComponent(
      buildCreatedMessage(result.createdClassSessionIds.length, result.skipped),
    )}`,
  );
}

// 系列不會整批公開：每一場都是草稿、要逐堂開放報名，也不會列在公開課程列表。
const NEXT_STEP_MESSAGE = "每一場目前都是草稿，請逐堂開放報名；系列場次不會列在公開課程列表。";

function buildCreatedMessage(
  createdCount: number,
  skipped: { date: string }[],
): string {
  if (skipped.length === 0) {
    return `課程系列已建立，共生成 ${createdCount} 場。${NEXT_STEP_MESSAGE}`;
  }

  const skippedDates = skipped.map((occurrence) => occurrence.date).join("、");

  return `課程系列已建立，共生成 ${createdCount} 場；以下日期因時段衝突未生成：${skippedDates}。${NEXT_STEP_MESSAGE}`;
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
